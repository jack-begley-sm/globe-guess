// ============================================================
// FILE: js/custom-map.js
// PURPOSE: Leaflet adapter for the Custom-mode draw screen. Forwards
//          taps to the draft and renders its current state — decides
//          nothing about drawing rules itself. See
//          .docs/custom-maps/05-conceptualization/S06-draw-screen.md.
//
// DEPENDENCIES:
//   - js/custom-draft.js (Draft: addPoint, points — not imported, passed in)
//   - global `L` (Leaflet, loaded via <script> in index.html)
//
// USED BY:
//   - js/custom-lobby.js (planned) — wires buttons and screen transitions
//
// KEY FUNCTIONS:
//   - initCustomMap(containerId, draft, opts?)   creates the map, wires
//     clicks to the draft, returns { map, redraw }
// ============================================================

const WORLD_RING = [[-90, -180], [-90, 180], [90, 180], [90, -180]];

/**
 * @param {string} containerId
 * @param {ReturnType<typeof import('./custom-draft.js').createDraft>} draft
 * @param {{ onAddPointResult?: (result: { ok: boolean, reason?: string }) => void }} [opts]
 * @returns {{ map: object, redraw: () => void }}
 */
export function initCustomMap(containerId, draft, opts = {}) {
    const map = L.map(containerId, { attributionControl: false, zoomControl: false }).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    let ringLayer = null;
    let markerLayers = [];
    let maskLayer = null;

    function redraw() {
        if (ringLayer) { map.removeLayer(ringLayer); ringLayer = null; }
        markerLayers.forEach((m) => map.removeLayer(m));
        markerLayers = [];
        if (maskLayer) { map.removeLayer(maskLayer); maskLayer = null; }

        const points = draft.points;
        const latlngs = points.map((p) => [p.lat, p.lng]);

        if (points.length >= 2) {
            ringLayer = L.polygon(latlngs, { color: '#40c8b4' }).addTo(map);
        }
        markerLayers = points.map((p) => L.circleMarker([p.lat, p.lng], { radius: 5 }).addTo(map));

        if (points.length >= 3) {
            maskLayer = L.polygon([WORLD_RING, latlngs], { className: 'custom-map-mask' }).addTo(map);
        }
    }

    map.on('click', (e) => {
        const result = draft.addPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
        redraw();
        opts.onAddPointResult?.(result);
    });

    redraw();
    return { map, redraw };
}
