// ============================================================
// FILE: js/geo/polygon-validate.js
// PURPOSE: Pure ring-validity checks split out of js/geo/polygon.js to
//          keep both files under the 150-line CLAUDE.md limit. No DOM,
//          no Leaflet, no state. See
//          .docs/custom-maps/02-geometry-contracts.md for the spec.
//
// DEPENDENCIES:
//   - none
//
// USED BY:
//   - js/custom-draft.js (planned) — live validation while drawing
//
// KEY FUNCTIONS:
//   - ringIsSimple(ring)   true when no two non-adjacent edges cross
//   - pathIsSimple(path)   ringIsSimple for an OPEN polyline (no closing edge)
// ============================================================

const COLLINEAR_EPS = 1e-9;

function cross(o, a, b) {
    return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
}

/** True when collinear point `p` falls within segment a-b's bounding box. */
function withinBounds(a, b, p) {
    return p.lng >= Math.min(a.lng, b.lng) - COLLINEAR_EPS &&
           p.lng <= Math.max(a.lng, b.lng) + COLLINEAR_EPS &&
           p.lat >= Math.min(a.lat, b.lat) - COLLINEAR_EPS &&
           p.lat <= Math.max(a.lat, b.lat) + COLLINEAR_EPS;
}

/** True when segments p1-p2 and p3-p4 cross or touch (including collinear overlap). */
function segmentsIntersect(p1, p2, p3, p4) {
    const d1 = cross(p3, p4, p1);
    const d2 = cross(p3, p4, p2);
    const d3 = cross(p1, p2, p3);
    const d4 = cross(p1, p2, p4);

    if (((d1 > 0) !== (d2 > 0)) && d1 !== 0 && d2 !== 0 &&
        ((d3 > 0) !== (d4 > 0)) && d3 !== 0 && d4 !== 0) {
        return true;
    }

    if (Math.abs(d1) < COLLINEAR_EPS && withinBounds(p3, p4, p1)) return true;
    if (Math.abs(d2) < COLLINEAR_EPS && withinBounds(p3, p4, p2)) return true;
    if (Math.abs(d3) < COLLINEAR_EPS && withinBounds(p1, p2, p3)) return true;
    if (Math.abs(d4) < COLLINEAR_EPS && withinBounds(p1, p2, p4)) return true;
    return false;
}

/**
 * True when no two non-adjacent edges of `ring` intersect, and no two
 * vertices share a coordinate. Adjacent edges (sharing a vertex,
 * including the closing edge) are never tested against each other.
 * O(n^2); ring lengths here are bounded by CUSTOM_MAP.MAX_VERTICES (24).
 * Precondition: `ring` is already unrolled (see unrollRing in
 * polygon.js) — this is planar and frame-dependent, so a raw ring that
 * crosses the antimeridian can give the wrong answer.
 * @param {import('./polygon.js').Ring} ring - already unrolled
 * @returns {boolean}
 */
export function ringIsSimple(ring) {
    const n = ring.length;
    if (n < 3) return true;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (ring[i].lat === ring[j].lat && ring[i].lng === ring[j].lng) return false;
        }
    }

    for (let i = 0; i < n; i++) {
        const a1 = ring[i], a2 = ring[(i + 1) % n];
        for (let j = i + 1; j < n; j++) {
            const adjacent = j === i + 1 || (i === 0 && j === n - 1);
            if (adjacent) continue;
            const b1 = ring[j], b2 = ring[(j + 1) % n];
            if (segmentsIntersect(a1, a2, b1, b2)) return false;
        }
    }
    return true;
}

/**
 * True when no two non-adjacent edges of the OPEN polyline `path`
 * intersect, and no two points share a coordinate. Unlike `ringIsSimple`,
 * there is no closing edge from the last point back to the first — use
 * this while a shape is still being drawn (js/custom-draft.js checks it
 * on every `addPoint`); use `ringIsSimple` once the ring is closed.
 * Precondition: `path` is already unrolled.
 * @param {import('./polygon.js').Ring} path - already unrolled
 * @returns {boolean}
 */
export function pathIsSimple(path) {
    const n = path.length;
    if (n < 3) return true;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (path[i].lat === path[j].lat && path[i].lng === path[j].lng) return false;
        }
    }

    for (let i = 0; i < n - 1; i++) {
        const a1 = path[i], a2 = path[i + 1];
        for (let j = i + 2; j < n - 1; j++) {
            const b1 = path[j], b2 = path[j + 1];
            if (segmentsIntersect(a1, a2, b1, b2)) return false;
        }
    }
    return true;
}
