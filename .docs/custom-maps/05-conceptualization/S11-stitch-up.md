# S11 — Stitch Up

## Goal
In a custom area, the setter can only pick locations inside it, and auto-placed
locations land inside it too.

## Depends on
S10.

## Files touched
`js/su-lobby.js`, `js/su-host.js`, `js/su-guest.js`, `js/su-setter.js`,
`js/su-guesser.js`, `js/su-spectator.js`, `js/su-state.js`,
`index.html` (Custom tile in `#su-region-grid`),
`features/custom-stitch-up.feature` (new) + spec.

## Acceptance scenarios

```gherkin
Feature: A custom area in a Stitch Up game

  Scenario: The setter's map shows the play area
    Given a Stitch Up game with a custom area
    When it is a player's turn to set
    Then the setter's map shows the area outlined and the rest dimmed

  Scenario: The setter cannot pick a location outside the area
    Given a Stitch Up game with a custom area
    And it is a player's turn to set
    When the setter taps outside the area
    Then no location is selected
    And the confirm button stays disabled

  Scenario: The setter can pick a location inside the area
    Given a Stitch Up game with a custom area
    And it is a player's turn to set
    When the setter taps inside the area on a street with street view
    Then the location is selected
    And the confirm button is enabled

  Scenario: Running out of setting time auto-places inside the area
    Given a Stitch Up game with a custom area
    And it is a player's turn to set
    When the setter's 30 seconds run out
    Then a location is auto-placed inside the area

  Scenario: The guesser is scored against the custom scale
    Given a Stitch Up round in a custom area whose scale is 200 km
    When the guesser lands 10 km from the location
    Then the guesser scores 3951 points
    And the setter scores 1049 points

  Scenario: An auto-placed round still gives the setter nothing
    Given a Stitch Up round in a custom area that was auto-placed
    When the guesser lands 10 km from the location
    Then the setter scores 0 points
```

Where those come from: scale 200 km → cutoff 90 km, so a 10 km miss is
`5000 × (1 − 0.05/0.45)² = 3951`, and the setter gets `5000 − 3951 = 1049` per the
existing rule at `js/su-host.js:394`.

## Inner loop
1. `suState.shape`, set from the lobby, broadcast in the ring alongside `region`
   at `js/su-host.js:105`, `:305` and `:364` (all three send `region` today).
2. Guest: `js/su-guest.js:78`, `:162`, `:188` — rebuild the shape wherever region
   is currently read.
3. `js/su-setter.js` — `initSetterPhase(guesserName, shape)`. Draw the polygon and
   mask on `setter-map`; `placeSetterPin` rejects outside points before the
   Street View lookup (cheaper, and the failure message is clearer).
4. `autoPlaceLocation(shape)` at `js/su-host.js:368` uses the shape-aware
   `getRandomLocation` from S07.
5. `handleGuesserSubmit` (`js/su-host.js:379`) passes `suState.shape.scaleKm` into
   `calculateScore`.
6. **The guesser's map is not `js/map.js`.** Stitch Up builds its own at
   `js/su-guesser.js:57`. Wire `js/map-overlay.js` into it (S08 should already
   have; verify). The spectator map (`js/su-spectator.js:41`) and the reveal maps
   are read-only — give them the outline for context but no click guard.

## Exit criteria
- [ ] All scenarios green.
- [ ] Auto-place produces a location inside the area, 20 seeded runs.
- [ ] The `guesserScore * 1.5` auto-place bonus at `js/su-host.js:390` still caps
      at 5000 and the setter still gets 0 on auto-placed rounds.
- [ ] A three-player manual game in a city-sized area completes.

## Watch out for
`js/su-setter.js` builds its own Leaflet map with `worldCopyJump: true`, which
teleports the view between world copies on pan. With a Pacific-spanning area that
will fight the unrolled frame. Either turn it off for custom areas or verify the
containment check still passes after a jump — a test with a tap at lng 190 after a
jump is the cheap way to find out.
