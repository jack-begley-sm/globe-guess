// ============================================================
// FILE: js/su-setter.js
// PURPOSE: Setter phase UI and logic.
// ============================================================

import { suState } from './su-state.js';
import { sendSuData } from './su-guest.js';

let setterMap = null;
let setterMarker = null;
let setterTimerInterval = null;
let currentSelection = null; // { lat, lng, panoId }

export function initSetterPhase(guesserName, region) {
    document.getElementById('screen-su-setter').classList.remove('hidden');
    document.getElementById('su-setter-instruction').textContent = `Pick a location to stitch up ${guesserName}`;
    
    const confirmBtn = document.getElementById('btn-su-setter-confirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'CONFIRM LOCATION';

    initSetterMap();
    startSetterTimer(30);

    confirmBtn.onclick = () => {
        if (currentSelection) {
            confirmLocation(currentSelection.panoId, currentSelection.latLng);
        }
    };
}

function initSetterMap() {
    if (setterMap) {
        setterMap.remove();
    }

    setterMap = L.map('setter-map', {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        worldCopyJump: true,
        zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(setterMap);

    setterMarker = null;
    currentSelection = null;

    setterMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        placeSetterPin(lat, lng);
    });
}

async function placeSetterPin(lat, lng) {
    if (setterMarker) {
        setterMarker.setLatLng([lat, lng]);
    } else {
        const tealIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: var(--teal); width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [15, 15],
            iconAnchor: [7, 7]
        });
        setterMarker = L.marker([lat, lng], { icon: tealIcon }).addTo(setterMap);
    }

    // Validate SV nearby
    const confirmBtn = document.getElementById('btn-su-setter-confirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'CHECKING LOCATION...';

    try {
        const svService = new google.maps.StreetViewService();
        const result = await new Promise((resolve, reject) => {
            svService.getPanorama({
                location: { lat, lng },
                radius: 50000,
                source: google.maps.StreetViewSource.OUTDOOR
            }, (data, status) => {
                if (status === google.maps.StreetViewStatus.OK) {
                    resolve(data);
                } else {
                    reject(new Error('No Street View found here'));
                }
            });
        });

        const pos = result.location.latLng;
        currentSelection = {
            latLng: { lat: pos.lat(), lng: pos.lng() },
            panoId: result.location.pano
        };
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'CONFIRM LOCATION';
    } catch (err) {
        confirmBtn.textContent = 'NO STREET VIEW NEARBY';
    }
}

function startSetterTimer(seconds) {
    const timerEl = document.getElementById('su-setter-timer');
    let timeLeft = seconds;
    timerEl.textContent = timeLeft;
    timerEl.classList.remove('danger');

    clearInterval(setterTimerInterval);
    setterTimerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 10) timerEl.classList.add('danger');
        
        if (timeLeft <= 0) {
            clearInterval(setterTimerInterval);
            autoPlaceFallback();
        }
    }, 1000);
}

function confirmLocation(panoId, latLng) {
    clearInterval(setterTimerInterval);
    document.getElementById('btn-su-setter-confirm').disabled = true;
    document.getElementById('btn-su-setter-confirm').textContent = 'LOCATION LOCKED';
    
    if (suState.isHost) {
        import('./su-host.js').then(m => m.handleSetterConfirm(panoId, latLng));
    } else {
        sendSuData('setterConfirm', { panoId, latLng });
    }
    
    document.getElementById('screen-su-setter').classList.add('hidden');
    document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
    document.getElementById('waiting-title').textContent = `Waiting for ${suState.currentGuesser.name} to guess...`;
    document.getElementById('waiting-subtitle').textContent = '';
}

async function autoPlaceFallback() {
    if (suState.isHost) {
        import('./su-host.js').then(m => m.autoPlaceLocation(suState.region));
    }
    // Guests don't auto-place, host does it for them if they time out
}
