# S09 — Solo Custom game, end to end

## Goal
A player can play a full five-round Custom game and the scores make sense.

## Depends on
S06, S07, S08, S04.

## Files touched
`js/round.js`, `js/results.js`, `js/state.js`, `index.html` (results copy),
`features/custom-solo-game.feature` (new) + spec.

## Acceptance scenarios

```gherkin
Feature: Playing a solo game in a custom area

  Scenario: A whole game stays inside the chosen area
    Given the player has drawn an area around Greater Manchester
    And has chosen 3 rounds
    When the player plays all 3 rounds
    Then every location was inside the area
    And every guess was inside the area
    And the game ends on the results screen

  Scenario: Scores use the custom area's scale
    Given the player has drawn an area whose scale is 40 km
    When the player guesses 4 km from the location
    Then they score 3025 points

  Scenario: A guess more than 45% across the custom area scores nothing
    Given the player has drawn an area whose scale is 40 km
    When the player guesses 20 km from the location
    Then they score 0 points

  Scenario: Running out of time scores nothing
    Given a custom game is in progress with a 30 second limit
    When the player lets the timer run out without guessing
    Then they score 0 points
    And the game moves to the next round

  Scenario: The speed bonus still applies
    Given a custom game with a 20 percent speed bonus and a 60 second limit
    When the player guesses 4 km from the location after 15 seconds
    Then their base score is 3025
    And their speed bonus is 454

  Scenario: The results screen explains the area
    Given the player has finished a custom game
    Then the results show the area's size and the distance beyond which a guess scores nothing

  Scenario: Playing again keeps the same area
    Given the player has finished a custom game
    When the player chooses play again
    Then the same area is used
```

Where those numbers come from: scale 40 km → cutoff 18 km. A 4 km miss gives
r = 0.1, so `5000 × (1 − 0.1/0.45)² = 5000 × 0.60494 = 3025`. A 20 km miss gives
r = 0.5, past the cutoff, so 0. The speed bonus is
`3025 × 0.20 × (1 − 15/60) = 3025 × 0.15 = 454`. Re-derive rather than copy if you
change `CURVE_EXPONENT` — these three numbers all move together.

## Inner loop
1. Thread `state.shape` through `startGame` → `getRandomLocation` →
   `initStreetView` → `calculateScore`.
2. Results screen: add a line showing scale and cutoff, e.g.
   "Area: 41 km across — anything over 18 km scored zero". This is the only place
   the player learns why their scores moved.
3. "Play again" keeps `state.shape`. `resetState()` currently forces
   `region = 'WORLD'` — it must not clobber a custom shape mid-session. Decide and
   test: play-again keeps it, returning to the landing screen clears it.
4. Full-game acceptance test with the Google Maps fake scripted to return known
   locations, so the expected total score is exact.

## Exit criteria
- [ ] All scenarios green with real numbers, recomputed not copied.
- [ ] A manual three-round game in a city-sized area is fun. If it isn't, the
      lever is `CURVE_EXPONENT`, and now is the time.
- [ ] `resetState` behaviour for the shape is explicit and tested both ways.
- [ ] No `console.error` in a clean run.

## Watch out for
`resetState()` in `js/state.js` sets `region = 'WORLD'` unconditionally. Also the
`.catch` in `startRound` swallows location errors and starts the timer anyway —
after S07 that path must surface `NoStreetViewInArea` instead of leaving the
player on a blank panorama with a running clock.
