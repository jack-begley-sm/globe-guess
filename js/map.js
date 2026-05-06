// ============================================================
// FILE: js/map.js
// PURPOSE: Leaflet guess map handling.
//
// DEPENDENCIES:
//   - js/state.js       (writes guessLatLng)
//   - js/config.js      (MAP_SETTINGS)
//
// USED BY:
//   - js/round.js       (initializes and resets map each round)
//
// KEY FUNCTIONS:
//   - initMap()          initializes the Leaflet map
//   - resetMap()         clears markers and resets view
//   - submitGuess()      returns the guessed LatLng
// ============================================================

import { state } from './state.js';
import { MAP_SETTINGS } from './config.js';

let map;
let resultMiniMap;
let marker;
let isLocked = false;

export function initMap() {
    if (map) return;

    map = L.map('guess-map', {
        attributionControl: false,
        zoomControl: false
    }).setView([20, 0], MAP_SETTINGS.INITIAL_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    map.on('click', (e) => {
        if (isLocked) return;
        
        const widget = document.getElementById('guess-map-widget');
        if (widget.classList.contains('collapsed')) {
            widget.classList.remove('collapsed');
            widget.classList.add('expanded');
            setTimeout(() => map.invalidateSize(), 300);
        } else {
            placeMarker(e.latlng);
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
    if (marker) {
        marker.setLatLng(latlng);
    } else {
        marker = L.marker(latlng).addTo(map);
    }
    state.guessLatLng = { lat: latlng.lat, lng: latlng.lng };
    document.getElementById('btn-submit-guess').disabled = false;
}

export function resetMap() {
    isLocked = false;
    if (marker && map) {
        map.removeLayer(marker);
        marker = null;
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

export function showResultOnMap(actualLatLng, containerId, guessLatLng = null) {
    const targetContainer = document.getElementById(containerId);
    if (!targetContainer) return;

    // Clear previous map if any
    if (targetContainer._leaflet_id) {
        targetContainer.innerHTML = '';
        const oldMap = L.DomUtil.get(containerId);
        if (oldMap) oldMap._leaflet_id = null;
    }

    const resMap = L.map(containerId, {
        attributionControl: false,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(resMap);

    const actualMarker = L.circleMarker(actualLatLng, {
        color: '#f0e8d2', // ivory
        fillColor: '#f0e8d2',
        fillOpacity: 1,
        radius: 6
    }).addTo(resMap);

    const markers = [actualMarker];

    const currentGuess = guessLatLng || state.guessLatLng;

    if (currentGuess) {
        const guessMarker = L.circleMarker(currentGuess, {
            color: '#40c8b4', // teal
            fillColor: '#40c8b4',
            fillOpacity: 1,
            radius: 6
        }).addTo(resMap);
        markers.push(guessMarker);

        L.polyline([currentGuess, actualLatLng], {
            color: '#40c8b4',
            weight: 2,
            dashArray: '5, 5'
        }).addTo(resMap);
    }

    const group = new L.featureGroup(markers);
    resMap.fitBounds(group.getBounds(), { padding: [20, 20] });
}
