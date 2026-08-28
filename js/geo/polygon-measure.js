// ============================================================
// FILE: js/geo/polygon-measure.js
// PURPOSE: Pure ring measurement — boundary densification (and, in
//          later items, diameter/area/random-point sampling) split
//          out of js/geo/polygon.js to keep files under the 150-line
//          CLAUDE.md limit. No DOM, no Leaflet, no state. See
//          .docs/custom-maps/02-geometry-contracts.md for the spec.
//
// DEPENDENCIES:
//   - none
//
// USED BY:
//   - js/geo/shapes.js (planned, item 14) — diameterKm feeds scaleKm
//
// KEY FUNCTIONS:
//   - densifyRing(ring, stepDeg)   boundary sample, closing edge included
// ============================================================

/**
 * Splits every edge of `ring` (including the closing edge from the
 * last vertex back to the first) into `ceil(maxDelta / stepDeg)`
 * equal segments, where `maxDelta` is the larger of the edge's lat
 * and lng span. Every input vertex appears in the output exactly
 * once (as the start of its outgoing edge); the closing duplicate
 * (a copy of the first vertex at the end) is never returned.
 * @param {import('./polygon.js').Ring} ring
 * @param {number} stepDeg - max degrees per output segment
 * @returns {import('./polygon.js').Ring}
 */
export function densifyRing(ring, stepDeg) {
    const n = ring.length;
    const out = [];

    for (let i = 0; i < n; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % n];
        out.push({ lat: a.lat, lng: a.lng });

        const maxDelta = Math.max(Math.abs(b.lat - a.lat), Math.abs(b.lng - a.lng));
        const segments = Math.max(1, Math.ceil(maxDelta / stepDeg));
        for (let s = 1; s < segments; s++) {
            const t = s / segments;
            out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
        }
    }
    return out;
}
