// ============================================================
// FILE: js/lobby.js
// PURPOSE: Handles the configuration screen and starts the game.
//
// DEPENDENCIES:
//   - js/state.js       (writes initial config)
//   - js/user.js        (reads/writes player name)
//   - js/round.js       (calls startGame)
//   - js/geo/shapes.js  (getShape, to set state.shape alongside region)
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

        grid.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
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
        
    const regionBtn = document.querySelector('.region-grid button.active');
    state.region = regionBtn.dataset.region;
    state.shape = getShape(state.region);

    // Transition
    document.getElementById('screen-lobby').classList.add('hidden');
    document.getElementById('screen-game').classList.remove('hidden');

    startGame();
}
