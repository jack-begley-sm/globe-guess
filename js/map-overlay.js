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
//   - drawShapeOverlay(map, shape)   outline + world-with-a-hole mask
//   - guardClick(getShape, handler)  wraps a click handler so a tap
//     outside the shape never reaches it
//   - fitMapToShape(map, shape)      fits the view to the shape and
//     bounds panning/zoom so it can't be scrolled off screen entirely
// ============================================================
import { containsPoint } from './geo/polygon.js';

const WORLD_RING = [[-90, -180], [-90, 180], [90, 180], [90, -180]];

/**
 * Draws `shape`'s boundary and a world-with-a-hole mask dimming
 * everywhere outside it. Drawn for WORLD too — REGIONS.WORLD is
 * lat:[-60,70], not the whole globe (an earlier version of this
 * function special-cased WORLD as a no-op on the mistaken assumption
 * that its bbox WAS the globe; `guardClick` was never given that same
 * exemption, so the two disagreed — guessing above 70N or below 60S in
 * a World game was silently refused with no outline and no explanation
 * for why. Drawing the mask correctly dims the polar caps it actually
 * excludes, matching what guardClick already enforced).
 * @param {object} map
 * @param {import('./geo/polygon.js').Shape} shape
 * @returns {{ remove: () => void }}
 */
export function drawShapeOverlay(map, shape) {
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
 * Wraps `handler` so it only fires for a click inside the CURRENT
 * shape — a tap outside is dropped before the caller ever sees it.
 * Takes a `getShape()` accessor rather than a fixed shape because the
 * guess map is created once and reused across many rounds, each with
 * its own shape; re-registering a fresh `map.on('click', ...)` every
 * round would stack listeners instead of replacing one, so the guard
 * itself must read whatever shape is current at click time.
 * @param {() => (import('./geo/polygon.js').Shape | null)} getShape
 * @param {(e: object) => void} handler
 * @returns {(e: object) => void}
 */
export function guardClick(getShape, handler) {
    return (e) => {
        const shape = getShape();
        if (shape) {
            const point = { lat: e.latlng.lat, lng: e.latlng.lng };
            if (!containsPoint(point, shape)) return;
        }
        handler(e);
    };
}

/**
 * Fits the view to `shape`'s bbox and bounds panning to a margin
 * around it, so a player can't scroll the whole play area off screen.
 * A fixed fraction of the bbox's own size, not a fixed degree count —
 * a UK-sized area and a 5km custom one both get a sensible margin.
 * @param {object} map
 * @param {import('./geo/polygon.js').Shape} shape
 */
export function fitMapToShape(map, shape) {
    const { south, west, north, east } = shape.bbox;
    map.fitBounds([[south, west], [north, east]], { padding: [20, 20] });

    const latPad = (north - south) * 0.2 || 1;
    const lngPad = (east - west) * 0.2 || 1;
    map.setMaxBounds([[south - latPad, west - lngPad], [north + latPad, east + lngPad]]);
}
