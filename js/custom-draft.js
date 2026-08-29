// ============================================================
// FILE: js/custom-draft.js
// PURPOSE: The rules of drawing a custom play area — how many points,
//          when it can be closed, what makes it invalid. No map, no
//          DOM, no js/state.js. See
//          .docs/custom-maps/05-conceptualization/S05-draft-model.md.
//
// DEPENDENCIES:
//   - none (item 1; item 3 adds js/geo/shapes.js and js/config.js)
//
// USED BY:
//   - js/custom-map.js (planned, S06) — Leaflet adapter forwards taps here
//
// KEY FUNCTIONS:
//   - createDraft()   returns a Draft: addPoint/undo/clear/points/status/close
// ============================================================

/**
 * @typedef {{ lat: number, lng: number }} LatLng
 * @typedef {{ ok: boolean, reason?: string }} AddPointResult
 */

/**
 * @returns {{
 *   addPoint: (p: LatLng) => AddPointResult,
 *   undo: () => void,
 *   clear: () => void,
 *   points: LatLng[]
 * }}
 */
export function createDraft() {
    let points = [];

    function addPoint(latLng) {
        points.push({ lat: latLng.lat, lng: latLng.lng });
        return { ok: true };
    }

    function undo() {
        points.pop();
    }

    function clear() {
        points = [];
    }

    return {
        addPoint,
        undo,
        clear,
        get points() {
            return points.map((p) => ({ lat: p.lat, lng: p.lng }));
        },
    };
}
