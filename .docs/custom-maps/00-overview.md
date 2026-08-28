# 00 — Overview

## The feature in one paragraph

Add a fourth mode, **Custom**, alongside Classic, VS/Co-op and Stitch Up. Before
play begins the player draws a closed polygon on a world map. Every Street View
location for that game is sampled from inside the polygon, the guess map refuses
pins outside it, and the score for a guess is scaled against the polygon's own
size rather than a fixed global curve. Draw a polygon around Greater Manchester
and a 12 km miss is a bad guess; draw one around Eurasia and a 12 km miss is
near perfect. The same scaling then also applies to the seven built-in regions,
which become polygons like any other play area.

## Why the scale change matters more than the drawing

The drawing UI is the visible half of this feature; the scoring change is the
half that makes it worth building. Today `scoreFromDistance` is:

```js
// js/scoring.js — current
const normalizedDist = dist / MAP_SETTINGS.MAX_GUESS_DISTANCE; // 2000 km, always
return MAX_SCORE * Math.pow(1 - normalizedDist, 2);
```

That constant is the reason a UK game feels flat: the entire country fits inside
1171 km, so almost every guess lands in the top of the curve. Custom mode would
be unplayable under it — a 40 km polygon would score 4950 for a guess at the
opposite corner. So the scale must become a property of the play area, and once
it is, there is no reason to keep the fixed curve for the built-in regions either.

The full maths, the numbers, and the (significant) effect on existing modes are
in [01-scoring-model.md](01-scoring-model.md). **Read that before writing code** —
the World region gets noticeably more generous and you should decide whether you
want that before it ships.

## Screen flow

### Solo (Classic → Custom)

```
screen-landing
   │  tap "Custom"
   ▼
screen-custom-draw          ← NEW. Full-screen Leaflet map.
   │  tap vertices → ring auto-closes → "USE THIS AREA"
   ▼
screen-lobby                ← EXISTING, reused. Region grid replaced by an
   │  name / rounds / time /  "area summary" card when arriving from Custom.
   │  speed bonus → START
   ▼
screen-game                 ← EXISTING. Guess map now shows the polygon.
```

The draw screen sits **before** the options lobby, so the polygon is known when
`startGame()` fires and location pre-fetching can begin immediately.

### VS / Co-op

```
screen-landing → screen-vs-setup (name, rounds, region incl. "Custom")
   │  if region === CUSTOM → screen-custom-draw
   ▼
screen-custom-draw → screen-multiplayer-share → screen-multiplayer-lobby
```

Per the brief, the polygon is fixed **before the lobby exists**. Guests never
draw; they receive the ring. Practically this means the host's `handleSetupNext`
in `js/vs-lobby.js` gains a branch: when the chosen region is `CUSTOM`, route to
the draw screen and only generate the room code / call `initHost` once the
polygon is confirmed. That ordering matters — it guarantees no guest can connect
to a room whose play area is undefined.

### Stitch Up

Same as VS: host draws before the room exists. Additionally the **setter's** map
(`js/su-setter.js`) is constrained to the polygon, and `autoPlaceLocation` samples
inside it.

## Module map

New files. All obey the CLAUDE.md rules: header comment, ≤150 lines, constants in
`js/config.js`, state only in the `*-state.js` files.

| File | Purpose | Depends on |
|---|---|---|
| `js/geo/polygon.js` | Pure geometry. Unrolling, point-in-polygon, ring validity, bbox, densify, diameter, random point sampling. No DOM, no Leaflet, no state. | nothing |
| `js/geo/shapes.js` | Turns a region name or a custom ring into a `Shape` object (`{ id, ring, bbox, scaleKm }`). Memoises the built-in seven. | `polygon.js`, `config.js` |
| `js/custom-draft.js` | The drawing **model**: `addPoint`, `undo`, `clear`, `canClose`, `validate`. Pure, headless, fully unit-testable. | `polygon.js`, `config.js` |
| `js/custom-map.js` | Leaflet **adapter** for the draw screen. Renders the draft, dims the exterior, wires taps. Contains no rules. | `custom-draft.js` |
| `js/custom-lobby.js` | Wires `screen-custom-draw` — buttons, validation messages, handoff to solo lobby / VS setup / SU setup. | `custom-map.js`, `custom-draft.js`, the three `*-state.js` |
| `js/map-overlay.js` | Shared Leaflet helper: draw a shape's outline + dimmed exterior on any map, and a `guardedClick(shape, handler)` wrapper that swallows taps outside the shape. Used by **all five** existing maps. | `polygon.js` |

The draft-model / Leaflet-adapter split is the single most important structural
decision here. Every rule about polygons (minimum vertices, self-intersection,
minimum size, "is this point allowed") lives in code that never touches `L.*`,
which is what makes the whole feature testable in jsdom without a map library.

## Changes to existing files

| File | Change | Risk |
|---|---|---|
| `js/config.js` | Add `REGION_RINGS` (derived from `REGIONS`), `SCORING` (`CUTOFF_RATIO: 0.45`, `CURVE_EXPONENT`), `CUSTOM_MAP` (vertex min/max, min area, sampling budget). Keep `REGIONS` — Street View bbox sampling still uses it. | low |
| `js/scoring.js` | `scoreFromDistance(dist, scaleKm)` — new required second argument. `calculateScore` gains a `scaleKm` parameter. **Four call sites**: `js/round.js`, `js/vs-round.js:410`, `js/su-host.js:385`, and `js/su-host.js` setter scoring. | **high** — silent regression if a call site is missed. Group S03 makes the parameter mandatory so a missed site throws rather than scoring wrong. |
| `js/state.js` | Add `shape` (the active `Shape`), keep `region` as the label. Reset restores `WORLD`. | low |
| `js/vs-state.js`, `js/su-state.js` | Same, plus the ring must survive `reset()` so "Play Again" keeps the drawn area. | medium |
| `js/streetview.js` | `getRandomLocation` and `initStreetView` take a `Shape` instead of a region name. `generateRandomLatLng` samples the bbox then rejects points outside the ring. `findNearestOutdoor`'s radius ladder is capped by the shape so a pano can't be found 500 km outside a small polygon; the returned pano is re-checked for containment. | **high** — this is where a small polygon silently becomes a world game. Group S07. |
| `js/map.js` | Classic guess map: polygon overlay + reject clicks outside in `placeMarker`. | medium |
| `js/vs-round.js` | **VS/Co-op has its own guess map** (`initVsMap`/`placeVsMarker`, lines 283–345) — it does not use `js/map.js`. Same overlay + rejection needed here. | medium |
| `js/su-guesser.js` | **Stitch Up has a third guess map** (`js/su-guesser.js:57`). Same again. | medium |
| `js/round.js` | Pass `state.shape` through to Street View and scoring. | low |
| `js/vs-lobby.js` | `CUSTOM` region routes to the draw screen before room creation. | medium |
| `js/vs-host.js` | Include `ring` in the `playersUpdate` `gameState` payload (`broadcastPlayers` at line 132, payload at line 140). | medium |
| `js/vs-guest.js`, `js/su-guest.js` | Rebuild the `Shape` from a received ring. | medium |
| `js/su-setter.js`, `js/su-host.js` | Constrain setter pin and `autoPlaceLocation` to the shape. | medium |
| `js/user.js` (session) | Persist the ring so a refresh mid-game doesn't drop the play area. | low |
| `index.html` | New `screen-custom-draw`; a "Custom" tile in the landing grid and in all three region grids. | low |
| `css/map.css` (or new `css/custom.css`) | Polygon styling, exterior mask, vertex handles, draw toolbar. | low |
| `CLAUDE.md` | File map + status entries for the new modules. | low |

## The thing that will bite you: there are three guess maps

`js/map.js` is the Classic guess map only. VS and Co-op build their own
(`initVsMap` at `js/vs-round.js:283`, `placeVsMarker` at `:318`), and Stitch Up
builds a third (`js/su-guesser.js:57`). There are two more read-only maps —
the setter's (`js/su-setter.js:38`) and the spectator's (`js/su-spectator.js:41`) —
plus several result maps.

Constraining "the guess map" therefore means touching three files, not one, and a
change that only fixes `js/map.js` will look complete in Classic and silently allow
out-of-area guesses in both multiplayer modes. This is why `js/map-overlay.js`
exists in the table above: write the overlay and the click guard once, apply it in
three places, and the fourth map someone adds later gets it for free.

## Non-goals for this plan

Named explicitly so they don't creep in:

- No saving or sharing of custom areas between sessions beyond the in-flight
  session restore. No "my areas" library.
- No multi-polygon or hole support. One simple ring.
- No polygon editing after confirmation — to change it, redraw.
- No server-side validation. Guests trust the host's ring, as they already trust
  the host's locations.
- No change to the speed-bonus mechanic. It multiplies whatever the base score is.

## Sequencing

The conceptualization groups in `05-conceptualization/` are ordered so the risky
work lands on top of proven foundations. **They are not work units** — the work
units are the Items in [06-list-of-items.md](06-list-of-items.md), each boxed at
1, 2 or 3 evenings. The groups exist so an item can say where it is specified.

```
S00 harness
 └─ S01 geometry core ─ S02 diameter ─ S03 relative scorer ─ S04 regions migrate
                                                                  │
                        S05 draft model ─ S06 solo draw screen ───┤
                                                                  ├─ S09 solo E2E
                                          S07 constrained sampling┤
                                          S08 constrained guessing┘
                                                                  │
                                             S10 VS ─ S11 Stitch Up
                                                                  │
                                             S12 edge cases ─ S13 polish
```

S04 is the point of no return for existing modes — once merged, every score in
the game changes. That is why the current List of Items ends there: item 24 is
the playtest, and the list is replaced afterwards rather than extended.
