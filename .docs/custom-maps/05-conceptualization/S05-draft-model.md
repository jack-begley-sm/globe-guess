# S05 — The drawing model

## Goal
The rules of drawing an area — how many points, when it can be closed, what makes
it invalid — exist and are correct, with no map involved.

## Depends on
S02. (Independent of S03/S04 — can run in parallel with them.)

## Files touched
`js/custom-draft.js` (new), `js/config.js` (`CUSTOM_MAP` limits),
`test/unit/custom-draft.spec.js` (new), `features/drawing-rules.feature` (new) + spec.

## The model

```js
createDraft() -> Draft
Draft.addPoint(latLng) -> { ok: boolean, reason?: string }
Draft.undo()           -> removes the last point
Draft.clear()          -> back to empty
Draft.points           -> readonly LatLng[]   (raw, as tapped)
Draft.status()         -> { canClose: boolean, reason?: string, vertexCount }
Draft.close()          -> Shape    (throws if !canClose)
```

`reason` is one of a fixed set of codes — `TOO_FEW`, `TOO_MANY`,
`SELF_CROSSING`, `WOUND_ROUND_WORLD`, `TOO_SMALL` — so the UI owns the wording
and the tests never assert on English.

## Acceptance scenarios

```gherkin
Feature: Drawing a custom play area

  Scenario: Three points make an area
    Given an empty drawing
    When the player taps 51N,0E and 52N,1E and 51N,1E
    Then the area can be confirmed

  Scenario: Two points are not enough
    Given an empty drawing
    When the player taps 51N,0E and 52N,1E
    Then the area cannot be confirmed
    And the reason is that there are too few points

  Scenario: Undo removes the last point
    Given a drawing with points 51N,0E and 52N,1E and 51N,1E
    When the player undoes once
    Then the area cannot be confirmed
    And the drawing has 2 points

  Scenario: A shape that crosses itself cannot be confirmed
    Given an empty drawing
    When the player taps 0N,0E and 10N,10E and 0N,10E and 10N,0E
    Then the area cannot be confirmed
    And the reason is that the shape crosses itself

  Scenario: An area too small to hold a street cannot be confirmed
    Given an empty drawing
    When the player taps three points within 200 metres of each other
    Then the area cannot be confirmed
    And the reason is that the area is too small

  Scenario: The player cannot wrap all the way round the world
    Given an empty drawing
    When the player taps 0N,0E and 0N,170E and 0N,-20E and 10N,0E
    Then the last tap is rejected
    And the reason is that the shape wraps around the world

  Scenario: There is a limit on how detailed an area can be
    Given a drawing with 24 points
    When the player taps another point
    Then the tap is rejected
    And the reason is that there are too many points

  Scenario: Confirming produces a play area with its own scale
    Given a drawing around the box from 53.3N,-2.5W to 53.6N,-2.1W
    When the player confirms the area
    Then the play area's scale is under 50 km
    And a location drawn from it is inside it
```

## Inner loop
1. `CUSTOM_MAP = { MIN_VERTICES: 3, MAX_VERTICES: 24, MIN_AREA_KM2: 25,
   DENSIFY_STEP_DEG: 2, SAMPLE_ATTEMPTS: 60 }` in config. `MIN_AREA_KM2: 25`
   is a starting guess — a 5 km square. Revisit after S07 tells you how small an
   area can be and still find Street View.
2. `addPoint` — happy path, then each rejection code in isolation. Rejected taps
   must leave `points` unchanged.
3. Self-crossing checked **on every add**, not only on close, so the UI can show
   the bad edge immediately.
4. `undo` on an empty draft is a no-op, not a throw.
5. `close()` calls `makeCustomShape` from `js/geo/shapes.js`; assert it throws
   when `canClose` is false.
6. Property test: any draft built from points on a convex hull in order always
   closes successfully.

## Exit criteria
- [ ] All scenarios green.
- [ ] Every rejection code has its own test.
- [ ] `js/custom-draft.js` imports nothing from Leaflet, the DOM, or `js/state.js`.
- [ ] Under 150 lines with a header comment.

## Watch out for
Self-intersection on every add is O(n²) per tap, but n ≤ 24 — do not optimise it.
The real trap is checking the *closing* edge: while drawing, the ring is an open
polyline and the closing edge does not exist yet, so validate the open path
during drawing and the full closed ring only in `status()`/`close()`. Getting
this wrong makes the last leg of every normal polygon look self-crossing.
