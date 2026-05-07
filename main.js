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

import './css/base.css';
import './css/layout.css';
import './css/components.css';
import './css/vs.css';
import './css/su.css';

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
    const joinBtn = document.getElementById('btn-show-join');

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

    if (joinBtn) {
        joinBtn.addEventListener('click', () => {
            landingScreen.classList.add('hidden');
            document.getElementById('screen-join-game').classList.remove('hidden');
        });
    }

    const backBtn = document.getElementById('btn-lobby-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            lobbyScreen.classList.add('hidden');
            landingScreen.classList.remove('hidden');
        });
    }

    const joinBackBtn = document.getElementById('btn-join-back');
    if (joinBackBtn) {
        joinBackBtn.addEventListener('click', () => {
            document.getElementById('screen-join-game').classList.add('hidden');
            landingScreen.classList.remove('hidden');
        });
    }

    // Handle Join Game Submit
    const joinSubmitBtn = document.getElementById('btn-join-submit');
    const joinNameInput = document.getElementById('input-join-name');
    const joinCodeInput = document.getElementById('input-join-code');

    if (joinCodeInput) {
        joinCodeInput.addEventListener('input', () => {
            joinCodeInput.value = joinCodeInput.value.toUpperCase();
        });
    }

    if (joinSubmitBtn) {
        joinSubmitBtn.addEventListener('click', () => {
            const name = joinNameInput.value.trim();
            const code = joinCodeInput.value.trim().toUpperCase();
            
            if (!name) {
                document.getElementById('error-join-name').classList.remove('hidden');
                joinNameInput.focus();
                return;
            }
            document.getElementById('error-join-name').classList.add('hidden');
            
            if (!code || code.length < 4) {
                document.getElementById('error-join-code').classList.remove('hidden');
                joinCodeInput.focus();
                return;
            }
            document.getElementById('error-join-code').classList.add('hidden');
            
            // Redirect with join code and name
            const baseUrl = window.location.origin + window.location.pathname;
            window.location.href = `${baseUrl}?join=${code}&name=${encodeURIComponent(name)}`;
        });
    }

    // Use query parameters instead of path — works on GitHub Pages
    const params = new URLSearchParams(window.location.search);
    const vsCode = params.get('join') || params.get('join-vs');
    const suCode = params.get('join-su');
    const playerName = params.get('name');

    if (vsCode) {
        vsState.roomCode = vsCode;
        if (playerName) {
            joinGame(vsCode, playerName);
        } else {
            document.getElementById('modal-vs-join').classList.remove('hidden');
        }
    }

    if (suCode) {
        suState.roomCode = suCode;
        if (playerName) {
            joinSuGame(suCode, playerName);
        } else {
            document.getElementById('modal-su-join').classList.remove('hidden');
        }
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
        window.location.href = './';
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
        window.location.href = './';
    });

    document.querySelectorAll('.multiplayer-return-home').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = './';
        });
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
