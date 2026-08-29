// ============================================================
// FILE: js/lobby.js
// PURPOSE: Handles the configuration screen and starts the game.
//
// DEPENDENCIES:
//   - js/state.js       (writes initial config)
//   - js/user.js        (reads/writes player name)
//   - js/round.js       (calls startGame)
//   - js/geo/shapes.js  (getShape, to set state.shape alongside region)
//   - js/custom-lobby.js (openCustomDraw, for the region grid's Custom tile)
//
// USED BY:
//   - main.js           (initializes lobby events)
//
// KEY FUNCTIONS:
//   - initLobby()        sets up event listeners and default UI values
//   - handleStart()      validates config and transitions to game
// ============================================================

import { state } from './state.js';
import { startGame } from './round.js';
import { getUser, setUser } from './user.js';
import { getShape } from './geo/shapes.js';
import { openCustomDraw } from './custom-lobby.js';

export function initLobby() {
    const startBtn = document.getElementById('btn-start-classic');
    if (!startBtn) return;

    // Load name from storage
    const nameInput = document.getElementById('input-player-name');
    if (nameInput) {
        nameInput.value = getUser() || '';
    }

    // Segmented control logic (Rounds & Time)
    setupSegmentedControl('control-rounds');
    setupSegmentedControl('control-time');

    // Region grid logic
    setupGridSelection('region-grid');

    // Speed bonus toggle logic
    const bonusToggle = document.getElementById('toggle-speed-bonus');
    const bonusSettings = document.getElementById('speed-bonus-settings');
    const bonusSlider = document.getElementById('slider-speed-bonus');
    const bonusValDisplay = document.getElementById('val-speed-bonus');
    
    if (bonusToggle && bonusSettings) {
        bonusToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                bonusSettings.classList.remove('hidden');
            } else {
                bonusSettings.classList.add('hidden');
            }
        });
    }

    if (bonusSlider && bonusValDisplay) {
        bonusSlider.addEventListener('input', (e) => {
            bonusValDisplay.textContent = e.target.value;
        });
    }

    startBtn.addEventListener('click', handleStart);
}

function setupSegmentedControl(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
}

function setupGridSelection(className) {
    const grid = document.querySelector(`.${className}`);
    if (!grid) return;

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        // Custom is a stage of its own, not an instant selection like the
        // built-in regions — it opens the draw screen, and only becomes
        // the active choice once an area is actually confirmed (handled
        // in handleCustomAreaConfirmed, not here).
        if (btn.dataset.region === 'CUSTOM') {
            openCustomDraw('screen-lobby', handleCustomAreaConfirmed);
            return;
        }

        grid.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
}

function handleCustomAreaConfirmed(shape) {
    state.shape = shape;
    state.region = 'CUSTOM';
    document.getElementById('section-region').classList.add('hidden');

    const summary = document.getElementById('custom-area-summary');
    summary.textContent = `Custom area: about ${Math.round(shape.scaleKm)} km across`;
    summary.classList.remove('hidden');
}

function handleStart() {
    const nameInput = document.getElementById('input-player-name');
    const name = nameInput.value.trim();
    const errorMsg = document.getElementById('error-name');

    if (!name) {
        errorMsg.classList.remove('hidden');
        nameInput.focus();
        return;
    }
    errorMsg.classList.add('hidden');
    setUser(name);

    // Read values from DOM
    const roundsBtn = document.querySelector('#control-rounds button.active');
    state.totalRounds = parseInt(roundsBtn.dataset.value);

    const timeBtn = document.querySelector('#control-time button.active');
    const timeVal = timeBtn.dataset.value;
    state.timeLimit = timeVal === 'unlimited' ? 0 : parseInt(timeVal);
    
    state.speedBonusPct = document.getElementById('toggle-speed-bonus').checked 
        ? parseInt(document.getElementById('slider-speed-bonus').value) 
        : 0;
        
    // A confirmed Custom area already set state.region/state.shape and hid
    // the region grid (handleCustomAreaConfirmed, above) — the grid's own
    // buttons are still in the DOM underneath it, so reading it
    // unconditionally here would silently throw the drawn area away and
    // replace it with whichever built-in region happens to be marked
    // .active (WORLD, by default). Only read the grid when it's actually
    // the active choice.
    if (state.region !== 'CUSTOM') {
        const regionBtn = document.querySelector('.region-grid button.active');
        state.region = regionBtn.dataset.region;
        state.shape = getShape(state.region);
    }

    // Transition
    document.getElementById('screen-lobby').classList.add('hidden');
    document.getElementById('screen-game').classList.remove('hidden');

    startGame();
}
