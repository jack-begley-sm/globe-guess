// ============================================================
// FILE: js/map-overlay.js
// PURPOSE: Shared play-area rendering and click-guarding for every
//          guess map (Classic, VS/Co-op, Stitch Up) — one place so the
//          three call sites can't drift. See
//          .docs/custom-maps/05-conceptualization/S08-constrained-guessing.md.
//
// DEPENDENCIES:
//   - js/geo/polygon.js (containsPoint)
//   - global `L` (Leaflet, loaded via <script> in index.html)
//
// USED BY:
//   - js/map.js (planned) — Classic guess map
//   - js/vs-round.js (planned) — VS/Co-op guess map
//   - js/su-guesser.js (planned) — Stitch Up guess map
//
// KEY FUNCTIONS:
//   - drawShapeOverlay(map, shape)   outline + world-with-a-hole mask;
//     no-op for WORLD (dimming nothing is the correct render)
//   - guardClick(shape, handler)     wraps a click handler so a tap
//     outside the shape never reaches it
// ============================================================
import { containsPoint } from './geo/polygon.js';

const WORLD_RING = [[-90, -180], [-90, 180], [90, 180], [90, -180]];

/**
 * Draws `shape`'s boundary and a world-with-a-hole mask dimming
 * everywhere outside it. WORLD is a no-op — a full-globe hole mask
 * would dim nothing anyway, at the cost of a needless huge polygon.
 * @param {object} map
 * @param {import('./geo/polygon.js').Shape} shape
 * @returns {{ remove: () => void } | null} null for WORLD
 */
export function drawShapeOverlay(map, shape) {
    if (shape.id === 'WORLD') return null;

    const ring = shape.ring.map((p) => [p.lat, p.lng]);
    const outline = L.polygon(ring, { color: '#40c8b4', fill: false, weight: 2 }).addTo(map);
    // Outer ring winds opposite the inner ring, or Leaflet renders the
    // mask filled solid over the whole map instead of just the hole.
    const mask = L.polygon([WORLD_RING, ring], { className: 'map-overlay-mask', stroke: false }).addTo(map);

    return {
        remove() {
            map.removeLayer(outline);
            map.removeLayer(mask);
        },
    };
}

/**
 * Wraps `handler` so it only fires for a click inside `shape` — a tap
 * outside is dropped before the caller ever sees it.
 * @param {import('./geo/polygon.js').Shape} shape
 * @param {(e: object) => void} handler
 * @returns {(e: object) => void}
 */
export function guardClick(shape, handler) {
    return (e) => {
        const point = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (!containsPoint(point, shape)) return;
        handler(e);
    };
}
