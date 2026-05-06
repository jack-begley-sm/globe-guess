// ============================================================
// FILE: js/su-host.js
// PURPOSE: Host-side PeerJS for Stitch Up.
// ============================================================

import { suState } from './su-state.js';
import { renderSuPlayerList } from './su-lobby.js';
import { initSetterPhase } from './su-setter.js';
import { initRoundReveal } from './su-results.js';

let peer = null;
let connections = {};

export function initSuHost(roomCode) {
    if (peer) peer.destroy();
    
    peer = new Peer(roomCode);

    peer.on('open', (id) => console.log('SU Host Peer ID:', id));

    peer.on('connection', (conn) => {
        conn.on('data', (data) => handleGuestData(conn.peer, data));
        conn.on('open', () => {
            connections[conn.peer] = conn;
        });
        conn.on('close', () => handleDisconnect(conn.peer));
        conn.on('error', () => handleDisconnect(conn.peer));
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            // Room code already taken, unlikely with 6 chars
        }
    });
}

function handleGuestData(peerId, data) {
    switch (data.type) {
        case 'join':
            handleJoin(peerId, data.payload);
            break;
        case 'setterConfirm':
            handleSetterConfirm(data.payload.panoId, data.payload.latLng, false);
            break;
        case 'guesserSubmit':
            handleGuesserSubmit(data.payload.latLng, data.payload.timeTaken);
            break;
        case 'livePinUpdate':
            broadcastSuEvent('livePinUpdate', { peerId, latLng: data.payload.latLng });
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
        setterScores: [],
        guesserScores: []
    };
    suState.players.push(player);
    renderSuPlayerList(suState.players);
    broadcastSuEvent('playersUpdate', { players: suState.players });
}

function handleDisconnect(peerId) {
    const player = suState.players.find(p => p.peerId === peerId);
    if (player) {
        player.connected = false;
        renderSuPlayerList(suState.players);
        broadcastSuEvent('playersUpdate', { players: suState.players });
        
        // Handle in-game disconnects
        if (suState.currentSetter && suState.currentSetter.peerId === peerId) {
            autoPlaceLocation(suState.region);
        } else if (suState.currentGuesser && suState.currentGuesser.peerId === peerId) {
            handleGuesserSubmit(null, 120000);
        }
    }
    if (connections[peerId]) {
        connections[peerId].close();
        delete connections[peerId];
    }
}

export function kickSuPlayer(peerId) {
    const conn = connections[peerId];
    if (conn) {
        conn.send({ type: 'kicked' });
        setTimeout(() => conn.close(), 100);
    }
    suState.players = suState.players.filter(p => p.peerId !== peerId);
    renderSuPlayerList(suState.players);
    broadcastSuEvent('playersUpdate', { players: suState.players });
}

export function broadcastSuEvent(type, payload) {
    Object.values(connections).forEach(conn => {
        if (conn.open) conn.send({ type, payload });
    });
    // Local handle for host
    handleSuEventLocal(type, payload);
}

function handleSuEventLocal(type, payload) {
    // Host needs to react to its own broadcasts
    import('./su-guest.js').then(m => m.handleSuEvent(type, payload));
}

export function startStitchUpGame() {
    suState.currentRound = 0;
    nextSuRound();
}

export function nextSuRound() {
    suState.currentRound++;
    if (suState.currentRound > suState.totalRounds) {
        broadcastSuEvent('gameResults', {});
        return;
    }

    const { setter, guesser } = generateTurnOrder(suState.players, suState.currentRound - 1);
    suState.currentSetter = setter;
    suState.currentGuesser = guesser;
    suState.turnHistory.push([setter.peerId, guesser.peerId]);

    broadcastSuEvent('startRound', {
        roundIndex: suState.currentRound,
        setter,
        guesser,
        totalRounds: suState.totalRounds
    });
}

function generateTurnOrder(players, roundIndex) {
    if (roundIndex < players.length) {
        // Sequential
        const setter = players[roundIndex % players.length];
        const guesser = players[(roundIndex + 1) % players.length];
        return { setter, guesser };
    } else {
        // Random with constraints
        let attempts = 0;
        let setter, guesser;
        const lastPair = suState.turnHistory[suState.turnHistory.length - 1];

        while (attempts < 10) {
            const shuffled = [...players].sort(() => Math.random() - 0.5);
            setter = shuffled[0];
            guesser = shuffled[1];

            if (setter.peerId !== guesser.peerId && 
                (setter.peerId !== lastPair[0] || guesser.peerId !== lastPair[1])) {
                break;
            }
            attempts++;
        }
        return { setter, guesser };
    }
}

export function handleSetterConfirm(panoId, latLng, autoPlaced = false) {
    suState.confirmedPanoId = panoId;
    suState.confirmedLatLng = latLng;
    suState.autoPlaced = autoPlaced;
    
    broadcastSuEvent('guesserPhase', {
        panoId,
        latLng,
        setterName: suState.currentSetter.name,
        autoPlaced
    });
}

export async function autoPlaceLocation(region) {
    const { getRandomLocation } = await import('./streetview.js');
    try {
        const loc = await getRandomLocation(region);
        handleSetterConfirm(loc.pano, { lat: loc.lat, lng: loc.lng }, true);
    } catch (e) {
        console.error('Failed to auto-place', e);
    }
}

export async function handleGuesserSubmit(latLng, timeTaken) {
    const { calculateScore } = await import('./scoring.js');
    
    let distance = 0;
    let guesserScore = 0;
    
    if (latLng) {
        const scoreObj = calculateScore(latLng, suState.confirmedLatLng, 0, 0, false, 0);
        distance = scoreObj.distanceKm;
        guesserScore = scoreObj.totalScore;
        
        if (suState.autoPlaced) {
            guesserScore = Math.min(5000, Math.round(guesserScore * 1.5));
        }
    }

    let setterScore = suState.autoPlaced ? 0 : (5000 - guesserScore);
    // Optional cap
    // setterScore = Math.min(3000, setterScore);

    const result = {
        roundIndex: suState.currentRound,
        setterId: suState.currentSetter.peerId,
        guesserId: suState.currentGuesser.peerId,
        guessLatLng: latLng,
        correctLatLng: suState.confirmedLatLng,
        distance,
        guesserScore,
        setterScore,
        timeTaken,
        autoPlaced: suState.autoPlaced
    };

    suState.roundResults.push(result);

    // Update player scores
    const sPlayer = suState.players.find(p => p.peerId === suState.currentSetter.peerId);
    if (sPlayer) sPlayer.setterScores.push(setterScore);
    const gPlayer = suState.players.find(p => p.peerId === suState.currentGuesser.peerId);
    if (gPlayer) gPlayer.guesserScores.push(guesserScore);

    broadcastSuEvent('roundReveal', result);
}
