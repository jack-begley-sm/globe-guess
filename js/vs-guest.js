// ============================================================
// FILE: js/vs-guest.js
// PURPOSE: Guest-side PeerJS logic. Connects to host using roomCode,
// receives events, sends guess.
// ============================================================

import { vsState } from './vs-state.js';
import { renderPlayerList } from './vs-lobby.js';
import { handleVsEvent } from './vs-round.js';
import { saveSession } from './user.js';
import { registerSendGuess } from './vs-network.js';
import { PEER_CONFIG  } from './peer-config.js';

let peer = null;
let hostConn = null;

const PeerJS = window.Peer;

export function joinGame(hostPeerId, name) {
    console.log(`[Guest] Attempting to join room: ${hostPeerId} as ${name}`);
    vsState.roomCode = hostPeerId;

    const PeerClass = window.Peer; // Get the constructor from the window

    if (!PeerClass) {
        console.error("PeerJS not loaded from CDN yet.");
        alert("Networking library still loading... please wait a moment and try again.");
        return;
    }

    if (peer) peer.destroy();

    // Use the class we just grabbed
    const peer = new window.Peer(undefined, PEER_CONFIG);

    peer.on('open', (id) => {
        console.log('[Guest] My Peer ID is:', id);
        vsState.localPlayer.peerId = id;
        vsState.localPlayer.name = name;

        console.log(`[Guest] Connecting to Host: ${hostPeerId}...`);
        const conn = peer.connect(hostPeerId);
        hostConn = conn;

        conn.on('open', () => {
            console.log('[Guest] Connection OPEN. Sending join packet...');
            conn.send({ type: 'join', payload: { name } });

            // Screen transitions
            document.getElementById('modal-vs-join').classList.add('hidden');
            document.getElementById('screen-landing').classList.add('hidden');
            document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
        });
    });

    peer.on('error', (err) => {
        console.error('[Guest] PeerJS Global Error:', err.type, err);
    });
}

function handleEvent(type, payload) {
    if (type === 'kicked') {
        showDisconnectModal('Removed', 'You were removed from the game by the host.');
        return;
    }
    
    if (type === 'playersUpdate') {
        vsState.players = payload.players;
        if (payload.gameMode) {
            vsState.gameMode = payload.gameMode;
        }
        renderPlayerList();

        if (payload.gameMode !== 'vs') {
            console.warn('Connected to non-VS host. Switching...');
            const baseUrl = window.location.origin + window.location.pathname;
            window.location.href = `${baseUrl}?join-su=${vsState.roomCode}&name=${encodeURIComponent(vsState.localPlayer.name)}`;
        }
        return;
    }

    handleVsEvent(type, payload);
}

export function sendGuess(latLng, timeTaken) {
    if (hostConn && hostConn.open) {
        hostConn.send({ type: 'guess', payload: { latLng, timeTaken } });
    }
}

export function quitGame() {
    if (hostConn && hostConn.open) {
        hostConn.send({ type: 'quit' });
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }
}

function showDisconnectModal(title, message) {
    document.getElementById('vs-disconnect-title').textContent = title;
    document.getElementById('vs-disconnect-message').textContent = message;
    document.getElementById('modal-vs-disconnect').classList.remove('hidden');
}
