# S12 — Edge cases

## Goal
The awkward areas — across the date line, tiny, polar, empty of Street View — all
behave, and a refresh never loses the area.

## Depends on
S11.

## Files touched
Mostly tests. Fixes wherever they land — expect `js/geo/polygon.js`,
`js/custom-map.js`, `js/streetview.js`.
`features/awkward-areas.feature` (new) + spec.

## Acceptance scenarios

```gherkin
Feature: Awkward custom areas

  Scenario: An area drawn across the date line works end to end
    Given the player draws an area from 170E to 170W across the date line
    When the player plays a round
    Then the location is inside the area
    And a guess at 179E is accepted
    And a guess at 150E is rejected

  Scenario: A very small area is refused with an explanation
    Given the player draws an area 2 km across
    Then the area cannot be confirmed
    And the reason is that the area is too small

  Scenario: An area with no street view is refused after searching
    Given the player draws an area over open ocean
    When the player confirms the area and starts a game
    Then the player is told there is no street view in that area
    And the player is returned to the drawing map with the area intact

  Scenario: An area over the pole is handled
    Given the player draws an area covering the north pole region
    Then either the area is accepted and locations fall inside it
    Or the area is refused with an explanation

  Scenario: Refreshing mid-game keeps the area
    Given a solo custom game is in progress
    When the player refreshes the page
    Then the game resumes with the same area

  Scenario: A concave area excludes its own bite
    Given the player draws a C-shaped area
    When 200 locations are drawn from it
    Then none of them fall in the gap of the C
```

## Inner loop
1. Dateline: a full pass through draft → shape → sampling → containment → score
   with an area spanning 170E to 170W. This exercises `unrollRing`,
   `normalisePointTo`, the bbox, and Leaflet's over-pan wrap all at once, and is
   the single most valuable test in this group.
2. Polar: decide the behaviour rather than discovering it. Recommended: clamp
   latitude to ±85.05 at tap time and let the area be a band rather than a cap;
   a true polar cap is not expressible as a simple ring in this frame. Whichever
   you pick, the scenario above must assert one branch, not "either" — rewrite it
   once decided.
3. Session restore: ring persisted and rebuilt for solo, VS host, VS guest, SU
   host, SU guest. Five paths; `main.js:252` onwards is where they diverge.
4. Concave sampling — the C-shape property test.
5. Fuzz: 500 seeded random rings through `unrollRing` → `ringIsSimple` →
   `diameterKm`. No throws, no `NaN`, no negative or infinite scale.

## Exit criteria
- [ ] All scenarios green with the "either/or" polar one rewritten to a decision.
- [ ] Fuzz run clean over 500 rings.
- [ ] Manual: draw an area across the Pacific on a phone, play a round.
- [ ] Refresh tested on all five session paths.

## Watch out for
`localStorage` limits are not the issue (a ring is under 1 KB) — losing the ring
silently is. If the stored session has a region of `CUSTOM` but no ring, that is
corrupt state: fall back to the landing screen rather than to `WORLD`, or the
player finds themselves in a world game they did not ask for.
