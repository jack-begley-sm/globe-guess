// ============================================================
// FILE: main.js
// PURPOSE: Application entry point. Initializes all modules.
//
// DEPENDENCIES:
//   - js/lobby.js
//   - js/round.js
//   - js/results.js
//   - js/config.js
//
// USED BY:
//   - index.html
//
// KEY FUNCTIONS:
//   - DOMContentLoaded listener initializes the app
// ============================================================

import { initLobby } from './js/lobby.js';
import { initRoundEvents } from './js/round.js';
import { initResults } from './js/results.js';
import { VERSION } from './js/config.js';
import { initVsSetup } from './js/vs-lobby.js';
import { joinGame } from './js/vs-guest.js';
import { vsState } from './js/vs-state.js';
import { suState } from './js/su-state.js';
import { initSuSetup } from './js/su-lobby.js';
import { joinSuGame } from './js/su-guest.js';
import { preloadGoogleMaps } from './js/streetview.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Globe Guess Initializing...');
    
    // Set version display
    const versionDisplay = document.getElementById('version-display');
    if (versionDisplay) versionDisplay.textContent = `v${VERSION}`;

    // Initialize screen transitions
    const landingScreen = document.getElementById('screen-landing');
    const lobbyScreen = document.getElementById('screen-lobby');
    const vsSetupScreen = document.getElementById('screen-vs-setup');
    const classicBtn = document.getElementById('btn-mode-classic');
    const vsBtn = document.getElementById('btn-mode-vs');
    const suBtn = document.getElementById('btn-mode-su');

    if (classicBtn) {
        classicBtn.addEventListener('click', () => {
            landingScreen.classList.add('hidden');
            lobbyScreen.classList.remove('hidden');
        });
    }

    if (vsBtn) {
        vsBtn.addEventListener('click', () => {
            landingScreen.classList.add('hidden');
            vsSetupScreen.classList.remove('hidden');
        });
    }

    if (suBtn) {
        suBtn.addEventListener('click', () => {
            landingScreen.classList.add('hidden');
            document.getElementById('screen-su-setup').classList.remove('hidden');
        });
    }

    const backBtn = document.getElementById('btn-lobby-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            lobbyScreen.classList.add('hidden');
            landingScreen.classList.remove('hidden');
        });
    }

    // Use query parameters instead of path — works on GitHub Pages
    const params = new URLSearchParams(window.location.search);
    const vsCode = params.get('join');
    const suCode = params.get('join-su');

    if (vsCode) {
        vsState.roomCode = vsCode;
        document.getElementById('modal-vs-join').classList.remove('hidden');
    }

    if (suCode) {
        suState.roomCode = suCode;
        document.getElementById('modal-su-join').classList.remove('hidden');
    }

    document.getElementById('btn-vs-join-game').addEventListener('click', () => {
        const nameInput = document.getElementById('input-vs-guest-name');
        const name = nameInput.value.trim();
        const errorMsg = document.getElementById('error-vs-guest-name');

        if (!name) {
            errorMsg.classList.remove('hidden');
            nameInput.focus();
            return;
        }
        errorMsg.classList.add('hidden');
        joinGame(vsState.roomCode, name);
    });

    document.getElementById('btn-vs-return-home').addEventListener('click', () => {
        window.location.href = '/';
    });

    document.getElementById('btn-su-join-game').addEventListener('click', () => {
        const nameInput = document.getElementById('input-su-guest-name');
        const name = nameInput.value.trim();
        const errorMsg = document.getElementById('error-su-guest-name');

        if (!name) {
            errorMsg.classList.remove('hidden');
            nameInput.focus();
            return;
        }
        errorMsg.classList.add('hidden');
        joinSuGame(suState.roomCode, name);
    });

    document.getElementById('btn-su-return-home').addEventListener('click', () => {
        window.location.href = '/';
    });
    
    initLobby();
    initVsSetup();
    initSuSetup();
    initRoundEvents();
    initResults();
    
    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Preload Google Maps API immediately so it's ready when game starts
    preloadGoogleMaps();

    console.log('Globe Guess Ready.');
});
