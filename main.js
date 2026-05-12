// ============================================================
// FILE: main.js
// PURPOSE: Application entry point. Initializes all modules.
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
import { getSession, clearSession } from './js/user.js';
import { initHost } from './js/vs-host.js';
import { initSuHost } from './js/su-host.js';

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
    const coopBtn = document.getElementById('btn-mode-coop');
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
            vsState.gameMode = 'vs';
            landingScreen.classList.add('hidden');
            vsSetupScreen.classList.remove('hidden');
            document.querySelector('#screen-vs-setup h1').textContent = 'VS MODE SETUP';
        });
    }

    if (coopBtn) {
        coopBtn.addEventListener('click', () => {
            vsState.gameMode = 'coop';
            landingScreen.classList.add('hidden');
            vsSetupScreen.classList.remove('hidden');
            document.querySelector('#screen-vs-setup h1').textContent = 'CO-OP SETUP';
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

    // Mode selector for Join Screen
    const joinModeContainer = document.getElementById('control-join-mode');
    if (joinModeContainer) {
        joinModeContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            joinModeContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
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
        joinSubmitBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent accidental form reload
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

            const baseUrl = window.location.origin + window.location.pathname;
            const modeBtn = document.querySelector('#control-join-mode button.active');
            const mode = modeBtn ? modeBtn.dataset.mode : 'vs';
            let param = 'join';
            if (mode === 'su') param = 'join-su';
            if (mode === 'coop') param = 'join-coop';

            window.location.href = `${baseUrl}?${param}=${code}&name=${encodeURIComponent(name)}`;
        });
    }

    // Parse URL Parameters
    const params = new URLSearchParams(window.location.search);
    const vsCode = params.get('join') || params.get('join-vs');
    const coopCode = params.get('join-coop');
    const suCode = params.get('join-su');
    const playerName = params.get('name');

    if (playerName) {
        if (vsCode) {
            joinGame(vsCode, playerName);
            return;
        } else if (coopCode) {
            vsState.gameMode = 'coop';
            joinGame(coopCode, playerName);
            return;
        } else if (suCode) {
            joinSuGame(suCode, playerName);
            return;
        }
    } else {
        // If we have a code but no name, show the appropriate modal
        if (vsCode || coopCode) {
            vsState.roomCode = vsCode || coopCode;
            document.getElementById('modal-vs-join').classList.remove('hidden');
        } else if (suCode) {
            suState.roomCode = suCode;
            document.getElementById('modal-su-join').classList.remove('hidden');
        }
    }

    // Modal Join Buttons
    document.getElementById('btn-vs-join-game').addEventListener('click', () => {
        const nameInput = document.getElementById('input-vs-guest-name');
        const name = nameInput.value.trim();
        if (name) joinGame(vsState.roomCode, name);
    });

    document.getElementById('btn-su-join-game').addEventListener('click', () => {
        const nameInput = document.getElementById('input-su-guest-name');
        const name = nameInput.value.trim();
        if (name) joinSuGame(suState.roomCode, name);
    });

    // Navigation Home Buttons
    document.querySelectorAll('.multiplayer-return-home, #btn-vs-return-home, #btn-su-return-home').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Cleaning session and returning home...');
            clearSession();

            // This forces the browser to the root URL without parameters
            const cleanUrl = window.location.origin + window.location.pathname;
            window.location.href = cleanUrl;
        });
    });

    // Module Initializations
    initLobby();
    initVsSetup();
    initSuSetup();
    initRoundEvents();
    initResults();

    if (window.lucide) window.lucide.createIcons();
    preloadGoogleMaps();

    // Session Restoration Logic
    const session = getSession();
    const isJoiningViaURL = (vsCode || coopCode || suCode);

    if (session && !isJoiningViaURL) {
        console.log('Restoring existing session:', session);
        if (session.role === 'host') {
            if (session.mode === 'vs') {
                vsState.localPlayer.name = session.name;
                vsState.gameMode = session.gameMode || 'vs';
                initHost(session.roomCode);
                document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
                document.getElementById('screen-multiplayer-lobby').classList.remove('hidden');
            } else if (session.mode === 'su') {
                suState.localPlayer.name = session.name;
                initSuHost(session.roomCode);
                document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
                document.getElementById('screen-multiplayer-lobby').classList.remove('hidden');
            }
        } else {
            // Guest restoration
            if (session.mode === 'vs') {
                vsState.gameMode = session.gameMode || 'vs';
                joinGame(session.roomCode, session.name);
            } else if (session.mode === 'su') {
                joinSuGame(session.roomCode, session.name);
            }
        }
    }

    console.log('Globe Guess Ready.');
});