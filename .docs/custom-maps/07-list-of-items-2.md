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
| 4 | 1 | Yes | S06 begins. **Scope moved earlier than drafted**: built `test/support/fakes/leaflet.js` as part of this item rather than item 6 — `js/custom-map.js` genuinely cannot be written or tested without something standing in for the global `L`, so the fake had to exist first; item 6 becomes acceptance-feature-and-bindings only, using this fake as-is. Fake covers `map`/`tileLayer`/`polygon`/`circleMarker`/`marker`/`latLng` — a `_layers` array on the fake map plus `kind`-tagged layers make "how many polygons/markers are on the map" trivially assertable, and `map.fire(event, payload)` simulates a Leaflet event without a real DOM. `js/custom-map.js`'s `initCustomMap(containerId, draft, opts)` forwards clicks to `draft.addPoint`, redraws unconditionally after (idempotent on rejection since `points` didn't change), and renders: vertex `circleMarker`s always, a ring `polygon` once >=2 points, and a world-with-a-hole mask `polygon` (`L.polygon([WORLD_RING, ring])`) once >=3 points. An optional `onAddPointResult` callback surfaces each `{ok, reason?}` outward without `custom-map.js` interpreting it — keeps the "decides nothing, just forwards" contract clean for `custom-lobby.js` (item 5) to own the hint-text mapping. `index.html`/landing-tile work deferred to item 5, where it naturally pairs with the lobby wiring that manipulates those same elements — the original item 4/5 split was along the wrong seam. 8 tests green first run (no adjustment needed). `custom-map.js` 63/150 lines; `grep -n "MIN_\|MAX_\|ringIsSimple" js/custom-map.js` empty, satisfying S06's "no rule lives here" exit criterion early. Suite now 228 tests, all green. |
| 5 | 2 | No | **Box overran (1 → 2)**: this item absorbed `index.html`'s new markup/CSS from item 4 (see item 4's note) plus its own scope, which was more than one evening's worth once actually done — `css/custom.css` (new) wasn't in this item's drafted title at all, but is in S06-draw-screen.md's own file list, so it belongs here regardless of the drafted box size. `index.html`: new `screen-custom-draw` (`#custom-map`, back button, hint, undo/clear/confirm controls) plus a `🖌️ CUSTOM` tile on the landing screen's mode-selector (not the Classic lobby's `.region-grid` — S06's acceptance scenarios choose Custom from the *home* screen directly, confirming lands you back in the Classic lobby with the region-grid swapped for an area summary). New `js/custom-lobby.js`: `initCustomDraw()` wires undo/clear/confirm/back and the landing tile; `handleAddPointResult` maps each of the 5 rejection codes to one line of English via a `REASON_TEXT` lookup (falls back to a generic line for any future code, so a missing entry degrades rather than shows nothing); `confirmArea()` calls `draft.close()`, sets `state.shape`/`state.region`, and swaps `#section-region` for `#custom-area-summary` in the (already-existing) Classic lobby. Caught one real bug before it shipped, not via a test but by tracing the flow by hand: if a player draws a Custom area, backs out, then enters Classic normally, the lobby would still show the stale area summary with the region-grid hidden — added `resetClassicLobbyRegionUI()`, called from `main.js`'s existing Classic-tile handler, to restore the plain view; `state.region`/`state.shape` themselves don't need an equivalent reset since `handleStart()` in `lobby.js` always overwrites both from whichever region button is marked `.active` in the now-visible grid. No unit tests for `custom-lobby.js` itself — matches the established pattern that DOM-orchestration files (`lobby.js`, `vs-lobby.js`) get acceptance-scenario coverage only, landing in item 6. `custom-lobby.js` 106/150 lines. `main.js` (288 lines) and this file were already over the 150-line limit before this session touched them — pre-existing debt, not addressed. Full suite still 228 tests, all green (no new tests this item; verified by smoke-importing `custom-lobby.js` directly in Node). |
| 6 | 1 | Yes | S06 closed out. `features/draw-screen.feature` + bindings, all 7 scenarios green (31 sub-tests) — the first acceptance spec to load the REAL `index.html` markup into jsdom (via `fs.readFileSync` + a body-extracting regex) and drive it through the real `js/custom-lobby.js`/`js/custom-map.js`, rather than testing pure logic. **Found and fixed a real, pre-existing config bug in the process**: `vitest.config.js`'s `environmentMatchGlobs` — the node/jsdom split every acceptance spec since list 1 item 1 has silently relied on — does not exist anywhere in vitest 4's type surface (confirmed by grepping the whole installed package; zero matches). It has been a silent no-op since the very first item of list 1, invisible only because no acceptance test needed real `document` until this one. Fix: dropped the split entirely, `environment: 'jsdom'` globally — coverage and all 259 pre-existing tests confirmed unaffected. Along the way, hit and fixed a second, subtler bug in *this test file's own first draft*: a `beforeEach` used to reset the DOM/re-attach listeners, not realising `@amiceli/vitest-cucumber` creates one Vitest `test()` per Gherkin STEP, not per scenario — so the `beforeEach` was wiping the DOM *between* a scenario's own Given/When/Then, not just between scenarios (a click in "When" would vanish before "Then" could see it). Fixed by moving the reset into the `Background`'s own `Given` callback instead, which runs once per scenario by cucumber's own semantics — the same pattern this session already used for plain-variable state, just not yet recognised as required for DOM state too; worth remembering for S07-S09's DOM-heavy specs ahead. `js/custom-map.js`'s "no rule lives here" grep still clean. Manual phone-viewport pass is explicitly Jack's to do, not mine — noted, not faked. Suite now 259 tests, all green. |
| 7 | 2 | Yes | S07 begins — "the highest-risk group in the plan" per its own doc. New `test/support/fakes/google-maps.js`: a `handler(request, callIndex)` function decides each `getPanorama` response (`{status:'OK', data}` or `{status:'ZERO_RESULTS'}`), so tests script "found at radius X" without needing to predict the exact sampled point. Found and fixed a real bug in the fake's own first draft before it ever ran against real code: `StreetViewPanorama.getLinks()` needs pano→links lookup by ID (the real API resolves links server-side from just a pano ID), so a `linksByPano` registry populated from `getPanorama`'s own scripted responses; without it, `isGoogleCarImagery`'s downstream `sv.getLinks()` check would silently always see 0 links. Found and fixed a second bug empirically (two tests initially took 4015ms each — the real 4000ms fallback timer firing): the fake's `StreetViewPanorama` only fired `pano_changed` from an explicit `setPano()` call, but `loadPanorama`'s first-time-panorama path sets `pano` via the *constructor options*, which never triggered the event — added the same `queueMicrotask`-scheduled fire to the constructor when `options.pano` is present, matching real Street View's actual behaviour for that path. `getRandomLocation`/`initStreetView` now take a `shape`, not a region name string; `generateRandomLatLng(region)` deleted entirely, replaced by `randomPointInShape(shape)` from list 1's `js/geo/polygon-measure.js` in both `tryRandomLocation` and `findValidCoords` — handled a case the old helper never had: `randomPointInShape` can return `null` (sampling budget exhausted on a thin shape), treated as a failed attempt and retried, same as a `findNearestOutdoor` miss. All 4 real call sites in `js/round.js` (not 3, per this item's drafted title — `getRandomLocation` x3 plus `initStreetView` x1, matching S07's own "~35, ~52, ~60, ~64" line references exactly) now pass `state.shape`. `REGIONS` import removed from `streetview.js` entirely (dead after the swap). 6 new tests, all against the fake, `getRandomLocation` proven to reject after 20 failed attempts and to answer at a specific scripted radius. Full suite now 265 tests, all green — this item's own exit bar ("fake answers a scripted pano at an exact radius; no real network call") met, though the fuller S07 exit criteria (radius cap, containment backstop, typed error, feature scenarios) are items 8-10, not this one. |
```
