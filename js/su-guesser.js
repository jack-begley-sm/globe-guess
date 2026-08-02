// ============================================================
// FILE: js/su-guesser.js
// PURPOSE: Guesser phase UI, Street View loading, guess map.
// ============================================================

import { suState } from './su-state.js';
import { sendSuData } from './su-guest.js';
import { setVsStreetView } from './streetview.js';

let guessMap = null;
let guessMarker = null;
let guessTimerInterval = null;
let currentGuess = null;
let startTime = 0;

export function initGuesserPhase(panoId, setterName, autoPlaced) {
    document.getElementById('screen-su-guesser').classList.remove('hidden');
    document.getElementById('su-guesser-round-num').textContent = `ROUND ${suState.currentRound} / ${suState.totalRounds}`;
    document.getElementById('su-guesser-setter-name').textContent = `${setterName} chose this for you ${autoPlaced ? '(Auto-placed)' : ''}`;
    
    const submitBtn = document.getElementById('btn-su-submit-guess');
    submitBtn.disabled = true;

    const refreshBtn = document.getElementById('btn-su-guesser-refresh');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            console.log('Manual Street View refresh triggered');
            setVsStreetView(panoId, 'su-street-view-container');
            
            // Visual feedback
            const icon = refreshBtn.querySelector('i');
            if (icon) icon.style.animation = 'spin 0.5s ease-in-out';
            setTimeout(() => { if (icon) icon.style.animation = ''; }, 500);
        };
    }

    setVsStreetView(panoId, 'su-street-view-container');
    initGuessMap();
    startGuesserTimer(120);
    startTime = Date.now();

    submitBtn.onclick = () => submitSuGuess();
}

function initGuessMap() {
    if (guessMap) {
        guessMap.remove();
    }

    const mapContainer = document.getElementById('su-guess-map-container');
    const closeBtn = document.getElementById('btn-su-map-close');

    // Reset state
    mapContainer.classList.remove('expanded');
    if (closeBtn) closeBtn.classList.add('hidden');

    guessMap = L.map('su-guess-map', {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        worldCopyJump: true,
        zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(guessMap);

    guessMarker = null;
    currentGuess = null;

    guessMap.on('click', (e) => {
        if (mapContainer.classList.contains('expanded')) {
            // Panning more than one world-width gives longitudes outside
            // -180..180 (e.g. 380 instead of 20); wrap so the setter/spectator
            // reveal doesn't render a duplicate world copy far from the guess.
            const { lat, lng } = e.latlng.wrap();
            placeGuessPin(lat, lng);
        } else {
            // Expand on click
            mapContainer.classList.add('expanded');
            if (closeBtn) closeBtn.classList.remove('hidden');
            setTimeout(() => {
                guessMap.invalidateSize();
            }, 300);
        }
    });

    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            mapContainer.classList.remove('expanded');
            closeBtn.classList.add('hidden');
            setTimeout(() => {
                guessMap.invalidateSize();
            }, 300);
        };
    }
}

function placeGuessPin(lat, lng) {
    if (guessMarker) {
        guessMarker.setLatLng([lat, lng]);
    } else {
        const ivoryIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #fffff0; width: 15px; height: 15px; border-radius: 50%; border: 2px solid var(--color-bg);"></div>`,
            iconSize: [15, 15],
            iconAnchor: [7, 7]
        });
        guessMarker = L.marker([lat, lng], { icon: ivoryIcon }).addTo(guessMap);
    }

    currentGuess = { lat, lng };
    document.getElementById('btn-su-submit-guess').disabled = false;
    
    // Broadcast live pin update
    sendSuData('livePinUpdate', { latLng: currentGuess });
}

function startGuesserTimer(seconds) {
    const timerEl = document.getElementById('su-guesser-timer');
    let timeLeft = seconds;
    timerEl.textContent = timeLeft;
    timerEl.classList.remove('danger');

    clearInterval(guessTimerInterval);
    guessTimerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 15) timerEl.classList.add('danger');
        
        if (timeLeft <= 0) {
            clearInterval(guessTimerInterval);
            submitSuGuess(true);
        }
    }, 1000);
}

function submitSuGuess(timedOut = false) {
    clearInterval(guessTimerInterval);
    const timeTaken = Date.now() - startTime;
    const guess = timedOut ? null : currentGuess;

    if (suState.isHost) {
        import('./su-host.js').then(m => m.handleGuesserSubmit(guess, timeTaken));
    } else {
        sendSuData('guesserSubmit', { latLng: guess, timeTaken });
    }

    document.getElementById('screen-su-guesser').classList.add('hidden');
    document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
    document.getElementById('waiting-title').textContent = `Guess submitted — waiting for reveal`;
    document.getElementById('waiting-subtitle').textContent = '';
}
