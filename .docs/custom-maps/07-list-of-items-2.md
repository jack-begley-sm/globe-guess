# 07 — List of Items (2)

**Keeper:** Jack. **Box unit:** one evening ≈ 2–3 hours. **Boxes:** 1, 2 or 3 only.

This is the second List of Items, replacing
[06-list-of-items.md](06-list-of-items.md) per its own rule and
[04-tosd-working-model.md](04-tosd-working-model.md): a list runs to a stated
end, is completed, and is replaced — not extended and not left to trail off.
06's list ran through the scoring migration (items 1–24); item 24 itself was a
**decision without a playtest** (Jack chose to skip it and keep
`CURVE_EXPONENT = 2` — see 01-scoring-model.md's "Item 24 decision" section).
Nothing player-visible from Custom mode exists yet: everywhere in the app still
only offers the seven built-in regions.

**This list ends when solo Custom mode is fully playable** — draw an area, play
a full game in it, see sensible results — covering conceptualization groups
S05 through S09. That is a real, played milestone, the same kind list 1 ended
on. VS mode (S10), Stitch Up (S11), edge-case hardening (S12), and polish
(S13) are already fully conceptualized in
[05-conceptualization/](05-conceptualization/) and deliberately **not** listed
here — they become list 3 once this one is done and S09 has actually been
played, for the same reason list 1 didn't pre-write S05 onward.

**Before starting any item, run the OK Point checklist** in 04-tosd-working-model.

---

## The list

Order is dependency order. Items with the same prefix may be reordered among
themselves; across prefixes they may not. S08 is independent of S06/S07 and
may run in parallel with them if you want a second thread of work.

| # | Item | Box | Conceptualized in | Done when |
|---|---|:--:|---|---|
| 1 | `CUSTOM_MAP` limits in config; `createDraft()`/`addPoint` happy path; `points`/`undo`/`clear` | 1 | S05 | Happy-path `addPoint` green; `undo`/`clear` on an empty draft are no-ops, not throws |
| 2 | `addPoint` rejection codes (`TOO_FEW`, `TOO_MANY`, `SELF_CROSSING`, `WOUND_ROUND_WORLD`) each isolated; rejected taps leave `points` unchanged | 2 | S05 | Every code has its own test; self-crossing checked on every add, not only at close |
| 3 | `status()`/`close()` + `makeCustomShape` integration + `TOO_SMALL`; convex-hull property test; `drawing-rules.feature` + bindings | 2 | S05 | All 8 scenarios green; `js/custom-draft.js` under 150 lines, imports nothing from Leaflet/DOM/`js/state.js` |
| 4 | `index.html` `screen-custom-draw` + Custom landing tile; `js/custom-map.js` Leaflet adapter (click → draft, redraw, ring polygon, vertex markers, world-with-a-hole mask) | 2 | S06 | Tapping the fake map builds up the area; the mask renders with the hole in the right place |
| 5 | `js/custom-lobby.js` (buttons, reason-code → English hint mapping, confirm → `state.shape`, screen transitions); `main.js` wiring | 1 | S06 | Confirming carries the area into game options; going back discards the drawing cleanly |
| 6 | `test/support/fakes/leaflet.js`; `draw-screen.feature` + bindings in jsdom; manual phone-viewport pass | 2 | S06 | All scenarios green; `grep` confirms no `MIN_`/`MAX_`/`ringIsSimple` lives in `js/custom-map.js` |
| 7 | `test/support/fakes/google-maps.js` (scripted pano table); `getRandomLocation`/`initStreetView` take a `shape`, not a region name — update `js/round.js`'s three call sites | 2 | S07 | Fake answers a scripted pano at an exact offset and radius; no real network call |
| 8 | Radius-ladder capped by `shape.scaleKm * CUSTOM_MAP.MAX_SEARCH_FRACTION`; containment re-check + resample backstop after `findNearestOutdoor` | 1 | S07 | A pano beyond the cap is never requested; a pano outside the shape triggers a resample |
| 9 | `NoStreetViewInArea` typed error; `js/round.js`'s catch routes back to the draw screen with the draft restored; photosphere-vs-outside-area retries distinguished, 20-attempt budget kept | 2 | S07 | An ocean polygon surfaces the "no street view" message within ~10s in test, not never |
| 10 | `features/locations-in-area.feature` + bindings (5 scenarios); pre-fetch tagged with the shape it was started for, stale one discarded on mismatch; `MIN_AREA_KM2` revisited | 2 | S07 | All scenarios green, including "built-in regions still work"; S07 exit criteria met |
| 11 | `js/map-overlay.js`: `drawShapeOverlay` (outline + mask, no-op for WORLD) + `guardClick`, unit-tested against the Leaflet fake | 2 | S08 | Mask winds opposite the outer ring (else it renders filled black); WORLD produces no mask |
| 12 | Wire `map-overlay.js` into `js/map.js` (Classic): `resetMap(shape)`, `placeMarker` rejects outside taps, collapsed-tap-expands-first preserved | 1 | S08 | Outside taps place nothing; the existing "first tap just expands" behaviour is unchanged |
| 13 | Wire into the VS/Co-op guess map (`vs-round.js:283`/`:318`) and the Stitch Up guesser map (`su-guesser.js:57`) — same treatment, not copied three times | 2 | S08 | No overlay/guard logic duplicated across the three call sites |
| 14 | `features/guessing-in-area.feature` + bindings, incl. the four-mode `ScenarioOutline` | 1 | S08 | All scenarios green including all four mode rows; S08 exit criteria met |
| 15 | Thread `state.shape` through `startGame` → `getRandomLocation` → `initStreetView` → `calculateScore`; results screen gains a scale/cutoff line | 2 | S09 | Results show "Area: X km across — anything over Y km scored zero" |
| 16 | `resetState()` vs "Play Again" shape-survival decision, tested both ways; `NoStreetViewInArea` surfaced instead of swallowed in `startRound`'s `.catch` | 1 | S09 | Play Again keeps the shape; returning to the landing screen clears it; both tested |
| 17 | `features/custom-solo-game.feature` + bindings (7 scenarios) against the scripted Google Maps fake, scores recomputed not copied | 2 | S09 | All scenarios green with real numbers; no `console.error` in a clean run; S09 exit criteria met |

**17 items, 28 evenings.** At three evenings a week that is about nine to ten
weeks to a fully playable solo Custom mode.

---

## This list ends at item 17

When it is done — and played — this file is **replaced**, not appended to.
Write the next list from S10 onward, informed by whatever the solo playtest
teaches you about `CUSTOM_MAP.MIN_AREA_KM2`, the draw screen's feel, and
whether `CURVE_EXPONENT` still seems right once you're scoring against a
player-drawn 5km area rather than a fixed region. Do not pre-write S10–S13's
items now — that is exactly the mistake 04-tosd-working-model.md's "no
estimation" rule exists to prevent.

## Two things to know before you start

**Nothing is player-visible until item 4.** Three items of pure drawing-rule
logic, then the first evening you actually see a map. Shorter than list 1's
23-items-before-anything-shows-up, but the same risk in miniature.

**S07 (items 7–10) is called "the highest-risk group in the plan" by its own
conceptualization doc**, and item 2 carries the same self-crossing-checked-
on-every-add subtlety that made items 5, 6, 11 and 19 overrun on list 1 — the
open polyline during drawing has no closing edge yet, and getting that wrong
makes the last leg of every normal polygon look self-crossing. If either
group hits three evenings on one item, that is the signal to stop and
re-conceptualize, not to push on.

## Recording progress

One line per completed item, appended here. Not a burndown, not a board — TOSD
discards both. Just what was done and whether the box held, so that a pattern
of overruns is visible as a conceptualization problem rather than a personal
one.

```
| # | Evenings actually | Box held? | Note |
|---|---|---|---|
| 1 | 1 | Yes | New `CUSTOM_MAP` limits (`MIN_VERTICES: 3`, `MAX_VERTICES: 24`, `MIN_AREA_KM2: 25`) added alongside the existing `SAMPLE_ATTEMPTS`/`DENSIFY_STEP_DEG`. New `js/custom-draft.js`: `createDraft()` returns a closure over a private `points` array; `points` getter returns a mapped copy so external mutation of a snapshot can't touch draft state (tested directly — push onto a returned snapshot, assert the draft is unaffected). `addPoint` happy path always `{ ok: true }` for now — no validation yet, that's item 2. `undo` on empty is `Array.pop()` on an empty array, which is already a safe no-op in JS, so "no-op not a throw" held for free. 7 tests green, file at 55/150 lines, zero imports (DOM/Leaflet/state-free, per S05's exit criteria — verified early since item 3 is what actually checks this on the whole file). |
| 2 | 1 | Yes | **Correction to this item's own title**: `TOO_FEW` turned out to belong to `status()`/`close()` (item 3), not `addPoint` — checked the acceptance scenario text again before coding and confirmed both taps in "Two points are not enough" succeed; it's *closing* with too few points that's rejected, not the second tap itself. So this item implements 3 codes, not 4: `TOO_MANY` (`points.length >= MAX_VERTICES`, cheapest check, first), `WOUND_ROUND_WORLD` (unroll the candidate-extended path, reject if lng span >= 360, matching `unrollRing`'s own documented invariant), `SELF_CROSSING` (new `pathIsSimple(path)` in `polygon-validate.js` — an open-polyline sibling to `ringIsSimple` with no closing edge, exactly the distinction S05's own warning calls out; proved the distinction with a test where an A-B-C-D path is `pathIsSimple`-true but `ringIsSimple`-false, since only the closing edge D-A creates the crossing). All 3 of S05's own worked examples (the self-crossing 4-tap case, the wound-round-world 4-tap case) reproduced exactly as specified, first run, no adjustment needed — confirms the unroll-based approach was right without having to hand-trace the arithmetic. Rejected taps verified to leave `points` unchanged in both new tests. `polygon-validate.js` now 113/150 lines, `custom-draft.js` 77/150. Full suite 183 tests, green. |
| 3 | 1 | Yes | S05 closed out. `status()` returns `{ canClose, reason?, vertexCount }`: `TOO_FEW` below `MIN_VERTICES`, else `TOO_SMALL` if `areaKm2(unrollRing(points))` is under `MIN_AREA_KM2` (25km2), else `canClose:true` — no need to re-check self-crossing/span here since `addPoint` already guarantees every point currently in the draft satisfies both. `close()` throws if `!status().canClose`, else returns `makeCustomShape(points)` from list 1's `js/geo/shapes.js`. Convex-hull property test: 20 seeded trials, points placed around a circle in angle order (guaranteed convex, so never self-crossing) at random center/radius/vertex-count, every `addPoint` succeeds and the final `status().canClose` is true — confirms the geometry composes correctly end to end, not just in isolation. `features/drawing-rules.feature` + bindings, all 8 scenarios green (31 sub-tests). One binding decision worth recording: the "shape crosses itself" scenario's Gherkin text ("the area cannot be confirmed") reads like a `status()`-time check, but per item 2's own exit criterion self-crossing is caught at the *offending tap itself* — after rejection only 3 valid points remain, which form a perfectly closeable triangle, so `status()` would wrongly say `canClose:true` if checked after the fact. Bound "the area cannot be confirmed" to the last `addPoint` call's own `{ok:false}` result instead, consistent with the very next scenario's own "the last tap is rejected" phrasing for the same category of event (add-time, not close-time) — the doc's two scenarios use inconsistent tenses for the same mechanism, not two different mechanisms. S05 exit criteria met in full: `custom-draft.js` 109/150 lines with a header, imports nothing from Leaflet/DOM/`js/state.js` (only `js/geo/*` and `js/config.js`), every rejection code (`TOO_FEW`, `TOO_MANY`, `SELF_CROSSING`, `WOUND_ROUND_WORLD`, `TOO_SMALL`) has its own test. Suite now 220 tests, all green. |
```
