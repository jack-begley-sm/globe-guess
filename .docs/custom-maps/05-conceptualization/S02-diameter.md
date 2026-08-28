# S02 — Diameter and shapes

## Goal
Any play area — drawn or built in — knows its own size in km, and that number is
the one the scorer will divide by.

## Depends on
S01.

## Files touched
`js/geo/polygon.js` (add `densifyRing`, `diameterKm`, `areaKm2`,
`randomPointInShape`), `js/geo/shapes.js` (new), `js/config.js` (`REGION_RINGS`),
`test/unit/polygon.spec.js`, `test/unit/shapes.spec.js` (new),
`features/play-area-scale.feature` (new) + its spec.

## Acceptance scenarios

```gherkin
Feature: A play area knows how big it is

  Scenario: The World region spans the whole world, not just its corners
    Given the built-in World play area
    Then its scale is 20015 km give or take 20 km

  Scenario Outline: Built-in regions have their own scale
    Given the built-in <region> play area
    Then its scale is <scale> km give or take 20 km

    Examples:
      | region   | scale |
      | UK       | 1171  |
      | EUROPE   | 6232  |
      | AMERICAS | 17305 |
      | AFRICA   | 10783 |
      | ASIA     | 13260 |
      | OCEANIA  | 7684  |

  Scenario: A small drawn area has a small scale
    Given a play area drawn around the box from 53.3N,-2.5W to 53.6N,-2.1W
    Then its scale is under 50 km

  Scenario: Random locations for a play area fall inside it
    Given a play area drawn as a triangle at 51N,0E / 52N,1E / 51N,1E
    When 200 random locations are drawn from it
    Then every one of them is inside the play area
```

The first scenario is the regression test for the densification trap described in
01-scoring-model. **Write it before `diameterKm` exists and confirm that a
vertices-only implementation returns 14 455 and fails it.** That failure is the
whole point of this group; seeing it once is worth more than the test is
afterwards.

## Inner loop
1. `densifyRing` — output length, every vertex present, short-edge ring returns
   vertices unchanged, closing edge included, no duplicate close.
2. `diameterKm` — UK ring 1171; **WORLD ring 20 015 not 14 455**; two-vertex
   degenerate ring; monotonicity when a far vertex is added.
3. `areaKm2` — UK bbox ≈ 700 000 km² ±10%; a degenerate ring is 0.
4. `randomPointInShape` — seeded rng; every point contained; square succeeds
   first try; thin sliver returns `null` after the attempt budget; the budget is
   respected exactly (assert call count on the injected rng).
5. `js/geo/shapes.js` — `getShape('UK')` memoises (same object identity twice);
   `getShape('WORLD')` matches the table; `makeCustomShape(ring)` produces
   `id: 'CUSTOM'` with computed bbox and scale; an invalid ring throws.

## Exit criteria
- [ ] All scenarios green, including the six-row region table.
- [ ] `diameterKm` for a 24-vertex ring at 2° densification completes in under
      100 ms (assert with `performance.now()` — it is cached, but a slow one here
      means a stall on the draw screen's "USE THIS AREA" tap).
- [ ] Built-in shapes are computed once and reused.
- [ ] `randomPointInShape` takes an injected rng; no bare `Math.random()`.

## Watch out for
`REGION_RINGS` must be derived from the existing `REGIONS` bboxes, not
hand-typed, so the two cannot drift. `js/streetview.js` still reads `REGIONS`
for bbox sampling at this point — leave it alone until S07.
