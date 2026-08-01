// ============================================================
// FILE: js/su-lobby.js
// PURPOSE: Host setup, share screen, and lobby for Stitch Up.
// ============================================================

import { suState } from './su-state.js';
import { getUser, setUser } from './user.js';
import { getLocalIP } from './vs-lobby.js';
import { initSuHost, kickSuPlayer, startStitchUpGame } from './su-host.js';

const GITHUB_PAGES_URL = 'https://jack-begley-sm.github.io/globe-guess';

export function initSuSetup() {
    const setupNextBtn = document.getElementById('btn-su-setup-next');
    const nameInput = document.getElementById('input-su-host-name');
    
    if (nameInput) {
        nameInput.value = getUser() || '';
    }

    if (setupNextBtn) {
        setupNextBtn.addEventListener('click', handleSuSetupNext);
    }

    setupSegmentedControl('control-su-rounds');
    setupGridSelection('su-region-grid');

    document.querySelectorAll('.su-return-home').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = './';
        });
    });

    const shareContinueBtn = document.getElementById('btn-share-continue');
    if (shareContinueBtn) {
        shareContinueBtn.addEventListener('click', () => {
            document.getElementById('screen-multiplayer-share').classList.add('hidden');
            document.getElementById('screen-multiplayer-lobby').classList.remove('hidden');
        });
    }

    const startBtn = document.getElementById('btn-start-multiplayer');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (suState.players.length < 2) {
                const errorMsg = document.getElementById('lobby-error');
                errorMsg.classList.remove('hidden');
                return;
            }
            document.getElementById('lobby-error').classList.add('hidden');
            
            // Broadcast start event
            startStitchUpGame();
        });
    }
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

function setupGridSelection(containerId) {
    const grid = document.getElementById(containerId);
    if (!grid) return;

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        grid.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
}

async function handleSuSetupNext() {
    const nameInput = document.getElementById('input-su-host-name');
    const name = nameInput.value.trim();
    const errorMsg = document.getElementById('error-su-host-name');

    if (!name) {
        errorMsg.classList.remove('hidden');
        nameInput.focus();
        return;
    }
    errorMsg.classList.add('hidden');
    setUser(name);

    suState.isHost = true;
    suState.localPlayer.name = name;
    
    const roundsBtn = document.querySelector('#control-su-rounds button.active');
    suState.totalRounds = parseInt(roundsBtn.dataset.value);
    
    const regionBtn = document.querySelector('#su-region-grid button.active');
    suState.region = regionBtn.dataset.region;

    // Re-hosting an existing room (e.g. "Play Again" after a game ends) —
    // keep the same room code, peer connection, and player list instead of
    // tearing down the live peer and disconnecting everyone into a new lobby.
    if (suState.roomCode) {
        document.getElementById('screen-su-setup').classList.add('hidden');
        document.getElementById('screen-multiplayer-lobby').classList.remove('hidden');
        const lobbyCodeEl = document.getElementById('lobby-room-code');
        if (lobbyCodeEl) lobbyCodeEl.textContent = `CODE: ${suState.roomCode}`;
        renderSuPlayerList(suState.players);
        return;
    }

    const roomCode = generateSuRoomCode();
    suState.roomCode = roomCode;
    suState.localPlayer.peerId = roomCode; // Host ID is room code

    // Add host to players list
    suState.players = [{
        name: name,
        peerId: roomCode,
        connected: true,
        setterScores: [],
        guesserScores: []
    }];

    // Initialize Host PeerJS
    initSuHost(roomCode);

    // Prepare share screen
    document.getElementById('display-room-code').textContent = roomCode;
    document.getElementById('lobby-room-code').textContent = `CODE: ${roomCode}`;
    
    let joinURL;
    if (window.Capacitor?.isNativePlatform()) {
        joinURL = `${GITHUB_PAGES_URL}/?join-su=${roomCode}`;
    } else {
        const hostname = window.location.hostname;
        const port = window.location.port || '5173';
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // localhost is unreachable by guests — use GitHub Pages
            joinURL = `${GITHUB_PAGES_URL}/?join-su=${roomCode}`;
        } else {
            // Real network IP — guests on same WiFi can reach this
            joinURL = `http://${hostname}:${port}/?join-su=${roomCode}`;
        }
    }

    const urlInput = document.getElementById('input-share-url');
    if (urlInput) {
        urlInput.value = joinURL;
        urlInput.readOnly = false;
    }

    if (typeof updateWhatsAppLink === 'function') {
        updateWhatsAppLink(joinURL);
    }

    function updateWhatsAppLink(url) {
        const whatsappBtn = document.getElementById('btn-share-whatsapp');
        const text = encodeURIComponent(`Join my Globe Guess Stitch Up game! ${url}`);
        whatsappBtn.href = `https://wa.me/?text=${text}`;
    }

    urlInput.addEventListener('input', () => {
        updateWhatsAppLink(urlInput.value);
    });
    
    document.getElementById('btn-copy-link').onclick = () => {
        navigator.clipboard.writeText(urlInput.value);
        const btn = document.getElementById('btn-copy-link');
        const icon = btn.querySelector('i, svg');
        if (!icon) return;
        const oldIcon = icon.getAttribute('data-lucide');
        icon.setAttribute('data-lucide', 'check');
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
            icon.setAttribute('data-lucide', oldIcon);
            if (window.lucide) window.lucide.createIcons();
        }, 2000);
    };


    // Transition
    document.getElementById('screen-su-setup').classList.add('hidden');
    document.getElementById('screen-multiplayer-share').classList.remove('hidden');
    
    renderSuPlayerList(suState.players);
}

export function generateSuRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export function renderSuPlayerList(players) {
    const container = suState.isHost ? document.getElementById('lobby-player-list') : document.getElementById('waiting-player-list');
    const count = document.getElementById('lobby-player-count');
    const waitingMsg = document.getElementById('lobby-status');
    
    if (!container) return;
    
    container.innerHTML = '';
    if (count) count.textContent = players.length;
    
    if (waitingMsg) {
        if (players.length > 1) {
            waitingMsg.classList.add('hidden');
        } else {
            waitingMsg.classList.remove('hidden');
        }
    }

    players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'player-item';
        if (!player.connected) item.classList.add('disconnected');
        
        item.innerHTML = `
            <div class="player-info">
                <span class="player-name">${player.name} ${player.peerId === suState.roomCode ? '(HOST)' : ''}</span>
            </div>
            ${(suState.isHost && player.peerId !== suState.roomCode) ? 
                `<button class="btn-kick" data-id="${player.peerId}"><i data-lucide="user-x"></i></button>` : ''}
        `;
        container.appendChild(item);
    });

    if (window.lucide) window.lucide.createIcons();

    // Add kick listeners
    container.querySelectorAll('.btn-kick').forEach(btn => {
        btn.onclick = () => kickSuPlayer(btn.dataset.id);
    });
}
