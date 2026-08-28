# 02 — Geometry contracts

`js/geo/polygon.js` is pure: no DOM, no Leaflet, no `js/state.js`, no network. It
is the only file in the feature that needs to be right in a mathematical sense,
and it is the only one that can be tested exhaustively without doubles. Nothing
in it may import anything except `js/config.js`.

## Data shapes

```js
/** @typedef {{ lat: number, lng: number }} LatLng */

/** An ordered, implicitly-closed ring. Never repeat the first vertex last. */
/** @typedef {LatLng[]} Ring */

/** @typedef {{ south:number, west:number, north:number, east:number }} Bbox
 *  west/east are in the ring's unrolled frame and may exceed ±180. */

/** @typedef {{
 *    id:      string,        // 'WORLD' | 'UK' | ... | 'CUSTOM'
 *    label:   string,        // display name
 *    ring:    Ring,          // unrolled
 *    bbox:    Bbox,
 *    scaleKm: number         // D — the scoring denominator
 *  }} Shape */
```

`Shape` is created once per game and cached. It is immutable. Producing one is
`js/geo/shapes.js`'s job; measuring one is `polygon.js`'s.

## The unrolled frame

A polygon drawn across the Pacific will contain vertices near +179 and near −179
that are 2° apart in reality and 358° apart naively. Leaflet compounds this: pan
past the edge of the world and `e.latlng.lng` comes back as 380 rather than 20.
`js/map.js` already patches around this with `latlng.wrap()`.

Rather than wrap, **unroll**. Keep the first vertex as drawn, then place each
subsequent vertex in the representation within ±180° of its predecessor:

```
raw:       [ 178, -179, -177, 179 ]
unrolled:  [ 178,  181,  183, 179 ]
```

The ring is now contiguous and every downstream algorithm — ray casting, bbox,
densify — works in plain planar longitude with no special cases. The cost is one
translation step: any point tested against the ring must first be moved into the
same frame, which is what `normalisePointTo` does.

Rules:

- Unrolling happens exactly once, in `unrollRing`, at ring creation.
- A ring whose unrolled longitude span is `>= 360°` is invalid — the player has
  wound round the globe more than once. Reject at draw time.
- Latitude is never unrolled. Clamp to [−85.05, 85.05] (Web Mercator's limit,
  which is also all Leaflet can show).

## Function contracts

Each bullet is a test case. S01 and S02 turn these into `.feature` scenarios.

---

### `unrollRing(rawRing) -> Ring`

Returns a new ring in the unrolled frame.

- Empty or 1-point input → returns a copy, unchanged.
- Consecutive vertices are never more than 180° apart in longitude in the output.
- `[{lat:0,lng:178},{lat:0,lng:-179}]` → second lng becomes `181`.
- Idempotent: `unrollRing(unrollRing(r))` deep-equals `unrollRing(r)`.
- Does not mutate the input.

### `normalisePointTo(point, ring) -> LatLng`

Moves a point into the ring's frame by adding a multiple of 360 to its longitude,
choosing the representation nearest the ring's longitude midpoint.

- Point at `lng: -179` against a ring centred on `181` → returns `lng: 181`-side
  representation (`-179 + 360 = 181`... i.e. the near one).
- Point at `lng: 380` (Leaflet over-pan) against a ring centred on `20` → `20`.
- Latitude passes through untouched.

### `pointInRing(point, ring) -> boolean`

Even–odd ray casting in the unrolled frame. Caller is responsible for
`normalisePointTo` first; `pointInRing` does **not** normalise (keeps it pure and
lets `containsPoint` be the one public convenience that does both).

- Point clearly inside a simple square → true.
- Point clearly outside → false.
- Ring with fewer than 3 vertices → always false.
- **Vertex hit**: point exactly on a vertex → true (treat boundary as inside).
- **Edge hit**: point exactly on an edge → true.
- Ray passing exactly through a vertex must not double-count. Test with a
  diamond and a point at the same latitude as its left and right vertices.
- Concave ring: a point in the "bite" of an L-shape → false.
- Winding order (clockwise vs counter-clockwise) does not change the answer.

### `containsPoint(point, shape) -> boolean`

`pointInRing(normalisePointTo(point, shape.ring), shape.ring)`, with a fast bbox
reject first. This is what game code calls.

- Bbox reject must not produce a different answer from the full test — property
  test over random points.

### `ringIsSimple(ring) -> boolean`

True when no two non-adjacent edges intersect. O(n²) segment intersection; `n <= 24`.

- Square → true. Figure-eight → false.
- Adjacent edges sharing a vertex → not an intersection.
- Two vertices at the same coordinate → false (degenerate).
- Three collinear points → true (allowed, just pointless).

### `ringBbox(ring) -> Bbox`

- Computed in the unrolled frame, so `east` may exceed 180.
- Single-vertex ring → zero-area bbox at that vertex.

### `densifyRing(ring, stepDeg) -> LatLng[]`

Boundary sample. Every edge split into `ceil(maxDelta / stepDeg)` segments,
including the closing edge from last vertex back to first.

- Output length >= input length.
- Every input vertex appears in the output.
- A ring whose edges are all shorter than `stepDeg` returns exactly its vertices.
- Never returns the closing duplicate.

### `diameterKm(ring, stepDeg) -> number`

Max pairwise great-circle distance over `densifyRing(ring, stepDeg)`.

- UK bbox ring → 1171 km ± 1.
- **WORLD bbox ring → 20 015 km ± 5, not 14 455.** This is the regression test
  that proves densification is happening. See 01-scoring-model.
- Two-vertex degenerate ring → the distance between them.
- Monotone: adding a vertex outside the current hull never decreases the result.

### `randomPointInShape(shape, rng) -> LatLng | null`

Rejection sampling: draw uniformly from the bbox, test containment, retry up to
`CUSTOM_MAP.SAMPLE_ATTEMPTS` (default 60), return `null` if all fail.

- `rng` is injected (defaults to `Math.random`) so tests are deterministic. No
  bare `Math.random()` anywhere in this module.
- Every returned point satisfies `containsPoint`.
- A shape whose bbox it fills (a square) succeeds on the first attempt with a
  fixed rng.
- A pathologically thin polygon may return `null`; callers must handle it.
- Latitude sampling is uniform in degrees, matching the existing
  `generateRandomLatLng` in `js/streetview.js`. This over-samples the poles
  relative to true area, exactly as today. **Not fixing that here** — it is
  pre-existing behaviour and changing it in the same release would confound the
  playtest of the new scoring. Note it as a follow-up.

### `areaKm2(ring) -> number`

Spherical excess (or the shoelace-on-an-equirectangular-projection approximation
scaled by `cos(meanLat)` — good enough for a minimum-size check).

- Only used for the "your area is too small" guard, never for scoring.
- UK bbox ≈ 700 000 km² ± 10%. That tolerance is deliberate; do not tighten it
  around whichever approximation you pick.

---

## Where each contract is enforced at runtime

| Rule | Enforced in | On violation |
|---|---|---|
| ≥ 3 vertices | `custom-draft.js` | "USE THIS AREA" stays disabled |
| ≤ 24 vertices | `custom-draft.js` | further taps ignored, hint shown |
| Ring is simple | `custom-draft.js` on every add | offending edge drawn red, close blocked |
| Longitude span < 360° | `custom-draft.js` on every add | tap rejected, hint shown |
| Area ≥ `MIN_AREA_KM2` | `custom-draft.js` on close | "too small to find Street View" |
| Location inside shape | `streetview.js` after pano lookup | resample (S07) |
| Guess inside shape | `map.js` before placing marker | no marker, Submit stays disabled (S08) |
| `scaleKm > 0` | `scoring.js` | throws (S03) |
