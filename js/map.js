// ============================================================
// FILE: js/map.js
// PURPOSE: Leaflet guess map handling.
//
// DEPENDENCIES:
//   - js/state.js       (writes guessLatLng)
//   - js/config.js      (MAP_SETTINGS)
//   - js/map-overlay.js (drawShapeOverlay, guardClick)
//
// USED BY:
//   - js/round.js       (initializes and resets map each round)
//
// KEY FUNCTIONS:
//   - initMap()          initializes the Leaflet map
//   - resetMap(shape)    clears markers, redraws the shape overlay, resets view
//   - submitGuess()      returns the guessed LatLng
//
// See also js/result-map.js (showResultOnMap) — split out to stay
// under the 150-line limit; it shares no state with this file.
// ============================================================

import { state } from './state.js';
import { MAP_SETTINGS } from './config.js';
import { drawShapeOverlay, guardClick, fitMapToShape } from './map-overlay.js';

let map;
let resultMiniMap;
let marker;
let isLocked = false;
let currentOverlay = null;
let currentShape = null;

export function initMap() {
    if (map) return;

    map = L.map('guess-map', {
        attributionControl: false,
        zoomControl: false
    }).setView([20, 0], MAP_SETTINGS.INITIAL_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // The map is created once and reused across every round, each with
    // its own shape — guardClick reads currentShape at click time via
    // this getter rather than a value fixed when the guard was made.
    const guardedPlaceMarker = guardClick(() => currentShape, (e) => placeMarker(e.latlng));

    map.on('click', (e) => {
        if (isLocked) return;

        const widget = document.getElementById('guess-map-widget');
        if (widget.classList.contains('collapsed')) {
            widget.classList.remove('collapsed');
            widget.classList.add('expanded');
            setTimeout(() => map.invalidateSize(), 300);
        } else {
            guardedPlaceMarker(e);
        }
    });

    // Expand logic on collapsed widget
    const widget = document.getElementById('guess-map-widget');
    widget.addEventListener('click', (e) => {
        if (widget.classList.contains('collapsed')) {
            widget.classList.remove('collapsed');
            widget.classList.add('expanded');
            setTimeout(() => map.invalidateSize(), 300);
        }
    });
}

function placeMarker(latlng) {
    // Panning the map more than one world-width gives longitudes outside
    // -180..180 (e.g. 380 instead of 20). Wrap here so the result map's
    // fitBounds/marker placement doesn't render a duplicate world copy far
    // from the actual guess. Containment against currentShape is already
    // enforced by guardClick before this ever runs.
    latlng = latlng.wrap();
    const point = { lat: latlng.lat, lng: latlng.lng };

    if (marker) {
        marker.setLatLng(latlng);
    } else {
        marker = L.marker(latlng).addTo(map);
    }
    state.guessLatLng = point;
    document.getElementById('btn-submit-guess').disabled = false;
}

export function resetMap(shape) {
    currentShape = shape;
    isLocked = false;
    if (marker && map) {
        map.removeLayer(marker);
        marker = null;
    }
    if (currentOverlay) {
        currentOverlay.remove();
        currentOverlay = null;
    }
    if (map && shape) {
        currentOverlay = drawShapeOverlay(map, shape);
        fitMapToShape(map, shape);
    }
    state.guessLatLng = null;
    document.getElementById('btn-submit-guess').disabled = true;

    const widget = document.getElementById('guess-map-widget');
    widget.classList.add('collapsed');
    widget.classList.remove('expanded');
    setTimeout(() => {
        if (map) map.invalidateSize();  // ← guard here
    }, 300);
}

export function submitGuess() {
    isLocked = true;
    const widget = document.getElementById('guess-map-widget');
    widget.classList.add('collapsed');
    widget.classList.remove('expanded');
    return state.guessLatLng;
}
