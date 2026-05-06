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
import { onAllGuessesReceived } from './vs-round.js';

let peer = null;
let connections = {};

export function initHost(roomCode) {
    // Reset Peer if already exists
    if (peer) {
        peer.destroy();
    }
    
    peer = new Peer(roomCode);

    peer.on('open', (id) => {
        console.log('Host Peer ID:', id);
    });

    peer.on('connection', (conn) => {
        conn.on('data', (data) => {
            handleGuestData(conn.peer, data);
        });

        conn.on('open', () => {
            connections[conn.peer] = conn;
        });

        conn.on('close', () => {
            handleDisconnect(conn.peer);
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            handleDisconnect(conn.peer);
        });
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
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
    const player = {
        name: payload.name,
        peerId: peerId,
        connected: true,
        scores: [],
        guesses: []
    };
    vsState.players.push(player);
    renderPlayerList();
    
    // Broadcast updated player list to all
    broadcastEvent('playersUpdate', { players: vsState.players });
}

function handleDisconnect(peerId) {
    const player = vsState.players.find(p => p.peerId === peerId);
    if (player) {
        player.connected = false;
        renderPlayerList();
        broadcastEvent('playersUpdate', { players: vsState.players });
    }
    if (connections[peerId]) {
        connections[peerId].close();
        delete connections[peerId];
    }
}

export function kickPlayer(peerId) {
    const conn = connections[peerId];
    if (conn) {
        conn.send({ type: 'kicked' });
        setTimeout(() => conn.close(), 100);
    }
    vsState.players = vsState.players.filter(p => p.peerId !== peerId);
    renderPlayerList();
    broadcastEvent('playersUpdate', { players: vsState.players });
}

export function broadcastEvent(type, payload) {
    Object.values(connections).forEach(conn => {
        if (conn.open) {
            conn.send({ type, payload });
        }
    });
}

function handleGuestGuess(peerId, data) {
    const player = vsState.players.find(p => p.peerId === peerId);
    if (player && vsState.gameStarted) {
        player.guesses[vsState.currentRound - 1] = data.latLng;
        player.lastTimeTaken = data.timeTaken;
        
        // Notify all clients that this player has submitted
        broadcastEvent('playerSubmitted', { peerId });
        
        // Check if all active players have guessed
        checkAllGuessesReceived();
    }
}

function checkAllGuessesReceived() {
    const activePlayers = vsState.players.filter(p => p.connected);
    const guessesInRound = activePlayers.filter(p => p.guesses[vsState.currentRound - 1]);
    
    if (guessesInRound.length === activePlayers.length) {
        onAllGuessesReceived();
    }
}
