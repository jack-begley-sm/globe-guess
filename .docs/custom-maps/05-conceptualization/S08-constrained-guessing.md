# S08 — Guesses only inside the area

## Goal
The guess map shows the play area, and a tap outside it does nothing.

## Depends on
S02. (Independent of S07 — can run in parallel.)

## Files touched
`js/map-overlay.js` (new), `js/map.js`, `js/vs-round.js` (lines 283–345),
`js/su-guesser.js` (line 57 onwards), `css/map.css`,
`features/guessing-in-area.feature` (new) + spec,
`test/support/fakes/leaflet.js` (extend).

## There are three guess maps, not one

`js/map.js` serves Classic only. VS and Co-op have their own (`initVsMap` /
`placeVsMarker`, `js/vs-round.js:283` and `:318`) and Stitch Up has a third
(`js/su-guesser.js:57`). All three need the same treatment, so the overlay and the
click guard go in a new shared `js/map-overlay.js`:

```js
drawShapeOverlay(map, shape)   // outline + world-with-a-hole mask; no-op for WORLD
guardClick(shape, handler)     // returns a click handler that drops outside taps
```

Each of the three call sites then becomes two lines. Do not copy the logic three
times — the copies will drift, and the one that drifts will be a multiplayer one
where you will not notice.

## Acceptance scenarios

```gherkin
Feature: Guesses must be inside the play area

  Scenario: The play area is visible on the guess map
    Given a custom game is in progress
    When the player opens the guess map
    Then the play area is outlined and the rest of the world is dimmed

  Scenario: Tapping inside the area places a pin
    Given a custom game is in progress
    And the guess map is open
    When the player taps a point inside the play area
    Then a pin is placed there
    And the submit button is enabled

  Scenario: Tapping outside the area places nothing
    Given a custom game is in progress
    And the guess map is open
    When the player taps a point outside the play area
    Then no pin is placed
    And the submit button stays disabled

  Scenario: Tapping outside after a valid guess keeps the valid guess
    Given the player has placed a pin inside the play area
    When the player taps a point outside the play area
    Then the pin stays where it was
    And the submit button stays enabled

  Scenario: Built-in regions constrain guesses too
    Given a Classic game in the UK region
    And the guess map is open
    When the player taps a point in France
    Then no pin is placed

  Scenario Outline: Every mode's guess map refuses outside taps
    Given a <mode> game with a custom play area is in progress
    And the guess map is open
    When the player taps a point outside the play area
    Then no pin is placed
    And the submit button stays disabled

    Examples:
      | mode      |
      | Classic   |
      | VS        |
      | Co-op     |
      | Stitch Up |

  Scenario: The first tap still just expands the collapsed map
    Given a custom game is in progress
    And the guess map is collapsed
    When the player taps the map
    Then the map expands
    And no pin is placed
```

The last one guards existing behaviour: `js/map.js` currently uses the first tap
on a collapsed widget to expand it, and only later taps place pins. Easy to break.

## Inner loop
1. Write `js/map-overlay.js` first, unit-tested against the Leaflet fake.
2. `initMap` gains the shape (read from state at round start, not at init — the
   map is created once and reused across games). Same for `initVsMap` and the
   Stitch Up guesser map.
2. `resetMap(shape)` draws/updates the `L.polygon` outline and the world-with-a-hole
   mask, and fits the view to the shape's bbox. For `WORLD`, skip the mask —
   dimming nothing is the correct render and avoids a full-globe hole polygon.
3. `placeMarker` rejects when `!containsPoint(latlng, shape)`. Keep the existing
   `latlng.wrap()` for the over-pan case, then normalise into the ring's frame.
4. Rejected taps: no marker, no state write, and the submit button's disabled
   state is left exactly as it was.
5. Optional and cheap: a brief shake or a one-line hint on rejection, so the
   player knows the tap registered and was refused rather than missed.

## Exit criteria
- [ ] All scenarios green, including all four rows of the mode table.
- [ ] `grep -n "L.map(" js/` reviewed: every *guess* map goes through
      `js/map-overlay.js`; the read-only result maps are exempt but checked.
- [ ] Zoom is bounded so the player cannot pan the area off screen entirely.
- [ ] Manual check on a thin, diagonal polygon — the mask renders right and the
      fit isn't absurdly zoomed out.
- [ ] The collapsed-then-expand tap behaviour is unchanged.

## Watch out for
The mask polygon's outer ring must wind opposite to the inner ring or Leaflet
renders it filled solid over the whole map. If the area goes black, that is the
bug. Also: `showResultOnMap` builds a fresh map per round — decide whether the
result map shows the polygon too (it should; it is the only place the player sees
their miss in context) and add it there as well.
