// ============================================================
// FILE: js/result-map.js
// PURPOSE: Renders the small read-only result map showing the actual
//          location, the player's guess, the play area outline, and
//          the line between the two points.
//          Split out of js/map.js to stay under the 150-line limit —
//          shares no state with the guess map.
//
// DEPENDENCIES:
//   - js/state.js       (falls back to state.guessLatLng; reads state.shape for the outline)
//
// USED BY:
//   - js/round.js       (shows the result after each round)
//   - js/results.js     (thumb maps and the round-detail modal)
//
// KEY FUNCTIONS:
//   - showResultOnMap(actualLatLng, containerId, guessLatLng?)
// ============================================================

import { state } from './state.js';

/** S08's own "watch out for" calls for this: the result map is the only
 *  place the player sees their miss in context, so it should show the
 *  play area boundary too, not just the two points. state.shape is
 *  constant for the whole game (only startGame/confirmArea change it),
 *  so it's safe to read here for any round's result, not just the
 *  current one. No mask — this map is read-only, there's nothing to
 *  guard against clicking outside of. */
function drawShapeOutline(map, shape) {
    if (!shape) return;
    L.polygon(shape.ring.map((p) => [p.lat, p.lng]), {
        color: '#40c8b4',
        fill: false,
        weight: 2,
    }).addTo(map);
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

    drawShapeOutline(resMap, state.shape);

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
