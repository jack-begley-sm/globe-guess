# S01 — Geometry core

## Goal
A play area can answer "is this point inside me?" correctly, including across the
antimeridian, and can tell a valid ring from a self-crossing one.

## Depends on
S00.

## Files touched
`js/geo/polygon.js` (new), `js/config.js` (add `CUSTOM_MAP` block),
`test/unit/polygon.spec.js` (new), `features/play-area-bounds.feature` (new),
`test/acceptance/play-area-bounds.spec.js` (new).

## Acceptance scenarios

```gherkin
Feature: A play area has a definite inside and outside

  Scenario: A location inside the drawn area counts
    Given a play area drawn around the box from 50N,-8W to 58N,2E
    When the point 54N,-3W is tested
    Then it is inside the play area

  Scenario: A location outside the drawn area does not count
    Given a play area drawn around the box from 50N,-8W to 58N,2E
    When the point 48N,10E is tested
    Then it is outside the play area

  Scenario: An area drawn across the date line stays in one piece
    Given a play area drawn around the box from 10S,170E to 10N,170W
    When the point 0N,179E is tested
    Then it is inside the play area
    And the point 0N,150E is outside the play area

  Scenario: A point exactly on the edge counts as inside
    Given a play area drawn around the box from 50N,-8W to 58N,2E
    When the point 50N,-3W is tested
    Then it is inside the play area

  Scenario: An area that crosses over itself is not a valid play area
    Given the player has drawn the ring 0N0E, 10N10E, 0N10E, 10N0E
    Then the ring is rejected as self-crossing
```

The dateline scenario is the one that earns its keep. Write it first.

## Inner loop
Contracts are in 02-geometry-contracts. Drive them in this order — each is a
plain Vitest test, no Gherkin:

1. `unrollRing` — the 178/−179 case, then idempotency, then no-mutation.
2. `normalisePointTo` — the 380-degree Leaflet over-pan case.
3. `ringBbox` in the unrolled frame.
4. `pointInRing` — inside, outside, <3 vertices, vertex hit, edge hit, the
   ray-through-vertex diamond, the concave L-shape bite, both winding orders.
5. `containsPoint` — bbox fast path; property test that it agrees with the raw
   ray cast over 5 000 seeded random points.
6. `ringIsSimple` — square, figure-eight, adjacent-edge non-intersection,
   duplicate vertices, collinear triple.

## Exit criteria
- [ ] All five acceptance scenarios green.
- [ ] 100% branch coverage on `js/geo/polygon.js`.
- [ ] Property test agreeing bbox fast path with full test passes on 20 rings.
- [ ] File under 150 lines with a CLAUDE.md-format header. Split into
      `polygon.js` + `polygon-validate.js` if it isn't.
- [ ] No `Math.random()` and no imports beyond `js/config.js`.

## Watch out for
The ray-casting vertex case. The standard even-odd loop double-counts when the
ray passes exactly through a vertex, and a hand-drawn polygon with two vertices
at the same latitude hits it. Use the `(yi > y) !== (yj > y)` form — strict on one
side, non-strict on the other — and keep the explicit on-edge check *before* the
loop so boundary points return true rather than depending on parity luck.
