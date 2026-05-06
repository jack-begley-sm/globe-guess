// ============================================================
// FILE: js/su-spectator.js
// PURPOSE: Spectator view during Guesser phase.
// ============================================================

import { suState } from './su-state.js';
import { setVsStreetView } from './streetview.js';

let spectatorMap = null;
let guesserMarker = null;
let answerMarker = null;

export function initSpectatorView(panoId, correctLatLng, guesserName) {
    document.getElementById('screen-su-spectator').classList.remove('hidden');
    document.getElementById('su-spectator-round-num').textContent = `ROUND ${suState.currentRound} / ${suState.totalRounds}`;
    document.getElementById('su-spectator-label').textContent = `SPECTATING — ${guesserName} is guessing`;
    
    setVsStreetView(panoId, 'su-spectator-sv-container');
    initSpectatorMap(correctLatLng);
    startSpectatorTimer(120);
}

function initSpectatorMap(correctLatLng) {
    if (spectatorMap) {
        spectatorMap.remove();
    }

    spectatorMap = L.map('spectator-map', {
        center: [correctLatLng.lat, correctLatLng.lng],
        zoom: 1,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(spectatorMap);

    const tealIcon = L.divIcon({
        className: 'su-pin-label',
        html: `<div style="background-color: var(--teal); width: 10px; height: 10px; border-radius: 50%; border: 1px solid white;"></div><span style="font-size: 8px; margin-left: 12px;">ANSWER</span>`,
        iconSize: [80, 20],
        iconAnchor: [5, 5]
    });
    answerMarker = L.marker([correctLatLng.lat, correctLatLng.lng], { icon: tealIcon }).addTo(spectatorMap);

    guesserMarker = null;
}

export function updateLiveGuesserPin(latLng) {
    if (!spectatorMap) return;
    
    if (guesserMarker) {
        guesserMarker.setLatLng([latLng.lat, latLng.lng]);
    } else {
        const ivoryIcon = L.divIcon({
            className: 'su-pin-label',
            html: `<div style="background-color: #fffff0; width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--bg-1);"></div><span style="font-size: 8px; margin-left: 12px;">GUESS</span>`,
            iconSize: [80, 20],
            iconAnchor: [5, 5]
        });
        guesserMarker = L.marker([latLng.lat, latLng.lng], { icon: ivoryIcon }).addTo(spectatorMap);
    }
    
    // Fit bounds to show both pins
    const bounds = L.latLngBounds([answerMarker.getLatLng(), guesserMarker.getLatLng()]);
    spectatorMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 5 });
}

function startSpectatorTimer(seconds) {
    const timerEl = document.getElementById('su-spectator-timer');
    let timeLeft = seconds;
    timerEl.textContent = timeLeft;
    timerEl.classList.remove('danger');

    const interval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 15) timerEl.classList.add('danger');
        
        if (timeLeft <= 0 || document.getElementById('screen-su-spectator').classList.contains('hidden')) {
            clearInterval(interval);
        }
    }, 1000);
}
