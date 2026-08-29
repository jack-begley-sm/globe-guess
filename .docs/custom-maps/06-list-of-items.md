# 06 — List of Items

**Keeper:** Jack. **Box unit:** one evening ≈ 2–3 hours. **Boxes:** 1, 2 or 3 only.

This is the single List of Items. It is not a backlog: it runs to a stated end,
and when it is done it is **replaced**, not extended. See
[04-tosd-working-model.md](04-tosd-working-model.md) for why.

**This list ends at the scoring decision point** — the moment every existing mode
has been rescored and you have played it. What comes after depends on what that
playtest tells you, so listing it now would be fiction.

**Before starting any item, run the OK Point checklist** in 04-tosd-working-model.
An item that fails it goes back to Conceptualization.

---

## The list

Order is dependency order. Items with the same prefix may be reordered among
themselves; across prefixes they may not.

| # | Item | Box | Conceptualized in | Done when |
|---|---|:--:|---|---|
| 1 | Install Vitest + vitest-cucumber + jsdom; `vitest.config.js`; npm scripts; one trivial passing test | 1 | S00 | `npm test` green |
| 2 | Walking-skeleton `scoring-scale.feature` + bindings against a temporary local scorer; prove it goes red on a changed Examples value **and** on a missing step | 1 | S00 | Both failure modes observed, then reverted |
| 3 | Seeded rng in `test/support/rng.js` + determinism test | 1 | S00 | Same seed, same sequence, asserted |
| 4 | CI: new `test.yml`, gate `deploy.yml` on it, switch `npm install` → `npm ci` | 1 | S00 | A red test blocks deploy on a PR |
| 5 | `unrollRing` + `normalisePointTo` + their tests | 2 | S01, §02 | 178/−179 case, 380° over-pan case, idempotency, no mutation |
| 6 | `pointInRing` — inside, outside, <3 vertices, vertex hit, edge hit, ray-through-vertex diamond, concave bite, both windings | 2 | S01, §02 | All eight cases green |
| 7 | `containsPoint` + bbox fast path + property test against raw ray cast | 1 | S01, §02 | 5 000 random points on 20 rings agree |
| 8 | `ringIsSimple` + tests | 1 | S01, §02 | Square, figure-eight, adjacent edges, duplicate vertices, collinear |
| 9 | `play-area-bounds.feature` + bindings (five scenarios, incl. the date line) | 1 | S01 | Green; S01 exit criteria met |
| 10 | `densifyRing` + tests | 1 | S02, §02 | Vertices preserved, closing edge included, no duplicate close |
| 11 | `diameterKm` — **write the WORLD 20 015 km test first and watch a vertices-only implementation return 14 455** | 2 | S02, §01 | All seven regions in the table match ±20 km; 24-vertex ring under 100 ms |
| 12 | `randomPointInShape` with injected rng + attempt budget + containment property test | 1 | S02, §02 | 1 000 draws all contained; sliver returns `null` |
| 13 | `areaKm2` | 1 | S02, §02 | UK bbox ≈ 700 000 km² ±10% |
| 14 | `js/geo/shapes.js` — `REGION_RINGS` derived from `REGIONS`, `getShape`, memoisation, `makeCustomShape` | 2 | S02 | Same object identity on repeat call; invalid ring throws |
| 15 | `play-area-scale.feature` + bindings (the six-row region table) | 1 | S02 | Green; S02 exit criteria met |
| 16 | `SCORING` config + `scoreFromDistance(d, scaleKm)` + the degenerate-input table | 1 | S03, §01 | Bad scale throws; `d=0` → 5000; `d = 0.45D` → exactly 0 |
| 17 | `calculateScore` gains `scaleKm` as 7th arg; speed-bonus regression tests | 1 | S03 | Missing arg throws with a message naming it |
| 18 | Repoint the acceptance spec at the real module, delete the temporary scorer, add the monotonicity property test | 1 | S03 | Feature file unchanged; S03 exit criteria met |
| 19 | `shape` on `state` / `vsState` / `suState`; wire the three lobby region grids to set it | 2 | S04 | All three lobbies set a shape; `reset()` behaviour decided and tested |
| 20 | Thread `scaleKm` into all four `calculateScore` call sites; delete `MAX_GUESS_DISTANCE` | 1 | S04 | `grep MAX_GUESS_DISTANCE` empty; no call site without a scale |
| 21 | Guest-side shape: `vs-round.js:126` and `su-guest.js` ×3 | 1 | S04 | Guests score identically to the host |
| 22 | `region-scoring.feature` + bindings (five scenarios across Classic, VS, Stitch Up) | 2 | S04 | Green with the numbers from §01 |
| 23 | Audit `js/awards.js` for absolute-distance thresholds; fix or record why not | 1 | S04 | Written finding, even if "nothing to change" |
| 24 | **Playtest and decide.** Five rounds World, five UK, one VS, one Stitch Up. Set `CURVE_EXPONENT`. | 1 | S04, §01 | A decision recorded in §01, and the list is replaced |

**24 items, 30 evenings.** At three evenings a week that is about ten weeks to the
scoring decision.

---

## Item 24 is the end of this list

When it is done, this file is **replaced** — not appended to. Write the next list
from what the playtest taught you, drawing on
[05-conceptualization/](05-conceptualization/) S05 onward. Do not pre-write it.

## Two things to know before you start

**Nothing is player-visible until item 24.** Twenty-three items of geometry,
scoring and tests, then one evening where you finally see it. On a project you
build for fun that is a real risk, and TOSD is unusually alert to it — "the day's
work is done" is named as the point of the whole method.

The legal reordering, if that becomes a problem: the draw screen (S05–S06)
depends only on item 14, not on the scorer. You can run it after item 15 and have
something on screen four weeks earlier, at the cost of building the drawing UI
before knowing whether the scoring feels right. Both orders are defensible. The
list above is correctness-first because item 24 can change `CURVE_EXPONENT`, and a
scale readout on the draw screen is one of the things that would have to be
redone if it does — but if ten weeks of invisible work is what makes this stall,
reorder it and accept the rework. Decide once, now, and don't revisit it at item 12.

**Items 5, 6, 11 and 19 are the ones that will overrun.** Not because they are
large — because each has a case that looks trivial and isn't: ray-casting through
a vertex (6), the WORLD bbox collapse (11), and `resetState` clobbering a custom
shape (19). They are boxed at 2 for that reason. If one hits three evenings, that
is the signal to stop and re-conceptualize, not to push on.

## Recording progress

One line per completed item, appended here. Not a burndown, not a board — TOSD
discards both. Just what was done and whether the box held, so that a pattern of
overruns is visible as a conceptualization problem rather than a personal one.

```
| # | Evenings actually | Box held? | Note |
|---|---|---|---|
| 1 | 1 | Yes | npm i pulled vitest 3.2.7 against a `^4.0.4` peer from vitest-cucumber — npm's arborist errored (`edgesOut`) on a plain install; `--legacy-peer-deps` resolved it clean to vitest@4.1.11 throughout. |
| 2 | 1 | Yes | Both failure modes observed: wrong Examples value fails with a clear expected/received diff; a commented-out `Then` step fails the whole file with "Missing steps in Scenario". Both reverted, suite green (2 files, 10 tests). |
| 3 | 1 | Yes | mulberry32 in test/support/rng.js. Same-seed/different-seed/range tests all green. |
| 4 | 1 | Yes | `test.yml` added (push+PR gate). `needs: test` across workflow files isn't valid GH Actions (needs only crosses jobs in the same workflow), so deploy.yml instead runs `npm ci` + `npm test` as steps before build — deploy still cannot go out red. Also switched `npm install`→`npm ci` in deploy.yml. |
| 5 | 1 | Yes | `js/geo/polygon.js`: `unrollRing` walks the ring accumulating the minimal per-edge delta (`diff - round(diff/360)*360`); `normalisePointTo` shifts by whole multiples of 360 toward the ring's lng midpoint (`min+max)/2`). All contract cases green. |
| 6 | 1 | Yes | `pointInRing`: explicit `isOnSegment` boundary check runs before the even-odd ray cast, so vertex/edge hits short-circuit to true and the `(yi>y)!==(yj>y)` form avoids the double-count on the diamond's ray-through-vertex row. All 8 contract cases green (30 tests total). |
| 7 | 1 | Yes | `ringBbox` + `containsPoint` added; `polygon.js` is now 147/150 lines — item 8 (`ringIsSimple`) will need to split into `polygon-validate.js` per the S01 exit criteria. Property test: 20 random star-shaped rings x 250 points agree between the bbox-gated path and the raw ray cast (5000 total, all green). |
| 5-7 follow-up | 0.5 | Yes | Opus review of items 5-6 (no Critical issues) surfaced real Important gaps: contract's own worked example unasserted, the ≤180° test was near-vacuous, one `normalisePointTo` branch uncovered against S01's 100%-branch exit criterion, and an undocumented `normalisePointTo` span<360 precondition. All fixed: canonical-example test, an adversarial-delta table + seeded property test, empty-ring test, `dot<0` collinear-before-segment test, JSDoc preconditions, tie-break comment, `not.toBe` copy checks. `js/geo/polygon.js` now 100% branch/line/func coverage. Two review notes deferred to Jack rather than fixed unilaterally: 02-geometry-contracts.md doesn't say who owns the latitude clamp to [-85.05, 85.05], and the "never >180° apart" rule doesn't explicitly except the closing edge of a wide ring — both are plan-doc ambiguities, not code defects. |
| 8 | 1 | Yes | New `js/geo/polygon-validate.js` (the S01-sanctioned split — `polygon.js` had hit 147/150 before this item, would've blown the limit). `ringIsSimple`: blanket pairwise duplicate-vertex check, then O(n²) non-adjacent segment intersection (orientation test + collinear-overlap fallback). All 5 contract cases green, plus 2 extra overlap/T-junction tests. `polygon-validate.js` sits at ~93% branch, not 100% — two sub-branches of the collinear-disjoint-segments case in the private `segmentsIntersect` helper proved fiddly to hit with hand-built ring geometry without risking incidental extra intersections elsewhere in the ring; judged not worth further box time. Trimmed `polygon.js`'s JSDoc after the item 5-7 follow-up pushed it to 156/150 lines — back to 147. |
| 9 | 1 | Yes | `play-area-bounds.feature` + bindings, all 5 scenarios (incl. the date-line one) green first try — the box-corner-to-unrolled-ring math ((sw,ne) -> 4-vertex ring -> unrollRing -> ringBbox) was hand-verified before writing code. S01 exit criteria met in full: 5/5 scenarios, `polygon.js` 100% branch, bbox-vs-raw-raycast property test (item 7), both geo files under 150 lines, no `Math.random()`/no imports beyond bare. `polygon-validate.js` remains at ~93% branch (noted at item 8, not closed here). |
| 10 | 1 | Yes | S02 begins. New `js/geo/polygon-measure.js` (continuing the split pattern — S02's doc says "add to polygon.js" but that file is already at 147/150). `densifyRing`: push each edge's start vertex, then interior points at `t = s/segments` for `s` in `[1, segments)`, never `t=1` — that's what guarantees no closing duplicate while still covering the closing edge (edge `n-1` back to vertex 0). All 4 contract cases green plus a 2-vertex degenerate-ring test. |
| 11 | 1 | Yes | Wrote the WORLD test first against a deliberately naive vertex-only `diameterKm` and watched it return 14455.34 as predicted — confirmed the trap is real before fixing it. Real implementation is max pairwise haversine over `densifyRing`'s output (local haversine helper in `polygon-measure.js`, not imported from `js/scoring.js` — geo stays dependency-free). All 7 regions match ±20km, 2-vertex degenerate ring, monotonicity, and a 24-vertex/2deg perf assertion (well under 100ms) all green. File sits at 82/150 lines. |
| 12 | 1 | Yes | `randomPointInShape` added to `polygon-measure.js`, which now genuinely needs imports (`containsPoint` from `polygon.js`, new `CUSTOM_MAP.SAMPLE_ATTEMPTS: 60` from `config.js`) — first geo file to break the self-imposed zero-import discipline, and correctly so per 02-geometry-contracts.md (only `polygon.js` itself is required dependency-free). 1000-draw containment property test with the seeded rng, first-attempt-success on a square with a fixed rng (asserts exact call count of 2), and a thin diagonal-sliver ring that returns `null` after exhausting the budget (asserts call count == SAMPLE_ATTEMPTS*2 exactly). File sits at 107/150 lines. |
| 7-11 follow-up | 0.5 | Yes | Opus review of items 7-11 surfaced one Important, real finding worth flagging now rather than later: the WORLD diameter test (item 11) deliberately uses the RAW bbox ring (not `unrollRing`'d), because WORLD's 360-degree lng span collapses to a degenerate ring once unrolled — documented in code and flagged as a hard constraint for item 14's `shapes.js` (must not unroll WORLD's ring). Also fixed: `ringIsSimple` is planar/frame-dependent and its unrolled-input precondition was undocumented — added to JSDoc and 02-geometry-contracts.md, plus a dateline test proving the raw-vs-unrolled trap directly (`ringIsSimple` gives the wrong answer on a raw antimeridian-crossing ring). `densifyRing` now throws on `stepDeg <= 0` instead of looping forever (real latent bug, not just a test gap). Weakened assertions tightened: the two-vertex diameter case now asserts the exact haversine value (1111.95km), the closing-duplicate test now counts occurrences instead of `not.toEqual`, and a swapped `it.each` title format string is fixed. Widened the item-7 bbox property test's ring-centre range to +-200 so some rings actually exercise an unrolled `bbox.east > 180`. All 87 tests green; `polygon-measure.js` 141/150, `polygon-validate.js` 82/150, `polygon.js` unchanged at 147/150. |
| 13 | 1 | Yes | `areaKm2`: shoelace on an equirectangular projection (lng scaled by `cos(meanLat)`), no imports. UK bbox comes out ~632,000km2, within the doc's deliberately loose ±10% (630,000-770,000) band. Degenerate (<3 vertex) ring returns exactly 0. |
```
