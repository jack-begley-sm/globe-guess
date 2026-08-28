# S07 — Street View only inside the area

## Goal
Every location the game drops you in is inside the drawn area — and if it can't
find enough of them, it says so instead of quietly widening.

This is the highest-risk group in the plan.

## Depends on
S02, S05.

## Files touched
`js/streetview.js`, `js/round.js`, `js/config.js`,
`test/support/fakes/google-maps.js` (new),
`test/unit/streetview-sampling.spec.js` (new),
`features/locations-in-area.feature` (new) + spec.

## The problem

`findNearestOutdoor` walks a radius ladder up to **500 km**:

```js
const radii = [1000, 5000, 10000, 25000, 50000, 100000, 200000, 500000];
```

Sample a point inside a 30 km polygon around Manchester, find no pano at 1 km,
and the ladder happily returns one in Denmark. The result passes every existing
check. The player sees a location outside their area, guesses inside it, and
scores nothing they can explain. Two fixes, both needed:

1. **Cap the ladder** by the shape: drop any radius greater than
   `shape.scaleKm * 1000 * CUSTOM_MAP.MAX_SEARCH_FRACTION` (start at `0.25`).
2. **Re-check the result**: `containsPoint(panoLatLng, shape)` after the lookup.
   Outside → treat as a miss and resample. This is the backstop and must exist
   even with the cap.

## Acceptance scenarios

```gherkin
Feature: Locations are always inside the play area

  Scenario: A location is only used if it is inside the area
    Given a play area around Greater Manchester
    And the nearest street view to the sampled point is 300 km away
    When the game looks for a location
    Then that street view is not used
    And another location is sampled

  Scenario: A location inside the area is used
    Given a play area around Greater Manchester
    And there is street view 2 km from the sampled point, inside the area
    When the game looks for a location
    Then that location is used

  Scenario: An area with no street view at all gives up gracefully
    Given a play area in the middle of the Pacific
    And there is no street view anywhere in it
    When the game looks for a location
    Then the player is told the area has no street view
    And the player is returned to the drawing map with the area intact

  Scenario: Built-in regions still work
    Given a Classic game in the UK region
    When the game looks for a location
    Then a location is found inside the UK region

  Scenario: The next round is pre-fetched from inside the area
    Given a custom game is in progress
    When round 1 is being played
    Then the round 2 location has already been found inside the area
```

The third scenario matters more than it looks — an area in the sea is the first
thing a player will draw by accident, and without this they get an infinite
spinner.

## Inner loop
1. Build the Google Maps fake. Its `getPanorama` answers from a scripted table so
   a test can place a single pano at an exact offset and radius.
2. Change `getRandomLocation(regionName)` → `getRandomLocation(shape)` and
   `initStreetView(regionName, ...)` → `initStreetView(shape, ...)`. Update the
   three call sites in `js/round.js` (lines ~35, ~52, ~60, ~64) and, later,
   `js/vs-round.js:40/50` and `js/su-host.js:371`.
3. Replace `generateRandomLatLng(region)` with `randomPointInShape(shape, rng)`.
   `rng` injected, defaulting to `Math.random`.
4. Cap the radius ladder. Assert with the fake that a pano beyond the cap is
   never even requested.
5. Containment re-check after `findNearestOutdoor` resolves. Assert resample.
6. Attempt budget: existing code retries 20 times. Keep 20, but distinguish
   "photosphere" retries from "outside the area" retries so the failure message
   can be accurate. On exhaustion reject with a typed error
   (`NoStreetViewInArea`), not a bare string.
7. `js/round.js` catches `NoStreetViewInArea` and routes back to
   `screen-custom-draw` with the draft restored — currently the `.catch` just
   logs and starts the timer, which would leave the player staring at a dead
   panorama.

## Exit criteria
- [ ] All scenarios green.
- [ ] No real network call in any test (assert the fake's call log is the only traffic).
- [ ] A 20 km polygon over a city centre finds five distinct locations in a manual run.
- [ ] A polygon over open ocean surfaces the "no street view here" message within
      ~10 seconds, not never.
- [ ] `MIN_AREA_KM2` revisited against what you learned; update S05's config value.

## Watch out for
Pre-fetching. `js/round.js` starts finding round N+1 while round N is played, and
`js/vs-round.js` does the same. If the shape changes (new game, "Play Again" with
a different area) a stale in-flight promise can deliver a location from the old
polygon. Tag each pre-fetch with the shape it was started for and discard on
mismatch. There is a matching stale-guess guard already in `js/vs-host.js:257`
worth copying the shape of.
