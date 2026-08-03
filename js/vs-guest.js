// ============================================================
// FILE: js/vs-guest.js
// PURPOSE: Guest-side PeerJS logic. Connects to host using roomCode,
// receives events, sends guess.
// ============================================================

import { vsState } from './vs-state.js';
import { renderPlayerList } from './vs-lobby.js';
import { handleVsEvent, resumeInProgressRound } from './vs-round.js';
import { saveSession } from './user.js';
import { registerSendGuess } from './vs-network.js';
import { PEER_CONFIG  } from './peer-config.js';

let vsGuestPeer = null;
let hostConn = null;
let isQuitting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

// isReconnect distinguishes a background retry (after the host's connection
// drops, e.g. the host refreshed) from a fresh join: reconnects must not reset
// the retry budget and must not yank the player back to the waiting screen if
// they're mid-round.
export function joinGame(hostPeerId, name, isReconnect = false) {
    if (!isReconnect) {
        reconnectAttempts = 0;
    }
    isQuitting = false;
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
            reconnectAttempts = 0;
            conn.send({ type: 'join', payload: { name } });

            saveSession({
                roomCode: hostPeerId,
                name,
                role: 'guest',
                mode: 'vs',
                gameMode: vsState.gameMode || 'vs',
            });

            document.getElementById('modal-vs-disconnect').classList.add('hidden');

            // Screen transitions — skip on a background reconnect, the player
            // may already be mid-round and shouldn't be bounced to waiting.
            document.getElementById('modal-vs-join').classList.add('hidden');
            document.getElementById('screen-landing').classList.add('hidden');
            document.getElementById('screen-join-game').classList.add('hidden');
            if (!isReconnect) {
                document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
            }
        });

    conn.on('data', (data) => {
            handleEvent(data.type, data.payload);
        });

        conn.on('close', () => {
            retryOrGiveUp(hostPeerId, name);
        });
    });

    vsGuestPeer.on('error', (err) => {
        console.error('[Guest] PeerJS Error:', err);

        if (isReconnect) {
            retryOrGiveUp(hostPeerId, name);
            return;
        }

        const message = err.type === 'peer-unavailable'
            ? `Could not find room "${hostPeerId}". Check the code and try again.`
            : `Connection error (${err.type}). Please try again.`;
        showDisconnectModal('Could Not Connect', message);
    });
}

// Host refreshing/blipping destroys the guest's DataConnection with no
// warning. The host-side already re-associates a rejoining peer by name
// (see handleJoin in vs-host.js), so it's safe to retry silently a few times
// before giving up and showing the dead-end modal.
function retryOrGiveUp(hostPeerId, name) {
    if (isQuitting) return;

    reconnectAttempts++;
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        showDisconnectModal('Disconnected', 'Connection to host lost.');
        return;
    }

    setTimeout(() => {
        if (isQuitting) return;
        joinGame(hostPeerId, name, true);
    }, RECONNECT_DELAY_MS);
}

function handleEvent(type, payload) {
    if (type === 'kicked') {
        isQuitting = true; // don't let the host closing the connection trigger a reconnect
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
            return;
        }

        // A guest who fully dropped and rejoined (fresh join, not the silent
        // background reconnect below) would otherwise sit on the waiting screen
        // forever while a round is already in progress — see vs-round.js.
        if (payload.gameState && payload.gameState.inProgress) {
            resumeInProgressRound(payload.gameState);
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
    isQuitting = true;
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
