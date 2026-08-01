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

let vsGuestPeer = null;
let hostConn = null;

export function joinGame(hostPeerId, name) {
    registerSendGuess(sendGuess);
    vsState.roomCode = hostPeerId;

    history.replaceState({}, '', window.location.pathname)

    // CHANGE 2: Clean up existing instance
    if (vsGuestPeer) {
        vsGuestPeer.destroy();
        vsGuestPeer = null;
    }

    // CHANGE 3: Use window.Peer and assign to global (no 'const' here)
    vsGuestPeer = new window.Peer(undefined, PEER_CONFIG);

    vsGuestPeer.on('open', (id) => {
        vsState.localPlayer.peerId = id;
        vsState.localPlayer.name = name;

        const conn = vsGuestPeer.connect(hostPeerId);
        hostConn = conn;

        conn.on('open', () => {
            conn.send({ type: 'join', payload: { name } });

            saveSession({
                roomCode: hostPeerId,
                name,
                role: 'guest',
                mode: 'vs',
                gameMode: vsState.gameMode || 'vs',
            });

            // Screen transitions
            document.getElementById('modal-vs-join').classList.add('hidden');
            document.getElementById('screen-landing').classList.add('hidden');
            document.getElementById('screen-join-game').classList.add('hidden');
            document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
        });

    conn.on('data', (data) => {
            handleEvent(data.type, data.payload);
        });

        conn.on('close', () => {
            showDisconnectModal('Disconnected', 'Connection to host lost.');
        });
    });

    vsGuestPeer.on('error', (err) => {
        console.error('[Guest] PeerJS Error:', err);

        const message = err.type === 'peer-unavailable'
            ? `Could not find room "${hostPeerId}". Check the code and try again.`
            : `Connection error (${err.type}). Please try again.`;
        showDisconnectModal('Could Not Connect', message);
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

        if (payload.gameMode === 'su') {
            console.warn('[Guest] Connected to SU host while in VS mode. Switching...');
            const baseUrl = window.location.origin + window.location.pathname;
            window.location.href = `${baseUrl}?join-su=${vsState.roomCode}&name=${encodeURIComponent(vsState.localPlayer.name)}`;
        }
        return;
    }

    handleVsEvent(type, payload);
}

export function sendGuess(latLng, timeTaken, round) {
    if (hostConn && hostConn.open) {
        hostConn.send({ type: 'guess', payload: { latLng, timeTaken, round } });
    }
}

export function quitGame() {
    if (hostConn && hostConn.open) {
        hostConn.send({ type: 'quit' });
    }
    if (vsGuestPeer) {
        vsGuestPeer.destroy();
        vsGuestPeer = null;
    }
}

function showDisconnectModal(title, message) {
    document.getElementById('vs-disconnect-title').textContent = title;
    document.getElementById('vs-disconnect-message').textContent = message;
    document.getElementById('modal-vs-disconnect').classList.remove('hidden');
}
