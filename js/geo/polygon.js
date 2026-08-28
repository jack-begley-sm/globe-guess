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
        const diff = rawDiff - Math.round(rawDiff / 360) * 360;
        out.push({ lat: rawRing[i].lat, lng: prevLng + diff });
    }
    return out;
}

/**
 * Moves `point` into `ring`'s unrolled longitude frame by adding a
 * multiple of 360, choosing the representation nearest the ring's
 * longitude midpoint. Latitude passes through untouched.
 * @param {LatLng} point
 * @param {Ring} ring - already unrolled
 * @returns {LatLng}
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
