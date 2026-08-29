# Custom Maps — plan index

Feature: a **Custom** game mode where the player draws a polygon on a world map
and the entire game — Street View locations, allowed guesses, and scoring scale —
is confined to that polygon.

Read in order:

| Doc | What it settles |
|---|---|
| [00-overview.md](00-overview.md) | Why, the screen flow, module map, what changes in the existing codebase |
| [01-scoring-model.md](01-scoring-model.md) | The relative scoring maths, the 45% cutoff, and what it does to existing modes |
| [02-geometry-contracts.md](02-geometry-contracts.md) | Function-level contracts for the geometry module — the spec the unit tests encode |
| [03-test-strategy.md](03-test-strategy.md) | ATDD/outside-in TDD loop, Vitest + vitest-cucumber harness, test doubles, CI |
| [04-tosd-working-model.md](04-tosd-working-model.md) | How Time-Oriented Software Development is applied here — the time-box, the OK Point, what TOSD discards |
| [05-conceptualization/](05-conceptualization/) | The K-side material. One file per group (S00–S13): Gherkin, contracts, traps. Not work units. |
| [06-list-of-items.md](06-list-of-items.md) | **The List of Items.** The actual work, boxed at 1, 2 or 3 evenings each. Start here once you have read the rest. |

## Decisions already locked

These were decided before the plan was written. Changing one invalidates parts of it.

1. **Score denominator = polygon max diameter `D`** — the greatest great-circle
   distance between any two points *in* the play area. Score is a function of
   `d / D`; anything at or beyond `d/D >= 0.45` scores 0.
2. **Relative scoring applies to all modes**, not just Custom. The seven built-in
   regions become polygons and get their own `D`. This deliberately fixes the
   existing bug where a UK game and a World game are both scored against a hard
   2000 km curve.
3. **Guesses outside the polygon are blocked at the map**, not scored as 0. A tap
   outside the play area places nothing and leaves Submit disabled.
4. **Drawing is hand-rolled** — tap vertices on a Leaflet map, auto-closing ring,
   undo, no `leaflet-draw` dependency and no new CSP entry.
5. **Tests are Vitest + vitest-cucumber** running in jsdom. No browser E2E in
   this plan; Google Maps, Leaflet and PeerJS are faked at the module boundary.
6. **Process is TOSD** — Time-Oriented Software Development (Pflaeging & Kubsch,
   BetaCodex #26). One "day" = one evening session. Jack is both Conceptualizer
   and Realizer, so the OK Point is a self-check applied before an item starts.

## Terms used throughout

- **Play area / shape** — the polygon a game is confined to. Built-in regions and
  custom drawings are both represented as one.
- **Ring** — an ordered array of `{lat, lng}`, implicitly closed (last vertex
  joins the first). Never repeat the first vertex at the end.
- **`D` / `scaleKm`** — the play area's max diameter in km. The scoring denominator.
- **Unrolled frame** — a longitude representation that may exceed ±180 so that a
  polygon crossing the antimeridian stays contiguous. See 02-geometry-contracts.
- **Item** — the unit of work. Boxed at 1, 2 or 3 evenings. Lives in the List of
  Items and nowhere else.
- **OK Point** — the handshake between Conceptualization and Realization. Nothing
  is built before it crosses.
- **Group (S00–S13)** — a grouping label for conceptualization material, used so
  an item can cite where it is specified. Not a work unit and not a sprint.
