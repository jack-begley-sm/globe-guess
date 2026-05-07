// ============================================================
// FILE: js/vs-guest.js
// PURPOSE: Guest-side PeerJS logic. Connects to host using roomCode,
// receives events, sends guess.
// ============================================================

import { vsState } from './vs-state.js';
import { renderPlayerList } from './vs-lobby.js';
import { handleVsEvent } from './vs-round.js';

let peer = null;
let hostConn = null;

export function joinGame(hostPeerId, name) {
    if (peer) {
        peer.destroy();
    }
    
    peer = new Peer();

    peer.on('open', (id) => {
        vsState.localPlayer.peerId = id;
        vsState.localPlayer.name = name;
        
        const conn = peer.connect(hostPeerId);
        hostConn = conn;

        conn.on('open', () => {
            conn.send({ type: 'join', payload: { name } });
            
            document.getElementById('modal-vs-join').classList.add('hidden');
            document.getElementById('screen-landing').classList.add('hidden');
            document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
        });

        conn.on('data', (data) => {
            handleEvent(data.type, data.payload);
        });

        conn.on('close', () => {
            if (!vsState.gameOver) {
                showDisconnectModal('Connection Lost', 'The host has left the game.');
            }
        });

        conn.on('error', (err) => {
            console.error('Guest connection error:', err);
            showDisconnectModal('Connection Error', 'Could not connect to the host.');
        });
    });

    peer.on('error', (err) => {
        console.error('Guest peer error:', err);
        showDisconnectModal('Connection Error', 'PeerJS error occurred.');
    });
}

function handleEvent(type, payload) {
    if (type === 'kicked') {
        showDisconnectModal('Removed', 'You were removed from the game by the host.');
        return;
    }
    
    if (type === 'playersUpdate') {
        vsState.players = payload.players;
        renderPlayerList();

        // Safety net: if we receive SU-style payload while in VS guest mode, 
        // it means we connected to a Stitch Up host. Auto-switch.
        if (payload.gameMode === 'su' || payload.gameState) {
            console.warn('Connected to SU host while in VS mode. Switching...');
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
