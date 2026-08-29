# S06 — The draw screen

## Goal
A player can open Custom mode, tap out an area on a world map, see it, fix it,
and confirm it.

## Depends on
S05.

## Files touched
`index.html` (new `screen-custom-draw`, Custom tile on landing),
`js/custom-map.js` (new), `js/custom-lobby.js` (new), `main.js` (wiring),
`css/custom.css` (new), `js/state.js` (store the confirmed shape),
`features/draw-screen.feature` (new) + spec,
`test/support/fakes/leaflet.js` (new).

## Acceptance scenarios

```gherkin
Feature: Choosing a custom area before a solo game

  Background:
    Given the player is on the home screen

  Scenario: Custom mode opens the drawing map
    When the player chooses Custom
    Then the drawing map is shown
    And the confirm button is disabled

  Scenario: Tapping the map builds up the area
    Given the player is on the drawing map
    When the player taps three points on the map
    Then the area outline is drawn
    And the confirm button is enabled

  Scenario: The world outside the area is dimmed
    Given the player has drawn a valid area
    Then the map shows the area highlighted and the rest of the world dimmed

  Scenario: Undo steps back one point
    Given the player has drawn a valid area
    When the player taps undo
    Then the confirm button is disabled

  Scenario: A rejected tap explains itself
    Given the player has drawn a valid area
    When the player taps a point that would make the shape cross itself
    Then no point is added
    And a message explains that the shape crosses itself

  Scenario: Confirming carries the area into the game options
    Given the player has drawn a valid area
    When the player confirms the area
    Then the game options screen is shown
    And the options screen shows the chosen area instead of the region grid

  Scenario: Going back from the drawing map returns home
    Given the player is on the drawing map with two points tapped
    When the player goes back
    Then the home screen is shown
    And the drawing is discarded
```

## Inner loop
1. `index.html`: `screen-custom-draw` with `#custom-map`, `#btn-custom-undo`,
   `#btn-custom-clear`, `#btn-custom-confirm`, `#custom-draw-hint`,
   `#custom-area-summary`. Add a `data-region="CUSTOM"` tile to the landing grid.
2. `js/custom-map.js` — Leaflet adapter only. On click: forward `e.latlng` to the
   draft; on result, redraw. Renders the ring as an `L.polygon`, vertex handles as
   `L.circleMarker`, and the exterior mask as a polygon with a hole (outer ring =
   whole world, inner ring = the drawn ring — Leaflet supports this natively as
   `L.polygon([outer, inner])`).
3. `js/custom-lobby.js` — buttons, hint text mapping from reason codes to English,
   confirm → `state.shape`, screen transitions.
4. `main.js` — the Custom tile shows `screen-custom-draw`.
5. Lobby: when arriving from Custom, hide `.region-grid` and show the area summary
   (vertex count, scale in km, cutoff in km). Everything else on that screen —
   name, rounds, time, speed bonus — is untouched.

## Exit criteria
- [ ] All scenarios green in jsdom with the Leaflet fake.
- [ ] **No rule lives in `js/custom-map.js`.** It reads the draft and draws; it
      decides nothing. Verify by grep: no `MIN_`/`MAX_`/`ringIsSimple` in that file.
- [ ] Manual pass on a phone-sized viewport: taps land where you expect, the
      confirm bar is above the home indicator, undo is reachable one-handed.
- [ ] Back button discards cleanly — re-entering Custom starts empty.

## Watch out for
The existing guess map has a documented Leaflet over-pan bug (`js/map.js`
`placeMarker` calls `latlng.wrap()`). Do **not** wrap here — the draft stores raw
tapped longitudes and `unrollRing` handles continuity at close. Wrapping at tap
time is what breaks a Pacific-spanning area, and it will look fine in every test
that stays inside one world copy.
