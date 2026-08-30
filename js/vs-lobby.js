// ============================================================
// FILE: js/vs-lobby.js
// PURPOSE: Host lobby and share screen logic.
// ============================================================

import { vsState } from './vs-state.js';
import { getUser, setUser } from './user.js';
import { initHost, kickPlayer as hostKickPlayer, broadcastEvent } from './vs-host.js';
import { startVsRound } from './vs-round.js';
import { getShape } from './geo/shapes.js';
import { openCustomDraw } from './custom-lobby.js';

const GITHUB_PAGES_URL = 'https://jack-begley-sm.github.io/globe-guess';

export function initVsSetup() {
    const setupNextBtn = document.getElementById('btn-vs-setup-next');
    const nameInput = document.getElementById('input-vs-host-name');
    
    if (nameInput) {
        nameInput.value = getUser() || '';
    }

    if (setupNextBtn) {
        setupNextBtn.addEventListener('click', handleSetupNext);
    }

    setupSegmentedControl('control-vs-rounds');
    setupGridSelection('vs-region-grid');
    
    const backBtn = document.getElementById('btn-vs-setup-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('screen-vs-setup').classList.add('hidden');
            document.getElementById('screen-landing').classList.remove('hidden');
        });
    }

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
            if (vsState.players.length < 2) {
                const errorMsg = document.getElementById('lobby-error');
                errorMsg.textContent = "You need at least one other player to start";
                errorMsg.classList.remove('hidden');
                return;
            }
            document.getElementById('lobby-error').classList.add('hidden');
            startVsRound();
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

async function handleSetupNext() {
    const nameInput = document.getElementById('input-vs-host-name');
    const name = nameInput.value.trim();
    const errorMsg = document.getElementById('error-vs-host-name');

    if (!name) {
        errorMsg.classList.remove('hidden');
        nameInput.focus();
        return;
    }
    errorMsg.classList.add('hidden');
    setUser(name);

    vsState.isHost = true;
    vsState.localPlayer.name = name;

    const roundsBtn = document.querySelector('#control-vs-rounds button.active');
    vsState.totalRounds = parseInt(roundsBtn.dataset.value);

    // Re-hosting an existing room ("Play Again") keeps the same room code,
    // peer connection, player list, and region/shape — checked BEFORE the
    // region grid is read at all, so re-hosting never overwrites an
    // already-drawn Custom area (or any other region) with whatever the
    // grid happens to show underneath.
    if (vsState.roomCode) {
        document.getElementById('screen-vs-setup').classList.add('hidden');
        document.getElementById('screen-multiplayer-lobby').classList.remove('hidden');
        const lobbyCodeEl = document.getElementById('lobby-room-code');
        if (lobbyCodeEl) lobbyCodeEl.textContent = `CODE: ${vsState.roomCode}`;
        renderPlayerList();
        return;
    }

    const regionBtn = document.querySelector('#vs-region-grid button.active');
    const region = regionBtn.dataset.region;

    if (region === 'CUSTOM') {
        // Per S10-vs-mode.md: the area must exist before the room does, so
        // no guest can ever connect to a room whose play area is
        // undefined. Room creation moves into the onConfirm callback.
        // Next stays disabled for the whole drawing gap (both the confirm
        // and the back path clear it) so a rapid double-tap on Next can't
        // slip a second draw-screen visit in and end up creating two rooms.
        const nextBtn = document.getElementById('btn-vs-setup-next');
        const backBtn = document.getElementById('btn-custom-back');
        nextBtn.disabled = true;
        const reenableOnBack = () => { nextBtn.disabled = false; };
        backBtn?.addEventListener('click', reenableOnBack, { once: true });

        openCustomDraw('screen-vs-setup', (shape) => {
            backBtn?.removeEventListener('click', reenableOnBack);
            nextBtn.disabled = false;
            vsState.region = 'CUSTOM';
            vsState.shape = shape;
            createRoomAndShowShareScreen(name);
        });
        return;
    }

    vsState.region = region;
    vsState.shape = getShape(region);
    createRoomAndShowShareScreen(name);
}

function createRoomAndShowShareScreen(name) {
    const roomCode = generateRoomCode();
    vsState.roomCode = roomCode;
    vsState.localPlayer.peerId = roomCode;

    // --- CONSOLIDATED ROBUST URL GENERATION ---
    let finalJoinURL;
    const modeParam = vsState.gameMode === 'coop' ? 'join-coop' : 'join';

    if (window.Capacitor?.isNativePlatform()) {
        // Native apps must point to the public web URL
        finalJoinURL = `${GITHUB_PAGES_URL}/?${modeParam}=${roomCode}`;
    } else {
        const currentURL = new URL(window.location.href);
        const hostname = currentURL.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Localhost testing: still use GitHub Pages for share links so others can join
            finalJoinURL = `${GITHUB_PAGES_URL}/?${modeParam}=${roomCode}`;
        } else {
            // Real network (GitHub Pages or local IP): use current path
            finalJoinURL = `${currentURL.origin}${currentURL.pathname}?${modeParam}=${roomCode}`;
        }
    }

    const urlInput = document.getElementById('input-share-url');
    if (urlInput) {
        urlInput.value = finalJoinURL;
        urlInput.readOnly = false;

        // Add listener for manual edits to update social links
        urlInput.addEventListener('input', () => {
            updateWhatsAppLink(urlInput.value);
        });
    }

    updateWhatsAppLink(finalJoinURL);
    // --- END URL GENERATION ---

    // Add host to players list
    vsState.players = [{
        name: name,
        peerId: roomCode,
        connected: true,
        scores: [],
        guesses: [],
        hasSubmitted: false
    }];

    // Initialize Host PeerJS
    initHost(roomCode);

    // Prepare share screen
    document.getElementById('display-room-code').textContent = roomCode;
    document.getElementById('lobby-room-code').textContent = `CODE: ${roomCode}`;

    document.getElementById('btn-copy-link').onclick = () => {
        const valToCopy = urlInput ? urlInput.value : finalJoinURL;
        navigator.clipboard.writeText(valToCopy);
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
    document.getElementById('screen-vs-setup').classList.add('hidden');
    document.getElementById('screen-multiplayer-share').classList.remove('hidden');

    renderPlayerList();
}


// Helper function (keep it inside or outside handleSetupNext as preferred)
function updateWhatsAppLink(url) {
    const whatsappBtn = document.getElementById('btn-share-whatsapp');
    if (whatsappBtn) {
        const text = encodeURIComponent(`${url}`);
        whatsappBtn.href = `https://wa.me/?text=${text}`;
    }
}

export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export async function getLocalIP() {
    // Native Capacitor app — use WiFi plugin for real device IP
    if (window.Capacitor?.isNativePlatform()) {
        try {
            const { CapacitorWifi } = await import('@capgo/capacitor-wifi');
            const info = await CapacitorWifi.getWifiInfo();
            if (info?.ip && info.ip !== '0.0.0.0') {
                return info.ip;
            }
        } catch (e) {
            console.warn('CapacitorWifi failed:', e);
        }
    }

    // Web browser — use hostname directly
    const hostname = window.location.hostname;
    if (hostname && hostname !== '') {
        return hostname;
    }

    return null;
}

export function renderPlayerList() {
    const container = vsState.isHost ? document.getElementById('lobby-player-list') : document.getElementById('waiting-player-list');
    if (!container) return;

    container.innerHTML = '';
    vsState.players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'player-item';
        
        const info = document.createElement('div');
        info.className = 'player-info';
        
        const name = document.createElement('span');
        name.className = 'player-name';
        name.textContent = player.name + (player.peerId === vsState.localPlayer.peerId ? ' (You)' : '');
        
        info.appendChild(name);
        
        const status = document.createElement('div');
        status.className = 'player-status';
        
        if (player.connected) {
            const indicator = document.createElement('div');
            indicator.className = 'status-indicator';
            status.appendChild(indicator);
        } else {
            const indicator = document.createElement('div');
            indicator.className = 'status-indicator disconnected';
            status.appendChild(indicator);
        }

        if (vsState.isHost && player.peerId !== vsState.localPlayer.peerId) {
            const kickBtn = document.createElement('button');
            kickBtn.className = 'btn-kick';
            kickBtn.innerHTML = '<i data-lucide="user-x"></i>';
            kickBtn.onclick = () => hostKickPlayer(player.peerId);
            status.appendChild(kickBtn);
        }

        item.appendChild(info);
        item.appendChild(status);
        container.appendChild(item);
    });

    if (vsState.isHost) {
        document.getElementById('lobby-player-count').textContent = `${vsState.players.length} Player${vsState.players.length > 1 ? 's' : ''}`;
    }

    if (window.lucide) window.lucide.createIcons();
}
