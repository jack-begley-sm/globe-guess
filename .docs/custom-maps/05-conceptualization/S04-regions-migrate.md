# S04 — Regions migrate to relative scoring

## Goal
Every existing mode scores against its own region's size. A UK game gets sharp;
a World game stops treating "wrong country" and "wrong continent" as the same
answer.

**This is the point of no return.** After this group every score in the game
changes. Nothing here is about Custom mode.

## Depends on
S03.

## Files touched
`js/state.js`, `js/vs-state.js`, `js/su-state.js`, `js/round.js`,
`js/vs-round.js` (~line 410), `js/su-host.js` (~lines 385 and 394),
`js/config.js` (delete `MAP_SETTINGS.MAX_GUESS_DISTANCE`),
`test/unit/scoring-integration.spec.js` (new),
`features/region-scoring.feature` (new) + spec.

## Acceptance scenarios

```gherkin
Feature: Each region is scored against its own size

  Scenario: A 100 km miss in the UK is a worse guess than in the World
    Given a Classic game in the UK region
    When the player guesses 100 km from the location
    Then they score 3282 points
    And the same guess in the World region would score 4890 points

  Scenario: A wrong-continent guess in a World game scores something, not nothing
    Given a Classic game in the World region
    When the player guesses 4000 km from the location
    Then they score 1545 points

  Scenario: A guess more than 45% across the region scores nothing
    Given a Classic game in the UK region
    When the player guesses 600 km from the location
    Then they score 0 points

  Scenario: A VS round scores every player against the region size
    Given a VS game in the Europe region with two players
    When one guesses 100 km away and the other guesses 3000 km away
    Then the first scores more than the second
    And the second scores 0 points

  Scenario: A Stitch Up setter is rewarded by the guesser's shortfall
    Given a Stitch Up round in the World region
    When the guesser lands 4000 km from the setter's location
    Then the guesser scores 1545 points
    And the setter scores 3455 points
```

Every number above is a decision about how the game feels, not an implementation
detail. If one of them is wrong for you, change `SCORING.CURVE_EXPONENT` and
update the table — do not change `CUTOFF_RATIO`.

## Inner loop
1. Add `shape` to all three state objects, defaulting to `getShape('WORLD')`.
   `region` stays as the label for UI and network payloads.
2. Where region is currently assigned from the DOM (`js/lobby.js:116`,
   `js/vs-lobby.js:105`, `js/su-lobby.js:104`), also set `state.shape = getShape(region)`.
3. Thread `shape.scaleKm` into all four `calculateScore` call sites.
4. Guest side. Note the asymmetry: Stitch Up guests set `region` in three places
   (`js/su-guest.js:78`, `:162`, `:188`), but **VS guests only ever set it in
   `resumeInProgressRound` (`js/vs-round.js:126`)** — a VS guest sitting in the
   lobby before kickoff has no region at all. Set `shape` alongside each, and see
   S10 for closing the VS lobby gap.
5. Delete `MAP_SETTINGS.MAX_GUESS_DISTANCE`. Check what else `js/vs-round.js:5`
   uses from `MAP_SETTINGS` before touching the import.
6. `js/awards.js` — read it and check nothing thresholds on a raw km distance
   calibrated to the 2000 km curve. Fix or note.

## Exit criteria
- [ ] All scenarios green.
- [ ] `grep -rn "MAX_GUESS_DISTANCE" js/` returns nothing.
- [ ] No `calculateScore` call site without a scale (`grep -rn "calculateScore"`).
- [ ] **Manual playtest before starting S05**: five rounds of World, five of UK,
      one VS round, one Stitch Up round. Do the numbers feel right? If World
      feels too soft, this is the moment to raise `CURVE_EXPONENT` — before three
      more groups are built on the current feel.

## Watch out for
`js/su-host.js:394`: `setterScore = 5000 - guesserScore`. A more generous guesser
curve means a stingier setter, and the `guesserScore * 1.5` auto-place cap at
line 390 interacts with it. Nothing breaks arithmetically, but Stitch Up will
feel different. Play a round.
