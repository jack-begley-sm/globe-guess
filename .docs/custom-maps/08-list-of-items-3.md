# 08 — List of Items (3)

**Keeper:** Jack. **Box unit:** one evening ≈ 2–3 hours. **Boxes:** 1, 2 or 3 only.

This is the third List of Items, replacing
[07-list-of-items-2.md](07-list-of-items-2.md) per its own rule and
[04-tosd-working-model.md](04-tosd-working-model.md): a list runs to a stated
end, is completed, and is replaced — not extended and not left to trail off.
List 2 ended solo Custom mode being fully playable (S05–S09); its own closing
note deliberately left S10 onward unlisted until "this has actually been
played." It has now been played: Jack drew a small Custom area, played it, and
found two real problems — a scoring curve that punished near misses too hard
(already fixed, see [01-scoring-model.md](01-scoring-model.md)'s "Custom-mode
playtest decision"), and Custom being its own top-level mode instead of a
region choice inside Solo/VS/Co-op/Stitch Up like the built-in regions. That
second problem is what this list exists to finish — S10 through S12 are
already fully conceptualized in [05-conceptualization/](05-conceptualization/).

**This list ends when Custom is a genuine region choice in every mode** — Solo
(done as item 1, below), VS, Co-op, and Stitch Up all offer a "🖌️ Custom" tile
in their own region grid, host-drawn areas sync correctly to every guest, and
the awkward-area edge cases (dateline, polar, tiny, no-street-view, refresh)
all behave. Covers S10, S11, S12. S13 (polish) is **not** listed here for the
same reason S10–S12 weren't listed in list 2 — it becomes list 4 once this is
done and played.

**Before starting any item, run the OK Point checklist** in 04-tosd-working-model.md.

---

## The list

Order is dependency order. S11 depends on S10; S12 depends on S11.

| # | Item | Box | Conceptualized in | Done when |
|---|---|:--:|---|---|
| 1 | Custom becomes a region-grid tile in Solo's Classic lobby instead of a separate top-level landing mode; `js/custom-lobby.js` generalized to a mode-agnostic draw engine (`openCustomDraw(originScreenId, onConfirm)`) that Classic now calls, ready for VS/Co-op/Stitch Up to call the same way | 2 | S06 (retrofit) | Landing screen has no Custom tile; Classic's region grid does; confirming/going back both return to the Classic lobby, not the landing screen; full suite green |
| 2 | `test/support/fakes/peer.js` — `new Peer(code)` registers, `.connect(code)` returns a linked pair simulating `open`/`data`/`close` | 2 | S10 | A fake host and a fake guest can exchange a scripted payload in a unit test, no real network |
| 3 | VS lobby: Custom tile in `#vs-region-grid`; `CUSTOM` branch in `handleSetupNext` defers room creation until after the draw (draw → confirm → create room → share screen); re-host "Play Again" keeps the existing shape, does not redraw | 2 | S10 | Choosing Custom in VS opens the draw screen before any room exists; re-hosting after a game keeps the same area |
| 4 | Host: ring included in the `gameState` broadcast payload; guest: rebuild shape via `makeCustomShape(ring)` at the `playersUpdate` level (not only `resumeInProgressRound`), so a lobby guest has an area before kickoff too; assert host/guest `scaleKm` agree within 0.001 km | 2 | S10 | A guest joining before kickoff already has the correct play area; a guest joining mid-game does too |
| 5 | `vs-round.js`: `vsState.shape.scaleKm` into `calculateScore`; `getRandomLocation(vsState.shape)`; `resumeInProgressRound` sets the shape before `initVsMap()`; confirm `map-overlay.js`'s `guardClick`/outline are wired into the VS/Co-op guess map (S08 should already cover this — verify, don't re-wire if so) | 1 | S10 | All players in a round score against the same scale; a guest cannot guess outside the area |
| 6 | Session restore (`js/user.js`, `main.js`): ring persisted and rebuilt for VS host and VS guest; the host's "Next" button disabled during the drawing async gap so a double-tap can't create two rooms | 1 | S10 | Refreshing mid-game as host or guest restores the same play area; rapid double-click on Next creates exactly one room |
| 7 | S10 closed out: `features/custom-vs-game.feature` + bindings against the PeerJS fake, all 8 scenarios green — scores recomputed against the current `CURVE_EXPONENT` (1.5), not S10's own doc numbers (written against 2, now stale); Co-op mode explicitly exercised too, since it shares this code path | 2 | S10 | All scenarios green for both VS and Co-op; two real browser profiles confirm host and guest see the same outline and agree on score |
| 8 | Stitch Up lobby: Custom tile in `#su-region-grid`; `suState.shape` broadcast alongside `region` at all three existing send points in `js/su-host.js`; guest rebuilds the shape wherever it currently reads region in `js/su-guest.js` | 2 | S11 | A Stitch Up guest sees the host's drawn area at the same points region currently arrives |
| 9 | `js/su-setter.js`: `initSetterPhase(guesserName, shape)` draws the outline + mask on the setter's map; `placeSetterPin` rejects a tap outside the area before the Street View lookup | 1 | S11 | An outside tap is rejected with no Street View call made; an inside tap on a street is accepted |
| 10 | `autoPlaceLocation(shape)` uses the shape-aware `getRandomLocation`; `handleGuesserSubmit` passes `suState.shape.scaleKm` into `calculateScore` | 1 | S11 | An auto-placed round lands inside the area, 20 seeded runs; the guesser is scored against the custom scale |
| 11 | `js/su-guesser.js` (the guesser's own map, not `js/map.js`) wired to `map-overlay.js`; spectator/reveal maps get the outline for context with no click guard; investigate `js/su-setter.js`'s `worldCopyJump: true` against a Pacific-spanning custom area and decide/fix per S11's "watch out for" | 2 | S11 | A guesser cannot guess outside the area; a tap at lng 190 after a world-copy pan still resolves against the correct side of the area |
| 12 | S11 closed out: `features/custom-stitch-up.feature` + bindings, all 6 scenarios green — scores recomputed against the current `CURVE_EXPONENT`; the auto-place `* 1.5` bonus cap and zero-setter-score-on-autoplace re-verified | 2 | S11 | All scenarios green; a three-player manual game in a city-sized area is Jack's to play and confirm |
| 13 | Dateline full-path test: draft → shape → sampling → containment → score for an area spanning 170E–170W, exercising `unrollRing`, `normalisePointTo`, the bbox, and Leaflet's over-pan wrap together | 2 | S12 | A location is found inside the area; a guess at 179E is accepted; a guess at 150E is rejected |
| 14 | Polar handling: **decide**, don't discover — recommended is clamping latitude to ±85.05° at tap time so the area is a band, not a true cap; implement whichever is chosen and rewrite S12's "either/or" scenario to the actual decided branch | 2 | S12 | The scenario asserts one concrete outcome, not "either"; an area drawn over the pole behaves per that decision |
| 15 | Session-restore audit across all five paths (solo, VS host, VS guest, Stitch Up host, Stitch Up guest); a stored session with `region: 'CUSTOM'` and no ring falls back to the landing screen, not silently to WORLD | 2 | S12 | All five paths tested; the corrupt-state case is an explicit test, not an assumption |
| 16 | Concave C-shape sampling property test (200 draws, none in the gap); geometry fuzz — 500 seeded random rings through `unrollRing` → `ringIsSimple` → `diameterKm`, no throws, no `NaN`, no negative or infinite scale | 1 | S12 | Both property tests pass reliably across reruns (seeded, not flaky) |
| 17 | S12 closed out: `features/awkward-areas.feature` + bindings, all 6 scenarios green including the rewritten polar one | 1 | S12 | All scenarios green; manual Pacific-area-on-phone pass is Jack's to do, noted not faked |

**17 items, 26 evenings.**

---

## This list ends at item 17

When it is done — and played across at least one real VS/Co-op game and one
real Stitch Up game — this file is **replaced**, not appended to. S13 (polish)
becomes list 4, informed by whatever playing multiplayer Custom teaches about
feel, timing, and whether any of the numbers still need another look.

## Two things to know before you start

**Item 1 already landed** (see Recording progress) — Solo's own entry point
needed the same "region tile, not top-level mode" treatment before VS/Stitch
Up could reuse the pattern consistently, and doing it first means items 3 and
8 build on a `custom-lobby.js` that's already generic instead of touching it
twice.

**Every illustrative score number in S10 and S11's own conceptualization docs
was computed against the original `CURVE_EXPONENT = 2`**, before the
Custom-mode playtest lowered it to 1.5. Items 7 and 12 must recompute their
exact expected scores against the *current* formula, the same discipline list
2's item 17 established — do not copy S10/S11's doc numbers directly, they
will be wrong.

## Recording progress

One line per completed item, appended here. Not a burndown, not a board — TOSD
discards both. Just what was done and whether the box held, so that a pattern
of overruns is visible as a conceptualization problem rather than a personal
one.

```
| # | Evenings actually | Box held? | Note |
|---|---|---|---|
| 1 | 1 | Yes | `js/custom-lobby.js` rewritten from a Classic-specific module into a generic draw engine: `openCustomDraw(originScreenId, onConfirm)` replaces the old `btn-mode-custom`-bound `openDrawScreen()`, storing the caller's origin screen and confirm callback in module state instead of hardcoding `screen-landing`/`screen-lobby`. `confirmArea()`/`backToOrigin()` (renamed from `backToHome()`) both now return to `returnScreenId` instead of a fixed screen. `js/lobby.js` gained `handleCustomAreaConfirmed(shape)` — the Classic-specific reaction (set `state.shape`/`region`, hide the region-grid section, show the area summary) that used to live inside `custom-lobby.js` itself; `setupGridSelection` special-cases `data-region === 'CUSTOM'` to call `openCustomDraw('screen-lobby', handleCustomAreaConfirmed)` instead of the normal instant-active-toggle every other region tile gets. `index.html`: removed the landing screen's standalone `btn-mode-custom` tile; added a `🖌️ Custom` button to `#section-region .region-grid` alongside the seven built-in regions. One real behavior change, not just relocation: going back from the draw screen (or a rejected confirm) now returns to the Classic lobby, not the true landing page — correct for a screen that's now entered from inside the lobby, but it changed `features/draw-screen.feature`'s "Going back... returns home" scenario, renamed to "...returns to the game options" reusing the confirm scenario's own "the game options screen is shown" step text. Three test call sites updated: `draw-screen.spec.js`'s `clickCustomTile()` helper now simulates already being in the Classic lobby (main.js's own landing→lobby navigation isn't this file's concern) before clicking the grid's Custom tile, and needed `initLobby()` added to `resetWorld()` so the grid's click handler exists at all; its "Pressing START..." describe block updated the same way; `locations-in-area.spec.js`'s one call site simplified to call `customLobby.openCustomDraw()` directly with a minimal inline `onConfirm`, since that scenario is about streetview/round behavior, not lobby wiring. Verified end to end in a real browser (`vite` dev server, not just jsdom): landing page shows four mode tiles with no separate Custom entry; Classic's region grid shows a `🖌️ Custom` tile among World/UK/Europe/etc.; clicking it opens the draw screen; drawing a triangle and confirming returns to the Classic lobby with "Custom area: about 5918 km across" shown in place of the grid. Full suite green throughout (390 tests, no count change — this item touched existing coverage, added none new). VS/Stitch Up's own region grids (items 3, 8) are untouched by this item; they get their own Custom tile later, reusing `openCustomDraw` rather than duplicating this pattern. |
| 2-7 | 1 | Yes | Executed as one continuous plan (`d79d00c` "docs: add implementation plan for VS/Co-op custom mode"), one item per commit-group, not across separate calendar evenings — the box's 2–3-hour unit still held in scope even though it collapsed into a single sitting. **Item 2** (`8448714`, header fix `58d7e6a`): `test/support/fakes/peer.js` — an in-memory `Peer`/`connect` fake where `new Peer(code)` registers and `.connect(code)` returns a linked pair simulating PeerJS's `open`/`data`/`close`, no real network in any test since. **Item 3** (`065e8e9`): VS lobby got a `🖌️ Custom` tile in `#vs-region-grid`; `handleSetupNext`'s `CUSTOM` branch now defers `createRoomAndShowShareScreen` until `openCustomDraw`'s `onConfirm` fires, with `btn-vs-setup-next` disabled for the whole drawing gap so a rapid double-tap can't create two rooms; re-hosting ("Play Again") keeps the existing shape by checking `vsState.roomCode` before ever reading the region grid. **Item 4** (`94bd1bb`): host broadcasts the custom ring inside every `gameState` payload (not just at kickoff); guest rebuilds it via `makeCustomShape(ring)` at the `playersUpdate` level too, so a guest sitting in the lobby before the game starts already has the correct area, not just one who joins mid-round. **Item 5** (`6e2eb71`): confirmed `vs-round.js` already threads `vsState.shape.scaleKm` into `calculateScore` and `getRandomLocation`, and that `map-overlay.js`'s `guardClick`/outline were already wired into the VS guess map from list 2 item 13 — this item was verification plus acceptance coverage, not new wiring. **Item 6** (`6d93aef`, `84de88d`): VS host's custom shape now round-trips through `js/user.js`'s session persistence and `main.js`'s restore path; the restore scenario exercises a fresh import of the real `main.js` end to end (firing `DOMContentLoaded` against jsdom) rather than re-deriving an equivalent shape locally, so it catches a break in the actual restore wiring, not just a re-implementation of it. **Item 7** (this task, `features/custom-vs-game.feature` scenario 11 + binding): appending the Co-op scenario surfaced a real bug, not a pre-existing gap in coverage — `js/vs-round.js`'s `onAllGuessesReceived()` correctly computed each player's individual score first, then in the `vsState.gameMode === 'coop'` branch overwrote every `player.scores[round]` to the team's best score, but `showRoundReveal()` runs synchronously right after and re-applies scores from `roundResults.guesses[peerId].score` — which the coop branch had left at each player's original individual score. That silently clobbered every non-closest player's score back down a moment after the coop overwrite, and it hid behind the closest player: their individual score already equalled the team's best, so they looked fine while everyone else came out wrong (confirmed by a forced-fail: `players[0].scores[0]` was `4190` as expected, `players[1].scores[0]` was `962`, the guess's own individual score, not `4190`). Fixed by also overwriting `roundResults.guesses[player.peerId].score` inside the same coop `forEach`, so the reveal step (which is what guests actually see, since they never ran the scoring math themselves) re-applies the correct team score instead of clobbering it. AGREE pass over the whole feature file found nothing else wrong — no DOM ids in any scenario text, both scoring scenarios use the current 4190/962 (not S10 doc's stale 3951/556), no scenario over 4 steps. All 11 scenarios (37 step-tests) in `custom-vs-game.feature` green; full suite 431 tests / 27 files green. Honest gap, found on later review: the ring-sync scenarios (item 4's guest-receives-the-area coverage) assert the wire payload and the pure `makeCustomShape` function via a raw `FakePeer`, not the real `js/vs-guest.js` module's own `playersUpdate`/`resumeInProgressRound` rebuild logic — actually driving the real guest module (needed here and, per this doc, for item 8's Stitch Up guest too) is deferred rather than built twice. |
```
