// ============================================================
// FILE: js/geo/polygon.js
// PURPOSE: Pure spherical/planar polygon geometry for play areas —
//          antimeridian-safe unrolling and point normalisation.
//          No DOM, no Leaflet, no state. See
//          .docs/custom-maps/02-geometry-contracts.md for the spec.
//
// DEPENDENCIES:
//   - none
//
// USED BY:
//   - js/geo/shapes.js (planned, item 14)
//
// KEY FUNCTIONS:
//   - unrollRing(rawRing)          antimeridian-safe copy of a ring
//   - normalisePointTo(point, ring) moves a point into a ring's frame
//   - pointInRing(point, ring)     even-odd ray cast, boundary = inside
//   - ringBbox(ring)               bounding box in the ring's own frame
//   - containsPoint(point, shape)  normalise + bbox reject + ray cast
// ============================================================

/**
 * @typedef {{ lat: number, lng: number }} LatLng
 * @typedef {LatLng[]} Ring
 */

/**
 * Returns a new ring where each vertex's longitude is placed within
 * 180 degrees of its predecessor, so a ring crossing the antimeridian
 * stays contiguous instead of wrapping. Does not mutate the input.
 * @param {Ring} rawRing
 * @returns {Ring}
 */
export function unrollRing(rawRing) {
    if (rawRing.length < 2) {
        return rawRing.map((p) => ({ lat: p.lat, lng: p.lng }));
    }

    const out = [{ lat: rawRing[0].lat, lng: rawRing[0].lng }];
    for (let i = 1; i < rawRing.length; i++) {
        const prevLng = out[i - 1].lng;
        const rawDiff = rawRing[i].lng - prevLng;
        // Math.round ties toward +Infinity, so this lands diff in the
        // half-open range [-180, 180) rather than [-180, 180] — that is
        // what makes a second unrollRing pass reproduce the first exactly.
        const diff = rawDiff - Math.round(rawDiff / 360) * 360;
        out.push({ lat: rawRing[i].lat, lng: prevLng + diff });
    }
    return out;
}

/**
 * Moves `point` into `ring`'s unrolled longitude frame by adding a
 * multiple of 360, choosing the representation nearest the ring's
 * longitude midpoint. Latitude passes through untouched.
 *
 * Precondition: `ring`'s unrolled longitude span must be < 360 degrees
 * (custom-draft.js rejects wider rings at draw time — see
 * 02-geometry-contracts.md's runtime-enforcement table). Outside that,
 * the ring no longer fits in a single [mid-180, mid+180) window and a
 * point can be normalised to the wrong side.
 * @param {LatLng} point
 * @param {Ring} ring - already unrolled, span < 360 degrees
 * @returns {LatLng} `point` unchanged (copied) if `ring` is empty
 */
export function normalisePointTo(point, ring) {
    if (ring.length === 0) {
        return { lat: point.lat, lng: point.lng };
    }

    const lngs = ring.map((p) => p.lng);
    const mid = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    const offset = Math.round((point.lng - mid) / 360) * 360;
    return { lat: point.lat, lng: point.lng - offset };
}

const ON_SEGMENT_EPS = 1e-9;

/** True when `point` lies on the closed segment a-b (inclusive of endpoints). */
function isOnSegment(point, a, b) {
    const cross = (b.lng - a.lng) * (point.lat - a.lat) -
                  (b.lat - a.lat) * (point.lng - a.lng);
    if (Math.abs(cross) > ON_SEGMENT_EPS) return false;

    const dot = (point.lng - a.lng) * (b.lng - a.lng) +
                (point.lat - a.lat) * (b.lat - a.lat);
    if (dot < 0) return false;

    const lenSq = (b.lng - a.lng) ** 2 + (b.lat - a.lat) ** 2;
    return dot <= lenSq;
}

/**
 * Even-odd ray cast in the ring's own frame. Caller normalises first —
 * this does not call normalisePointTo. Boundary points (on a vertex or
 * an edge) count as inside. Winding order does not affect the result.
 * @param {LatLng} point
 * @param {Ring} ring
 * @returns {boolean}
 */
export function pointInRing(point, ring) {
    if (ring.length < 3) return false;

    for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        if (isOnSegment(point, a, b)) return true;
    }

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i].lng, yi = ring[i].lat;
        const xj = ring[j].lng, yj = ring[j].lat;
        const crosses = (yi > point.lat) !== (yj > point.lat);
        if (crosses) {
            const xIntersect = (xj - xi) * (point.lat - yi) / (yj - yi) + xi;
            if (point.lng < xIntersect) inside = !inside;
        }
    }
    return inside;
}

/**
 * Bounding box in the ring's own (already-unrolled) frame — `east` may
 * exceed 180. A single-vertex ring returns a zero-area box at that vertex.
 * @param {Ring} ring
 * @returns {{south:number, west:number, north:number, east:number}}
 */
export function ringBbox(ring) {
    let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
    for (const p of ring) {
        if (p.lat < south) south = p.lat;
        if (p.lat > north) north = p.lat;
        if (p.lng < west) west = p.lng;
        if (p.lng > east) east = p.lng;
    }
    return { south, north, west, east };
}

/**
 * Normalises `point` into `shape.ring`'s frame, fast-rejects against
 * `shape.bbox`, then falls back to the full ray cast. This is what
 * game code calls — `pointInRing` is the pure primitive.
 * @param {LatLng} point
 * @param {{ring: Ring, bbox: {south:number, west:number, north:number, east:number}}} shape
 * @returns {boolean}
 */
export function containsPoint(point, shape) {
    const p = normalisePointTo(point, shape.ring);
    const { south, north, west, east } = shape.bbox;
    if (p.lat < south || p.lat > north || p.lng < west || p.lng > east) {
        return false;
    }
    return pointInRing(p, shape.ring);
}
