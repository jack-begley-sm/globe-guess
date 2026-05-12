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

let peer = null;
let hostConn = null;

export function joinGame(hostPeerId, name) {
    vsState.roomCode = hostPeerId;
    registerSendGuess(sendGuess); // synchronous - sendGuess guards itself with hostConn.open
    saveSession({ roomCode: hostPeerId, name, role: 'guest', mode: 'vs', gameMode: vsState.gameMode });

    if (peer) peer.destroy();
    peer = new Peer();

    peer.on('open', (id) => {
        vsState.localPlayer.peerId = id;
        vsState.localPlayer.name = name;

        const conn = peer.connect(hostPeerId);
        hostConn = conn;

        conn.on('open', () => {
            registerSendGuess(sendGuess); // register once connection is live
            conn.send({ type: 'join', payload: { name } });
            document.getElementById('modal-vs-join').classList.add('hidden');
            document.getElementById('screen-landing').classList.add('hidden');
            document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
        });

        conn.on('data', (data) => handleEvent(data.type, data.payload));
        conn.on('close', () => { if (!vsState.gameOver) showDisconnectModal('Connection Lost', 'The host has left the game.'); });
        conn.on('error', (err) => { console.error('Guest connection error:', err); showDisconnectModal('Connection Error', 'Could not connect to the host.'); });
    });

    peer.on('error', (err) => { console.error('Guest peer error:', err); showDisconnectModal('Connection Error', 'PeerJS error occurred.'); });
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
