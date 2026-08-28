# 03 — Test strategy (ATDD / outside-in TDD)

> TOSD is Time-Oriented Software Development (Pflaeging & Kubsch, BetaCodex #26),
> and it governs *when and how big* the work is — see
> [04-tosd-working-model.md](04-tosd-working-model.md). It names TDD, CI/CD and
> pair programming as complementary practices, so this doc governs the *how* of
> building each item, inside its box. The two do not conflict: TOSD says an item
> is 1–3 evenings and its requirement must be precise before it starts; ATDD says
> that precise requirement takes the form of an executable scenario.

## The loop

Per item, in this order. Step 1 usually happens at Conceptualization time, before
the item is listed at all — the OK Point requires the scenario to exist. Do not
skip it: the point of ATDD is that the scenario is the specification, not a
description written afterwards.

```
1. AGREE      Write the .feature file. Read it back as English. Does it describe
              behaviour a player would notice, in domain words, with no mention
              of functions or DOM ids? If not, rewrite it.

2. RED (outer) Bind the scenario to step definitions. Run it. It must fail for
              the right reason — a missing behaviour, not a typo or a missing
              import.

3. RED (inner) Write the smallest failing unit test for the next piece needed.
4. GREEN       Simplest code that passes.
5. REFACTOR    Only with all tests green. Re-check the ≤150-line rule and the
              CLAUDE.md header comment.
6. repeat 3-5 until the outer scenario is green.

7. DONE       Item's scenarios green, whole suite green, its "done when" met.
              Commit. One commit per item. Record whether the box held.
```

The inner loop is plain Vitest. The outer loop is Gherkin. Do not write Gherkin
for the inner loop — a `.feature` that says "Given `unrollRing` is called with
[178, -179]" is a unit test wearing a costume and costs more than it earns. The
geometry groups (S01, S02) are the exception the other way: their behaviour *is*
mathematical, so they get a small number of Gherkin scenarios for the rules a
player would recognise ("the World region's scale is the width of the world") and
plain Vitest tables for everything else.

## Layout

```
.docs/custom-maps/          this plan
features/                   .feature files, mirroring 05-conceptualization/
  scoring-scale.feature
  polygon-drawing.feature
  custom-solo-game.feature
  ...
test/
  unit/                     plain Vitest — geometry, draft model, scoring
    polygon.spec.js
    scoring.spec.js
    custom-draft.spec.js
  acceptance/               step definitions binding the .feature files
    scoring-scale.spec.js
    polygon-drawing.spec.js
    ...
  support/
    fakes/
      google-maps.js        fake StreetViewService + StreetViewPanorama
      leaflet.js            fake L.map / L.marker / L.polygon
      peer.js               in-memory PeerJS pair
    dom.js                  loads index.html fragments into jsdom
    rng.js                  seeded deterministic rng
vitest.config.js
```

## Harness setup (verified working)

```bash
npm i -D vitest @amiceli/vitest-cucumber jsdom @vitest/coverage-v8
```

Versions confirmed at time of writing: `vitest@4.1.x`, `@amiceli/vitest-cucumber@7.0.0`.
vitest-cucumber is a set of tools, not a plugin — no extra config entry needed.

`vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',              // per-file override to jsdom below
        include: ['test/**/*.spec.js'],
        environmentMatchGlobs: [['test/acceptance/**', 'jsdom']],
        coverage: { include: ['js/**'], reporter: ['text', 'lcov'] }
    }
});
```

Geometry and scoring run in `node` — they touch no DOM and are fast. Only the
acceptance specs pay for jsdom.

`package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:cov": "vitest run --coverage"
```

### Worked example of the binding

`features/scoring-scale.feature`:

```gherkin
Feature: Scores scale to the size of the play area

  Scenario Outline: The same miss is worth more in a bigger area
    Given a play area whose diameter is <diameter> km
    When a player guesses <miss> km from the location
    Then they score <score> points

    Examples:
      | diameter | miss | score |
      | 20015    | 2000 | 3026  |
      | 1171     | 100  | 3282  |
      | 1171     | 600  | 0     |
```

`test/acceptance/scoring-scale.spec.js`:

```js
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { scoreFromDistance } from '../../js/scoring.js';

const feature = await loadFeature('features/scoring-scale.feature');

describeFeature(feature, ({ ScenarioOutline }) => {
    ScenarioOutline('The same miss is worth more in a bigger area',
        ({ Given, When, Then }, variables) => {
            let scaleKm, distKm;
            Given('a play area whose diameter is <diameter> km', () => {
                scaleKm = Number(variables.diameter);
            });
            When('a player guesses <miss> km from the location', () => {
                distKm = Number(variables.miss);
            });
            Then('they score <score> points', () => {
                expect(Math.round(scoreFromDistance(distKm, scaleKm)))
                    .toBe(Number(variables.score));
            });
        });
});
```

vitest-cucumber fails the run if a scenario in the feature file has no matching
binding, or a step is missing or of the wrong type. That property is why the
feature files can be trusted as the specification — they cannot silently drift
out of sync with the code.

## Test doubles

Three external dependencies, all faked at the module boundary. None of them are
hit for real in any test.

### Google Maps / Street View — `test/support/fakes/google-maps.js`

The real `js/streetview.js` reaches for `window.google`, injects a `<script>`,
and calls back asynchronously. The fake installs a `window.google.maps` with:

- `StreetViewService.getPanorama(req, cb)` — answers from a scripted table of
  `{ centre, radius } -> panoData | ZERO_RESULTS`, so a test can say "there is
  exactly one pano, 300 km east of the polygon" and assert that S07 rejects it.
- `StreetViewPanorama` — records constructor options, exposes `setPano`,
  `getLinks`, and a `fire('pano_changed')` so the photosphere-retry path is
  testable.
- `StreetViewSource`, `StreetViewPreference`, `StreetViewStatus` enums.
- `event.addListenerOnce` / `trigger` / `clearInstanceListeners`.

Set `isLibraryLoaded` by pre-populating `window.google` before importing the
module, so the script-injection branch is never taken.

### Leaflet — `test/support/fakes/leaflet.js`

Only needed by the acceptance specs for the draw screen and guess map. Fakes
`L.map` (returning an object with `on`, `setView`, `invalidateSize`,
`fitBounds`, `remove`), `L.marker`, `L.circleMarker`, `L.polygon`, `L.polyline`,
`L.tileLayer`, `L.featureGroup`, `L.DomUtil.get`, and a `latLng` with `.wrap()`.
Map clicks are simulated by invoking the handler registered via `on('click')`.

This fake exists only because `js/custom-map.js` and `js/map.js` are adapters.
**If a test needs to reach deeply into the Leaflet fake to check a rule, the rule
is in the wrong file** — move it to `custom-draft.js` or `polygon.js` and test it
without Leaflet at all. Treat that as the design smell it is.

### PeerJS — `test/support/fakes/peer.js`

An in-memory `Peer` where `new Peer(code)` registers in a module-level registry
and `peer.connect(code)` resolves synchronously to a linked pair of connection
objects with `send`/`on('data')`. Lets S10 assert "host broadcasts the ring, guest
rebuilds an identical Shape" without a network or a signalling server.

### Determinism

`test/support/rng.js` exports a seeded generator (mulberry32 is fine). Every
sampling path takes an injected `rng`. There must be no bare `Math.random()` in
`js/geo/` or in the new sampling code — a lint-style grep in CI is worth it.
`Date.now` is controlled with `vi.useFakeTimers()` in timer scenarios.

## Coverage and quality gates

Not a percentage target — a shape target:

| Area | Expectation |
|---|---|
| `js/geo/polygon.js` | 100% branch. It is pure, small, and everything depends on it. No excuse. |
| `js/scoring.js` | 100% branch, plus the degenerate-input table from 01-scoring-model. |
| `js/custom-draft.js` | 100% of the validation rules; each rejection reason asserted individually. |
| adapters (`custom-map.js`, `map.js`, lobby wiring) | Behaviour covered by acceptance scenarios only. Do not chase line coverage here. |
| network paths | One acceptance scenario per message type that carries a ring. |

Property-based checks worth having (plain Vitest loops over the seeded rng, no
extra library needed):

- `containsPoint` with the bbox fast-path agrees with the full ray cast over
  5 000 random points on 20 random rings.
- `randomPointInShape` returns only points satisfying `containsPoint`, over
  1 000 draws.
- `unrollRing` is idempotent over random rings.
- Score is monotonically non-increasing in distance for any fixed scale.

## CI

Extend `.github/workflows/deploy.yml` — or better, split it. Tests should gate
the deploy, and should also run on pull requests, which the current workflow
does not.

```yaml
# .github/workflows/test.yml  (new)
name: Test
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm test
```

and in `deploy.yml`, add `needs: test` to the deploy job after adding the test
job, or add `- run: npm test` before the build step. Either is fine; do not ship
a deploy that can go out red.

Note the existing workflow uses `npm install`, not `npm ci`. Since a lockfile is
committed, `npm ci` is the correct call and makes CI reproducible — worth fixing
in the same commit as S00.

## Rules for writing the scenarios

1. **Player-visible language.** "Then the guess is rejected" not "Then
   `placeMarker` returns false".
2. **One behaviour per scenario.** If the title needs "and", split it.
3. **Given = state, When = the single action, Then = the observable outcome.**
   No `When` in a `Then`.
4. **Numbers in scenarios are the specification.** `3026` in a table is a
   decision about how the game feels. If a change makes a number move, that is a
   conversation, not a test fix.
5. **No scenario asserts on a DOM id.** Ids go in step definitions. That keeps
   the features readable and survives a redesign of `index.html`.
6. **A scenario that needs more than ~7 steps is describing two things.**
