# S00 — Test harness

## Goal
`npm test` runs Gherkin-driven tests and CI goes red when they fail. No player-visible change.

## Depends on
Nothing.

## Files touched
`package.json`, `vitest.config.js` (new), `.github/workflows/test.yml` (new),
`.github/workflows/deploy.yml`, `test/support/rng.js` (new),
`features/scoring-scale.feature` (new), `test/acceptance/scoring-scale.spec.js` (new),
`.gitignore` (coverage output).

## Acceptance scenarios

There is no player behaviour here, so the "acceptance" is the harness itself
proving it can fail correctly. Use the walking-skeleton feature from
03-test-strategy verbatim, bound to a **temporary local** scoring function.

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

S03 will repoint the step definitions at the real `js/scoring.js` and delete the
local copy. That is the intended path — the feature file does not change.

## Inner loop
1. Install `vitest`, `@amiceli/vitest-cucumber`, `jsdom`, `@vitest/coverage-v8`.
2. `vitest.config.js` as in 03-test-strategy (node default, jsdom for `test/acceptance/**`).
3. Write the feature file and the spec. Confirm it passes.
4. **Prove the harness fails**: change one `Examples` number, confirm red, revert.
5. **Prove missing bindings fail**: comment out the `Then` step, confirm
   vitest-cucumber reports the missing step, restore.
6. Seeded rng in `test/support/rng.js` + a test that two generators with the same
   seed produce identical sequences.
7. Add `.github/workflows/test.yml`; gate `deploy.yml` on it.
8. Switch `deploy.yml` from `npm install` to `npm ci`.

## Exit criteria
- [ ] `npm test` green locally and in CI on a PR.
- [ ] Deliberately breaking an `Examples` value turns CI red.
- [ ] A missing step definition turns CI red.
- [ ] Deploy cannot run with tests failing.

## Watch out for
Vitest 4 needs Node 20+; the deploy workflow already pins 20. `loadFeature` is
top-level `await` — the spec files must be ESM, which they are (`"type": "module"`).
