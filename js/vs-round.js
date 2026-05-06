// ============================================================
// FILE: js/vs-round.js
// PURPOSE: Round orchestration for VS mode. Handles timer, reveal, advance.
// ============================================================

import { vsState } from './vs-state.js';
import { broadcastEvent } from './vs-host.js';
import { sendGuess as guestSendGuess } from './vs-guest.js';
import { getRandomLocation, setVsStreetView } from './streetview.js';
import { calculateScore } from './scoring.js';
import { MAP_SETTINGS } from './config.js';
import { showVsResults } from './vs-results.js';

let timerInterval;
let autoAdvanceTimeout;
let vsMap = null;
let vsMarker = null;
let revealMap = null;
let isMapLocked = false;
let nextVsLocationPromise = null;

export function startVsRound() {
    vsState.gameStarted = true;
    vsState.players.forEach(p => {
        p.hasSubmitted = false;
        p.lastTimeTaken = 0;
    });
    
    // UI Updates
    document.getElementById('vs-current-round').textContent = vsState.currentRound;
    document.getElementById('vs-total-rounds').textContent = vsState.totalRounds;
    document.getElementById('vs-round-reveal-overlay').classList.add('hidden');
    document.getElementById('vs-waiting-message').classList.add('hidden');
    document.getElementById('btn-vs-submit-guess').classList.remove('hidden');
    document.getElementById('btn-vs-submit-guess').disabled = true;
    
    updatePlayerStatusList();
    
    // Transition to game screen
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-vs-game').classList.remove('hidden');

    initVsMap();
    resetVsMap();

    if (vsState.isHost) {
            setupHostRound();
            // Preload next location in background if not last round
            if (vsState.currentRound < vsState.totalRounds) {
                nextVsLocationPromise = getRandomLocation(vsState.region);
            }
        }
    }

async function setupHostRound() {
    try {
        // Use preloaded if available
        const locationData = nextVsLocationPromise
            ? await nextVsLocationPromise
            : await getRandomLocation(vsState.region);

        nextVsLocationPromise = null; // consume it

        vsState.currentLocation = { lat: locationData.lat, lng: locationData.lng };
        
        broadcastEvent('startGame', { 
            location: locationData, 
            round: vsState.currentRound, 
            totalRounds: vsState.totalRounds 
        });
        
        initRoundUI(locationData);
    } catch (err) {
        console.error('Failed to get random location:', err);
    }
}

function initRoundUI(locationData) {
    setVsStreetView(locationData.pano, 'vs-street-view-container');
    startTimer();
}

function startTimer() {
    let timeLeft = 180;
    const timerDisplay = document.getElementById('vs-display-timer');
    const progressBar = document.getElementById('vs-timer-progress-bar');
    
    timerDisplay.textContent = timeLeft;
    progressBar.style.width = '100%';
    progressBar.classList.remove('danger');

    vsState.timerStart = Date.now();

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        const pct = (timeLeft / 180) * 100;
        progressBar.style.width = `${pct}%`;
        
        if (timeLeft <= 30) {
            progressBar.classList.add('danger');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (vsState.isHost) {
                onTimerExpired();
            }
        }
    }, 1000);
}

function onTimerExpired() {
    // If host hasn't submitted
    const hostPlayer = vsState.players.find(p => p.peerId === vsState.localPlayer.peerId);
    if (!hostPlayer.hasSubmitted) {
        submitVsGuess(true); // Forced submit
    }
    
    // For any player who hasn't guessed, auto-submit null is handled on host when all/timer ends
    onAllGuessesReceived();
}

export function handleVsEvent(type, payload) {
    switch (type) {
        case 'startGame':
            vsState.currentRound = payload.round;
            vsState.totalRounds = payload.totalRounds;
            vsState.currentLocation = { lat: payload.location.lat, lng: payload.location.lng };
            startVsRound();
            initRoundUI(payload.location);
            break;
        case 'playerSubmitted':
            handlePlayerSubmitted(payload.peerId);
            break;
        case 'roundReveal':
            showRoundReveal(payload);
            break;
        case 'nextRound':
            vsState.currentRound++;
            startVsRound();
            break;
        case 'showResults':
            showVsResults();
            break;
        case 'playAgain':
            vsState.reset();
            if (vsState.isHost) {
                document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
                document.getElementById('screen-vs-setup').classList.remove('hidden');
            } else {
                document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
                document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
            }
            break;
    }
}

function handlePlayerSubmitted(peerId) {
    const player = vsState.players.find(p => p.peerId === peerId);
    if (player) {
        player.hasSubmitted = true;
        updatePlayerStatusList();
    }
}

export function updatePlayerStatusList() {
    const container = document.getElementById('vs-game-player-status');
    if (!container) return;
    
    container.innerHTML = '';
    vsState.players.forEach(player => {
        if (!player.connected) return;
        
        const tag = document.createElement('div');
        const submitted = player.hasSubmitted;
        
        tag.className = `player-status-tag ${submitted ? 'submitted' : 'waiting'}`;
        tag.innerHTML = `
            <span>${player.name}</span>
            <i data-lucide="${submitted ? 'check-circle' : 'loader-2'}"></i>
        `;
        container.appendChild(tag);
    });
    
    if (window.lucide) window.lucide.createIcons();
    
    container.querySelectorAll('.lucide-loader-2').forEach(icon => {
        icon.classList.add('animate-spin');
    });
}

export function initVsMap() {
    if (vsMap) return;

    vsMap = L.map('vs-guess-map', {
        attributionControl: false,
        zoomControl: false
    }).setView([20, 0], MAP_SETTINGS.INITIAL_ZOOM);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(vsMap);

    vsMap.on('click', (e) => {
        if (isMapLocked) return;
        
        const widget = document.getElementById('vs-guess-map-widget');
        if (widget.classList.contains('collapsed')) {
            widget.classList.remove('collapsed');
            widget.classList.add('expanded');
            setTimeout(() => vsMap.invalidateSize(), 300);
        } else {
            placeVsMarker(e.latlng);
        }
    });

    const widget = document.getElementById('vs-guess-map-widget');
    widget.addEventListener('click', (e) => {
        if (widget.classList.contains('collapsed')) {
            widget.classList.remove('collapsed');
            widget.classList.add('expanded');
            setTimeout(() => vsMap.invalidateSize(), 300);
        }
    });

    document.getElementById('btn-vs-submit-guess').addEventListener('click', () => submitVsGuess());
}

function placeVsMarker(latlng) {
    if (vsMarker) {
        vsMarker.setLatLng(latlng);
    } else {
        vsMarker = L.marker(latlng).addTo(vsMap);
    }
    vsState.currentGuessLatLng = { lat: latlng.lat, lng: latlng.lng };
    document.getElementById('btn-vs-submit-guess').disabled = false;
}

function resetVsMap() {
    isMapLocked = false;
    if (vsMarker) {
        vsMap.removeLayer(vsMarker);
        vsMarker = null;
    }
    vsState.currentGuessLatLng = null;
    document.getElementById('btn-vs-submit-guess').disabled = true;
    
    const widget = document.getElementById('vs-guess-map-widget');
    widget.classList.add('collapsed');
    widget.classList.remove('expanded');
    setTimeout(() => vsMap.invalidateSize(), 300);
}

export function submitVsGuess(isForced = false) {
    isMapLocked = true;
    clearInterval(timerInterval);
    const timeTaken = (Date.now() - vsState.timerStart) / 1000;
    const latLng = isForced ? null : vsState.currentGuessLatLng;
    
    const widget = document.getElementById('vs-guess-map-widget');
    widget.classList.add('collapsed');
    widget.classList.remove('expanded');
    
    document.getElementById('btn-vs-submit-guess').classList.add('hidden');
    document.getElementById('vs-waiting-message').classList.remove('hidden');

    if (vsState.isHost) {
        const hostPlayer = vsState.players.find(p => p.peerId === vsState.localPlayer.peerId);
        hostPlayer.guesses[vsState.currentRound - 1] = latLng;
        hostPlayer.lastTimeTaken = timeTaken;
        hostPlayer.hasSubmitted = true;
        
        broadcastEvent('playerSubmitted', { peerId: vsState.localPlayer.peerId });
        updatePlayerStatusList();
        
        checkAllGuessesReceived();
    } else {
        guestSendGuess(latLng, timeTaken);
        const localPlayer = vsState.players.find(p => p.peerId === vsState.localPlayer.peerId);
        if (localPlayer) localPlayer.hasSubmitted = true;
        updatePlayerStatusList();
    }
}

function checkAllGuessesReceived() {
    const activePlayers = vsState.players.filter(p => p.connected);
    const guessesInRound = activePlayers.filter(p => p.hasSubmitted);
    
    if (guessesInRound.length === activePlayers.length) {
        onAllGuessesReceived();
    }
}

export function onAllGuessesReceived() {
    if (!vsState.isHost) return;

    const roundResults = {
        correctLocation: vsState.currentLocation,
        guesses: {}
    };

    vsState.players.forEach(player => {
        const guess = player.guesses[vsState.currentRound - 1] || null;
        const result = calculateScore(
            guess,
            vsState.currentLocation,
            player.lastTimeTaken || 0,
            180,
            false,
            0
        );
        
        player.scores[vsState.currentRound - 1] = result.totalScore;
        roundResults.guesses[player.peerId] = {
            name: player.name,
            latLng: guess,
            score: result.totalScore,
            distance: result.distanceKm,
            timeTaken: player.lastTimeTaken || 0
        };
    });

    vsState.roundResults.push(roundResults);
    
    broadcastEvent('roundReveal', roundResults);
    showRoundReveal(roundResults);
}

export function showRoundReveal(results) {
    clearInterval(timerInterval);
    document.getElementById('vs-round-reveal-overlay').classList.remove('hidden');
    
    if (revealMap) {
        revealMap.remove();
    }
    revealMap = L.map('vs-reveal-map', {
        attributionControl: false
    }).setView([0, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(revealMap);

    const markers = [];
    const answerLatLng = [results.correctLocation.lat, results.correctLocation.lng];
    
    const answerMarker = L.marker(answerLatLng, {
        icon: L.divIcon({
            className: 'custom-marker',
            html: '<div class="marker-pin answer" style="background:white;width:12px;height:12px;border-radius:50%;border:2px solid black"></div><label style="background:white;color:black;padding:2px 5px;border-radius:4px;font-size:10px;font-weight:bold;position:absolute;top:-20px;left:-20px;white-space:nowrap">ANSWER</label>'
        })
    }).addTo(revealMap);
    markers.push(answerMarker);

    Object.entries(results.guesses).forEach(([peerId, data]) => {
        if (!data.latLng) return;
        
        const guessLatLng = [data.latLng.lat, data.latLng.lng];
        const guessMarker = L.marker(guessLatLng, {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div class="marker-pin guess" style="background:var(--color-teal);width:10px;height:10px;border-radius:50%"></div><label style="background:var(--color-teal);color:white;padding:2px 4px;border-radius:4px;font-size:10px;position:absolute;top:-20px;left:-20px;white-space:nowrap">${data.name}</label>`
            })
        }).addTo(revealMap);
        markers.push(guessMarker);

        L.polyline([guessLatLng, answerLatLng], {
            color: 'var(--color-teal)',
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.6
        }).addTo(revealMap);
    });

    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        revealMap.fitBounds(group.getBounds(), { padding: [50, 50] });
    }

    renderRoundLeaderboard(results);
    
    if (vsState.isHost) {
        const nextBtn = document.getElementById('btn-vs-next-round');
        nextBtn.classList.remove('hidden');
        if (vsState.currentRound < vsState.totalRounds) {
            nextBtn.textContent = 'NEXT ROUND';
        } else {
            nextBtn.textContent = 'FINAL RESULTS';
        }
        
        nextBtn.onclick = advanceRound;
        
        clearTimeout(autoAdvanceTimeout);
        autoAdvanceTimeout = setTimeout(advanceRound, 60000);
    }
}

function renderRoundLeaderboard(results) {
    const panel = document.getElementById('vs-round-leaderboard');
    panel.innerHTML = '';
    
    const sortedPlayers = [...vsState.players].sort((a, b) => {
        const totalA = (a.scores || []).reduce((sum, s) => sum + s, 0);
        const totalB = (b.scores || []).reduce((sum, s) => sum + s, 0);
        return totalB - totalA;
    });

    sortedPlayers.forEach((player, index) => {
        const roundData = results.guesses[player.peerId];
        const roundScore = roundData ? roundData.score : 0;
        const totalScore = (player.scores || []).reduce((sum, s) => sum + s, 0);
        
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        if (index === 0) row.classList.add('gold');
        else if (index === 1) row.classList.add('silver');
        else if (index === 2) row.classList.add('bronze');
        
        row.innerHTML = `
            <div class="row-rank">${index + 1}</div>
            <div class="row-name">${player.name}</div>
            <div class="row-score">
                <div style="font-size: 16px">+${roundScore.toLocaleString()}</div>
                <div style="font-size: 11px; opacity:0.7">${totalScore.toLocaleString()} total</div>
            </div>
        `;
        panel.appendChild(row);
    });

    panel.classList.add('visible');
}

function advanceRound() {
    clearTimeout(autoAdvanceTimeout);
    if (vsState.currentRound < vsState.totalRounds) {
        broadcastEvent('nextRound');
        vsState.currentRound++;
        startVsRound();
    } else {
        broadcastEvent('showResults');
        showVsResults();
    }
}
