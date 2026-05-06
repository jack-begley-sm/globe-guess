// ============================================================
// FILE: js/vs-lobby.js
// PURPOSE: Host lobby and share screen logic.
// ============================================================

import { vsState } from './vs-state.js';
import { getUser, setUser } from './user.js';
import { initHost, kickPlayer as hostKickPlayer, broadcastEvent } from './vs-host.js';
import { startVsRound } from './vs-round.js';

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

    const startBtn = document.getElementById('btn-start-game');
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
    
    const regionBtn = document.querySelector('#vs-region-grid button.active');
    vsState.region = regionBtn.dataset.region;

    const roomCode = generateRoomCode();
    vsState.roomCode = roomCode;
    vsState.localPlayer.peerId = roomCode; // Host ID is room code

    // Add host to players list
    vsState.players = [{
        name: name,
        peerId: roomCode,
        connected: true,
        scores: [],
        guesses: []
    }];

    // Initialize Host PeerJS
    initHost(roomCode);

    // Prepare share screen
    document.getElementById('display-room-code').textContent = roomCode;
    const localIP = await getLocalIP();
    const port = window.location.port || '5173';

    if (!localIP) {
        // Detection failed — show editable field with placeholder
        const urlInput = document.getElementById('input-share-url');
        urlInput.value = `http://[YOUR-IP]:${port}/join/${roomCode}`;
        urlInput.readOnly = false;
        urlInput.select();
        const statusEl = document.querySelector('.share-content p');
        if (statusEl) {
            statusEl.textContent = 'Could not detect your IP automatically. ' +
                'Find it in WiFi settings and edit the URL above.';
            statusEl.style.color = 'var(--color-danger)';
        }
    } else {
        const joinURL = `http://${localIP}:${port}/join/${roomCode}`;
        const urlInput = document.getElementById('input-share-url');
        urlInput.value = joinURL;
        updateWhatsAppLink(joinURL);
    }

    function updateWhatsAppLink(url) {
        const whatsappBtn = document.getElementById('btn-share-whatsapp');
        const text = encodeURIComponent(`Join my Globe Guess game! ${url}`);
        whatsappBtn.href = `https://wa.me/?text=${text}`;
    }

    const urlInput = document.getElementById('input-share-url');
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
    document.getElementById('screen-vs-setup').classList.add('hidden');
    document.getElementById('screen-multiplayer-share').classList.remove('hidden');
    
    renderPlayerList();
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
    // Capacitor native — use WiFi plugin for real device IP
    if (window.Capacitor?.isNativePlatform()) {
        try {
            const { CapacitorWifi } = await import('@capgo/capacitor-wifi');
            const info = await CapacitorWifi.getWifiInfo();
            if (info?.ip && info.ip !== '0.0.0.0') {
                console.log('Got IP from CapacitorWifi:', info.ip);
                return info.ip;
            }
        } catch (e) {
            console.warn('CapacitorWifi failed, falling back:', e);
        }
    }

    // Web browser — if already accessed via network IP, use it directly
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return hostname;
    }

    // Localhost fallback — STUN detection
    return new Promise((resolve) => {
        let resolved = false;

        const tryResolve = (ip) => {
            if (resolved) return;
            if (
                ip.startsWith('192.168.') ||
                ip.startsWith('10.')      ||
                /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
            ) {
                resolved = true;
                resolve(ip);
            }
        };

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        });

        pc.createDataChannel('');
        pc.createOffer().then(o => pc.setLocalDescription(o));
        pc.onicecandidate = (e) => {
            if (!e.candidate) return;
            const match = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(
                e.candidate.candidate
            );
            if (match) tryResolve(match[1]);
        };

        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve(null);
            }
        }, 4000);
    });
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
