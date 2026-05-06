// ============================================================
// FILE: js/round.js
// PURPOSE: Orchestrates a single round and the overall game flow.
//
// DEPENDENCIES:
//   - js/state.js       (reads/writes round state)
//   - js/streetview.js  (initializes SV)
//   - js/map.js         (handles guess map)
//   - js/scoring.js     (calculates round score)
//
// USED BY:
//   - js/lobby.js       (starts game)
//   - main.js           (initializes UI events)
//
// KEY FUNCTIONS:
//   - startGame()       resets state and starts round 1
//   - startRound()      sets up current round UI and logic
//   - endRound()        calculates score and shows results
// ============================================================

import { state, resetState } from './state.js';
import { initMap, resetMap, submitGuess, showResultOnMap } from './map.js';
import { calculateScore } from './scoring.js';
import { renderResults } from './results.js';
import { getRandomLocation, initStreetView } from './streetview.js';

let timerInterval;

let nextLocationPromise = null;

export function startGame() {
    state.currentRound = 0;
    state.scores = [];
    initMap();  // ← must be before startRound
    nextLocationPromise = getRandomLocation(state.region);
    startRound();
}

export function startRound() {
    document.getElementById('screen-game').classList.remove('hidden');
    document.getElementById('round-result-overlay').classList.add('hidden');
    document.getElementById('btn-next-round').onclick = null;

    state.currentRound++;
    state.guessLatLng = null;
    state.timerStart = Date.now();

    updateRoundUI();
    resetMap();

    // Use preloaded location if available, otherwise fetch now
    const locationPromise = nextLocationPromise || getRandomLocation(state.region);
    nextLocationPromise = null;

    locationPromise.then((location) => {
        // Set state
        state.currentLocation = location;

        // Load panorama from already-found pano ID — no API search needed
        return initStreetView(state.region, location.lat, location.lng)
    }).then(() => {
        // Start pre-fetching next round in background while user plays
        if (state.currentRound < state.totalRounds) {
            nextLocationPromise = getRandomLocation(state.region);
        }
        startTimer();
    }).catch(err => {
        console.error(err);
        startTimer();
    });
}

function startTimer() {
    let timeLeft = state.timeLimit;
    let countUp = 0;
    const timerDisplay = document.getElementById('display-timer');
    const progressBar = document.getElementById('timer-progress-bar');
    
    if (state.timeLimit === 0) {
        progressBar.style.width = '0%';
        timerDisplay.textContent = '0';
    } else {
        progressBar.style.width = '100%';
        timerDisplay.textContent = timeLeft;
    }

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (state.timeLimit === 0) {
            countUp++;
            timerDisplay.textContent = countUp;
        } else {
            timeLeft--;
            timerDisplay.textContent = timeLeft;
            const pct = (timeLeft / state.timeLimit) * 100;
            progressBar.style.width = `${pct}%`;
            
            if (timeLeft <= 10) {
                progressBar.classList.add('danger');
            } else {
                progressBar.classList.remove('danger');
            }

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                endRound();
            }
        }
    }, 1000);
}

export function endRound() {
    clearInterval(timerInterval);
    const timeTaken = (Date.now() - state.timerStart) / 1000;
    
    const guess = submitGuess();
    const result = calculateScore(
        guess, 
        state.currentLocation, 
        timeTaken, 
        state.timeLimit, 
        state.speedBonusPct > 0, 
        state.speedBonusPct
    );

    state.scores.push({
        round: state.currentRound,
        location: state.currentLocation,
        guess: guess,
        ...result
    });

    showRoundResult(result);
}

function showRoundResult(result) {
    const overlay = document.getElementById('round-result-overlay');
    const distEl = document.getElementById('result-distance');
    const scoreEl = document.getElementById('result-score');
    const breakdownEl = document.getElementById('result-score-breakdown');
    
    distEl.textContent = `${result.distanceKm} km`;
    if (result.distanceKm < 100) {
        distEl.classList.add('gold');
    } else {
        distEl.classList.remove('gold');
    }

    if (state.speedBonusPct > 0 && result.speedScore > 0) {
        breakdownEl.classList.remove('hidden');
        document.getElementById('val-base-score').textContent = result.baseScore.toLocaleString();
        document.getElementById('val-speed-score').textContent = result.speedScore.toLocaleString();
    } else {
        breakdownEl.classList.add('hidden');
    }

    scoreEl.textContent = `+${result.totalScore.toLocaleString()} pts`;
    overlay.classList.remove('hidden');

    showResultOnMap(state.currentLocation, 'result-mini-map');

    const nextBtn = document.getElementById('btn-next-round');
    if (state.currentRound < state.totalRounds) {
        nextBtn.textContent = 'NEXT ROUND';
    } else {
        nextBtn.textContent = 'SEE RESULTS';
    }

    // Guard against double-advance
    let advanced = false;
    const safeAdvance = () => {
        if (advanced) return;
        advanced = true;
        clearTimeout(autoAdvance);
        document.getElementById('round-result-overlay').classList.add('hidden');
        advance();
    };
    const autoAdvance = setTimeout(safeAdvance, 4000);
    nextBtn.onclick = safeAdvance;
}

function advance() {
    if (state.currentRound < state.totalRounds) {
        startRound();
    } else {
        endGame();
    }
}

function endGame() {
    document.getElementById('screen-game').classList.add('hidden');
    document.getElementById('screen-results').classList.remove('hidden');
    renderResults();
}

function updateRoundUI() {
    document.getElementById('current-round').textContent = state.currentRound;
    document.getElementById('total-rounds').textContent = state.totalRounds;
}

export function initRoundEvents() {
    document.getElementById('btn-submit-guess').addEventListener('click', endRound);
}
