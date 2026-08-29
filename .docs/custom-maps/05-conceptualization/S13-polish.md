# S13 — Polish and docs

## Goal
Custom mode looks like it belongs in the app, and the next person to open the
repo understands it.

## Depends on
S12.

## Files touched
`index.html`, `css/custom.css`, `css/map.css`, `js/results.js`,
`js/vs-results.js`, `js/su-results.js`, `js/awards.js`, `CLAUDE.md`,
`.docs/custom-maps/*` (mark the plan as delivered).

## Acceptance scenarios

```gherkin
Feature: Custom mode is legible to the player

  Scenario: The results screen explains the scale
    Given the player has finished a game in any mode
    Then the results show how big the play area was
    And how far away a guess had to be to score nothing

  Scenario: The round result shows the miss relative to the area
    Given the player has just guessed
    Then the result shows the distance
    And how that compares to the size of the play area

  Scenario: Custom mode is offered everywhere a region is offered
    Given the player is choosing a region
    Then Custom is one of the choices
    In Classic and VS and Co-op and Stitch Up
```

The last scenario is loose Gherkin — tighten or split it when you write the
bindings; the intent is that no region grid is left without a Custom tile.

## Checklist
- [ ] Custom tile present in the landing grid, `#vs-region-grid`, `#su-region-grid`,
      and the Classic `.region-grid`.
- [ ] Results copy: "Area: 41 km across · zero beyond 18 km" or similar, in all
      four results screens.
- [ ] Round result overlay: the existing `gold` class triggers at `distanceKm < 100`
      (`js/round.js`). That threshold is now wrong for small areas — make it
      relative, e.g. `r < 0.05`.
- [ ] `js/awards.js` reviewed for any other absolute-distance threshold.
- [ ] Draw screen: hint text for every rejection reason, a visible vertex count,
      and a live scale readout as the area is drawn ("about 41 km across") — that
      readout does more to teach the scoring than any results-screen copy.
- [ ] `CLAUDE.md` file map updated with `js/geo/polygon.js`, `js/geo/shapes.js`,
      `js/custom-draft.js`, `js/custom-map.js`, `js/custom-lobby.js`,
      `css/custom.css`, plus the new `features/` and `test/` trees.
- [ ] `CLAUDE.md` "Current Status" gains Custom mode entries.
- [ ] `CLAUDE.md` gains a line about the test suite, since "no backend, no
      frameworks" no longer implies "no tooling".
- [ ] Every new JS file has the header comment in the house format and is ≤150 lines.
- [ ] `VERSION` in `js/config.js` bumped.

## Exit criteria
- [ ] Whole suite green.
- [ ] A person who has never seen the app can open Custom, draw an area, and play
      without being told anything.
- [ ] `.docs/custom-maps/README.md` updated with anything the build taught you
      that contradicts the plan. A plan that was never corrected was never used.
