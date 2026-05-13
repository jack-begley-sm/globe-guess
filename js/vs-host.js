// ============================================================
// FILE: js/vs-host.js
// PURPOSE: Host-side PeerJS logic. Creates room, manages connections,
// broadcasts game events, receives guesses.
//
// DEPENDENCIES:
//   - js/vs-state.js    (reads/writes vsState)
//   - js/vs-lobby.js    (calls renderPlayerList)
//   - js/vs-round.js    (calls onAllGuessesReceived)
//
// USED BY:
//   - js/vs-lobby.js    (calls initHost, kickPlayer, broadcastEvent)
//   - js/vs-round.js    (calls broadcastEvent)
//
// KEY FUNCTIONS:
//   - initHost(roomCode)
//   - getLocalIP()
//   - broadcastEvent(type, payload)
//   - kickPlayer(peerId)
// ============================================================

import { vsState } from './vs-state.js';
import { renderPlayerList } from './vs-lobby.js';
import { onAllGuessesReceived, updatePlayerStatusList } from './vs-round.js';
import { registerBroadcast } from './vs-network.js';
import { saveSession, clearSession } from './user.js';
import { requestWakeLock, releaseWakeLock } from './awake.js';
import { PEER_CONFIG } from './peer-config.js';

const Peer = window.Peer;
const PeerJS = window.Peer;

let vsHostPeer = null;
let connections = {};
let hostAloneTimer = null;
let hostAloneSeconds = 60;

export function initHost(roomCode) {
    registerBroadcast(broadcastEvent);
    saveSession({ roomCode, name: vsState.localPlayer.name, role: 'host', mode: 'vs', gameMode: vsState.gameMode });
    requestWakeLock();

    // CHANGE 2: Refer to the global variable, don't use 'let' or 'const' here
    if (vsHostPeer) {
        vsHostPeer.destroy();
        vsHostPeer = null;
    }

    if (!window.Peer) {
        console.error("PeerJS not loaded from CDN yet.");
        alert("Networking library still loading...");
        return;
    }

    // CHANGE 3: Assign to the global variable (vsHostPeer) without 'const'
    vsHostPeer = new window.Peer(roomCode, PEER_CONFIG);

    vsHostPeer.on('open', (id) => {
        console.log('Host Peer ID:', id);
    });

    vsHostPeer.on('connection', (conn) => {
        connections[conn.peer] = conn;

        conn.on('open', () => {
            console.log(`[Host] Connection with ${conn.peer} is now OPEN`);
        });

        conn.on('data', (data) => {
            handleGuestData(conn.peer, data);
        });

        conn.on('close', () => {
            handleDisconnect(conn.peer);
        });

        // conn-level error — inside the callback where conn is in scope
        conn.on('error', (err) => {
            console.error(`[Host] Connection error with ${conn.peer}:`, err);
            handleDisconnect(conn.peer);
        });
    });

    // peer-level error — outside the connection callback, registered once
    vsHostPeer.on('error', (err) => {
        console.error('[Host] Peer error:', err.type, err);
    });

}

function handleGuestData(peerId, data) {
    switch (data.type) {
        case 'join':
            handleJoin(peerId, data.payload);
            break;
        case 'guess':
            handleGuestGuess(peerId, data.payload);
            break;
        case 'quit':
            handleDisconnect(peerId);
            break;
    }
}

function handleJoin(peerId, payload) {
    // Check if player already exists (reconnection)
    let player = vsState.players.find(p => p.name === payload.name);
    
    if (player) {
        player.peerId = peerId;
        player.connected = true;
    } else {
        player = {
            name: payload.name,
            peerId: peerId,
            connected: true,
            scores: [],
            guesses: [],
            hasSubmitted: false
        };
        vsState.players.push(player);
    }
    
    renderPlayerList();
    
    // Broadcast updated player list to all
    broadcastPlayers();

    checkHostAlone();
}

function broadcastPlayers() {
    broadcastEvent('playersUpdate', { 
        players: vsState.players,
        gameMode: vsState.gameMode
    });
}

function handleDisconnect(peerId) {
    const player = vsState.players.find(p => p.peerId === peerId);
    if (player) {
        player.connected = false;
        renderPlayerList();
        broadcastPlayers();
    }
    if (connections[peerId]) {
        connections[peerId].close();
        delete connections[peerId];
    }

    checkHostAlone();
}

function checkHostAlone() {
    const connectedGuests = vsState.players.filter(p => p.connected);
    if (connectedGuests.length === 0 && vsState.gameStarted) {
        showHostAloneModal();
    } else {
        hideHostAloneModal();
    }
}

function showHostAloneModal() {
    const modal = document.getElementById('modal-host-alone');
    if (!modal || !modal.classList.contains('hidden')) return;

    modal.classList.remove('hidden');
    hostAloneSeconds = 60;
    updateHostAloneTimer();

    if (hostAloneTimer) clearInterval(hostAloneTimer);
    hostAloneTimer = setInterval(() => {
        hostAloneSeconds--;
        updateHostAloneTimer();
        if (hostAloneSeconds <= 0) {
            clearInterval(hostAloneTimer);
            quitGame();
        }
    }, 1000);

    document.getElementById('btn-host-alone-quit').onclick = () => {
        quitGame();
    };

    document.getElementById('btn-host-alone-wait').onclick = () => {
        hostAloneSeconds = 60;
        updateHostAloneTimer();
    };
}

function hideHostAloneModal() {
    const modal = document.getElementById('modal-host-alone');
    if (modal) modal.classList.add('hidden');
    if (hostAloneTimer) {
        clearInterval(hostAloneTimer);
        hostAloneTimer = null;
    }
}

function updateHostAloneTimer() {
    const timerSpan = document.getElementById('host-alone-timer');
    if (timerSpan) timerSpan.textContent = hostAloneSeconds;
}

function quitGame() {
    clearSession();
    releaseWakeLock();
    // Instead of window.location.href = './';
    window.location.href = window.location.origin + window.location.pathname;
}

export function kickPlayer(peerId) {
    const conn = connections[peerId];
    if (conn) {
        conn.send({ type: 'kicked' });
        setTimeout(() => conn.close(), 100);
    }
    vsState.players = vsState.players.filter(p => p.peerId !== peerId);
    renderPlayerList();
    broadcastPlayers();
}

function checkAllGuessesReceived() {
    const activePlayers = vsState.players.filter(p => p.connected);
    if (activePlayers.every(p => p.hasSubmitted)) {
        onAllGuessesReceived();
    }
}

function handleGuestGuess(peerId, data) {
    const player = vsState.players.find(p => p.peerId === peerId);
    if (player && vsState.gameStarted) {
        player.guesses[vsState.currentRound - 1] = data.latLng;
        player.lastTimeTaken = data.timeTaken;
        player.hasSubmitted = true;
        broadcastEvent('playerSubmitted', { peerId });
        updatePlayerStatusList();
        checkAllGuessesReceived();
    }
}

export function broadcastEvent(type, payload) {
    Object.values(connections).forEach(conn => {
        if (conn.open) conn.send({ type, payload });
    });
}
