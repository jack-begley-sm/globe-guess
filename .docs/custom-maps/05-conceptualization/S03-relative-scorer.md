# S03 — Relative scorer

## Goal
Score is a function of how far the guess is *relative to the play area*, and
anything 45% of the way across or worse is zero.

## Depends on
S02.

## Files touched
`js/scoring.js`, `js/config.js` (`SCORING` block), `test/unit/scoring.spec.js`
(new), `test/acceptance/scoring-scale.spec.js` (repoint from S00's local copy to
the real module).

## Acceptance scenarios

Reuse `features/scoring-scale.feature` from S00 unchanged, and add:

```gherkin
Feature: Scores scale to the size of the play area

  Scenario: A perfect guess always scores full marks
    Given a play area whose diameter is 40 km
    When a player guesses 0 km from the location
    Then they score 5000 points

  Scenario: Guessing 45% of the way across the area scores nothing
    Given a play area whose diameter is 1000 km
    When a player guesses 450 km from the location
    Then they score 0 points

  Scenario: Guessing further than the cutoff still scores nothing
    Given a play area whose diameter is 1000 km
    When a player guesses 8000 km from the location
    Then they score 0 points

  Scenario: Not guessing at all scores nothing
    Given a play area whose diameter is 1000 km
    When a player runs out of time without placing a pin
    Then they score 0 points

  Scenario: A near miss in a small area is worth less than in a large one
    Given a play area whose diameter is 40 km
    And another play area whose diameter is 20015 km
    When a player guesses 10 km from the location in each
    Then they score fewer points in the small area
```

## Inner loop
1. `SCORING = { CUTOFF_RATIO: 0.45, CURVE_EXPONENT: 2 }` in `js/config.js`.
2. `scoreFromDistance(d, scaleKm)` — the reference implementation in
   01-scoring-model. Drive with the degenerate-input table from that doc:
   `scaleKm` of `0`, `-1`, `NaN`, `undefined` all **throw**; `d = 0` is exactly
   `MAX_SCORE`; `d = 0.45 * D` is exactly `0`; `d` just under cutoff is small and
   positive.
3. Monotonicity property test: for a fixed scale, score never increases as
   distance increases, over 1 000 seeded pairs.
4. `calculateScore(..., scaleKm)` — seventh argument, validated eagerly. Null
   guess still returns `{ distanceKm: Infinity, totalScore: 0 }` and must **not**
   throw on a bad scale in that branch... actually it must: validate the scale
   first so an un-migrated call site is caught even on a timeout round.
5. Speed bonus regression: with `scaleKm` fixed, the existing speed-bonus tests
   for `timeFactor` behave exactly as before.

## Exit criteria
- [ ] `MAX_SCORE` is still reachable and still 5000.
- [ ] Calling `calculateScore` without `scaleKm` throws, with a message naming
      the missing argument.
- [ ] 100% branch coverage on `js/scoring.js`.
- [ ] S00's temporary local scorer deleted; the feature file unchanged.
- [ ] **The four existing call sites still compile but now throw at runtime.**
      That is expected and is fixed in S04 — do not paper over it with a default
      value.

## Watch out for
The temptation to default `scaleKm` to 2000 "so nothing breaks". That converts a
loud failure into four silently wrong scoring paths, one of which
(`js/su-host.js:394`) then feeds a setter score derived from `5000 - guesserScore`.
Let it throw. S04 is the next group and it is short.
