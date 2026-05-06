// ============================================================
// FILE: js/su-lobby.js
// PURPOSE: Host setup, share screen, and lobby for Stitch Up.
// ============================================================

import { suState } from './su-state.js';
import { getUser, setUser } from './user.js';
import { getLocalIP } from './vs-lobby.js';
import { initSuHost, kickSuPlayer, startStitchUpGame } from './su-host.js';

const GITHUB_PAGES_URL = 'https://jackbegley-sm.github.io/globe-guess';

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
            window.location.href = '/';
        });
    });

    const shareContinueBtn = document.getElementById('btn-share-continue');
    if (shareContinueBtn) {
        shareContinueBtn.addEventListener('click', () => {
            document.getElementById('screen-multiplayer-share').classList.add('hidden');
            document.getElementById('screen-multiplayer-lobby').classList.remove('hidden');
        });
    }

    const startBtn = document.getElementById('btn-start-game');
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
        const port = window.location.port || '5173';
        const hostname = window.location.hostname;
        joinURL = `http://${hostname}:${port}/?join-su=${roomCode}`;
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
        const icon = btn.querySelector('i');
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
    const list = document.getElementById('lobby-player-list');
    const count = document.getElementById('lobby-player-count');
    const waitingMsg = document.getElementById('lobby-status');
    
    if (!list) return;
    
    list.innerHTML = '';
    count.textContent = players.length;
    
    if (players.length > 1) {
        waitingMsg.classList.add('hidden');
    } else {
        waitingMsg.classList.remove('hidden');
    }

    players.forEach(player => {
        const row = document.createElement('div');
        row.className = 'player-row';
        if (!player.connected) row.classList.add('disconnected');
        
        row.innerHTML = `
            <div class="player-info">
                <span class="player-name">${player.name} ${player.peerId === suState.roomCode ? '(HOST)' : ''}</span>
            </div>
            ${(suState.isHost && player.peerId !== suState.roomCode) ? 
                `<button class="btn-kick" data-id="${player.peerId}"><i data-lucide="user-x"></i></button>` : ''}
        `;
        list.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();

    // Add kick listeners
    list.querySelectorAll('.btn-kick').forEach(btn => {
        btn.onclick = () => kickSuPlayer(btn.dataset.id);
    });
}
