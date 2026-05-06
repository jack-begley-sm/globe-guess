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
        const { lat, lng } = e.latlng;
        placeGuessPin(lat, lng);
    });
}

function placeGuessPin(lat, lng) {
    if (guessMarker) {
        guessMarker.setLatLng([lat, lng]);
    } else {
        const ivoryIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #fffff0; width: 15px; height: 15px; border-radius: 50%; border: 2px solid var(--bg-1);"></div>`,
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
