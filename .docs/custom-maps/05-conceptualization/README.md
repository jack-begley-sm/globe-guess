# Conceptualization material

**These are not work units.** Under TOSD the work unit is the Item, boxed at 1, 2
or 3 evenings, and Items live in [../06-list-of-items.md](../06-list-of-items.md).
Several of the groups below are two or three weeks of evenings — exactly the
sizing TOSD exists to prevent.

What these files are is the **K-side output**: the acceptance scenarios, the
contracts, the traps, and the ordering. They are what an Item points at, and what
you draw on when the current List of Items is done and you write the next one.

Every group file has the same shape:

- **Goal** — one sentence, in player-visible terms.
- **Depends on** — groups that must be complete first.
- **Files touched** — the blast radius, agreed before starting.
- **Acceptance scenarios** — the Gherkin. Written and reviewed *before* code.
- **Inner loop** — the ordered unit-test steps that drive the scenarios green.
  This is the raw material for decomposing the group into Items.
- **Exit criteria** — what "done" means for the whole group.
- **Watch out for** — the specific way this group goes wrong.

| # | Group | Ships |
|---|---|---|
| [S00](S00-harness.md) | Test harness | Nothing user-visible. A green `npm test` in CI. |
| [S01](S01-geometry-core.md) | Geometry core | `js/geo/polygon.js` containment + validity |
| [S02](S02-diameter.md) | Diameter & shapes | `scaleKm` for any ring; `js/geo/shapes.js` |
| [S03](S03-relative-scorer.md) | Relative scorer | `scoreFromDistance(d, scaleKm)` |
| [S04](S04-regions-migrate.md) | Regions migrate | **All existing modes rescored.** Point of no return. |
| [S05](S05-draft-model.md) | Draw model | Headless polygon draft with all its rules |
| [S06](S06-draw-screen.md) | Draw screen | A player can draw an area and confirm it |
| [S07](S07-constrained-sampling.md) | Locations in bounds | Street View only inside the area |
| [S08](S08-constrained-guessing.md) | Guesses in bounds | Guess map refuses outside pins |
| [S09](S09-solo-game.md) | Solo Custom game | End-to-end playable solo Custom mode |
| [S10](S10-vs-mode.md) | VS / Co-op | Host draws before the lobby; guests receive the area |
| [S11](S11-stitch-up.md) | Stitch Up | Setter and auto-place constrained |
| [S12](S12-edge-cases.md) | Edge cases | Antimeridian, tiny areas, no-Street-View areas, resume |
| [S13](S13-polish.md) | Polish & docs | Results copy, awards check, CLAUDE.md |
