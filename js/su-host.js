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
        // Important: Add to connections immediately so we don't miss early broadcasts
        connections[conn.peer] = conn;
        
        conn.on('data', (data) => handleGuestData(conn.peer, data));
        conn.on('open', () => {
            console.log('SU Connection open:', conn.peer);
            // Re-confirm in connections
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
    let player = suState.players.find(p => p.peerId === peerId);
    if (!player) {
        player = {
            name: payload.name,
            peerId: peerId,
            connected: true,
            setterScores: [],
            guesserScores: []
        };
        suState.players.push(player);
    } else {
        player.name = payload.name;
        player.connected = true;
    }
    
    renderSuPlayerList(suState.players);
    broadcastSuEvent('playersUpdate', { 
        players: suState.players,
        gameState: {
            currentRound: suState.currentRound,
            totalRounds: suState.totalRounds,
            currentSetter: suState.currentSetter,
            currentGuesser: suState.currentGuesser,
            inProgress: suState.currentRound > 0
        }
    });
}

function handleDisconnect(peerId) {
    const player = suState.players.find(p => p.peerId === peerId);
    if (player) {
        player.connected = false;
        renderSuPlayerList(suState.players);
        broadcastSuEvent('playersUpdate', { players: suState.players });
        
        const connectedCount = suState.players.filter(p => p.connected).length;

        // Handle in-game disconnects
        if (suState.currentRound > 0 && suState.currentRound <= suState.totalRounds) {
            const isSetter = suState.currentSetter && suState.currentSetter.peerId === peerId;
            const isGuesser = suState.currentGuesser && suState.currentGuesser.peerId === peerId;

            if (isSetter || isGuesser) {
                if (connectedCount < 2) {
                    broadcastSuEvent('gameAborted', { reason: 'Not enough players remaining.' });
                } else {
                    // Skip current round
                    skipCurrentRound(isSetter ? 'Setter' : 'Guesser');
                }
            }
        }
    }
    if (connections[peerId]) {
        connections[peerId].close();
        delete connections[peerId];
    }
}

function skipCurrentRound(whoDropped) {
    const result = {
        roundIndex: suState.currentRound,
        setterId: suState.currentSetter ? suState.currentSetter.peerId : '',
        guesserId: suState.currentGuesser ? suState.currentGuesser.peerId : '',
        guessLatLng: null,
        correctLatLng: suState.confirmedLatLng || { lat: 0, lng: 0 },
        distance: 0,
        guesserScore: 0,
        setterScore: 0,
        timeTaken: 0,
        autoPlaced: false,
        skipped: true,
        reason: `${whoDropped} disconnected`
    };

    suState.roundResults.push(result);

    // Sync score arrays
    if (suState.currentSetter) {
        const sPlayer = suState.players.find(p => p.peerId === suState.currentSetter.peerId);
        if (sPlayer) sPlayer.setterScores.push(0);
    }
    if (suState.currentGuesser) {
        const gPlayer = suState.players.find(p => p.peerId === suState.currentGuesser.peerId);
        if (gPlayer) gPlayer.guesserScores.push(0);
    }

    broadcastSuEvent('playersUpdate', { players: suState.players });
    broadcastSuEvent('roundReveal', result);
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
    // Clean up stale connections first
    const activeEntries = Object.entries(connections);
    for (const [id, conn] of activeEntries) {
        if (!conn || (conn.open === false && conn.peerConnection && 
            (conn.peerConnection.signalingState === 'closed' || conn.peerConnection.iceConnectionState === 'closed'))) {
            delete connections[id];
        }
    }

    Object.values(connections).forEach(conn => {
        try {
            // PeerJS queues messages sent while 'connecting', but only if we don't check .open
            // However, to be safe we try to send to all that aren't obviously dead
            conn.send({ type, payload });
        } catch (e) {
            console.warn(`Failed to send ${type} to ${conn.peer}:`, e);
        }
    });
    // Local handle for host
    handleSuEventLocal(type, payload);
}

function handleSuEventLocal(type, payload) {
    // Host needs to react to its own broadcasts
    import('./su-guest.js').then(m => m.handleSuEvent(type, payload));
}

export function startStitchUpGame() {
    if (suState.currentRound > 0) return;
    
    // Final check for connected players
    const connectedPlayers = suState.players.filter(p => p.connected);
    if (connectedPlayers.length < 2) {
        console.warn('Attempted to start game with < 2 connected players');
        return;
    }

    suState.currentRound = 0;
    suState.turnHistory = [];
    suState.roundResults = [];
    nextSuRound();
}

export function nextSuRound() {
    suState.currentRound++;
    if (suState.currentRound > suState.totalRounds) {
        broadcastSuEvent('gameResults', { results: suState.roundResults });
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
    const connectedPlayers = players.filter(p => p.connected);
    if (connectedPlayers.length < 2) return { setter: players[0], guesser: players[0] };

    if (roundIndex < players.length) {
        // Sequential but skip disconnected
        let setterIdx = roundIndex % players.length;
        while (!players[setterIdx].connected) {
            setterIdx = (setterIdx + 1) % players.length;
        }
        const setter = players[setterIdx];

        let guesserIdx = (setterIdx + 1) % players.length;
        while (!players[guesserIdx].connected || guesserIdx === setterIdx) {
            guesserIdx = (guesserIdx + 1) % players.length;
        }
        const guesser = players[guesserIdx];

        return { setter, guesser };
    } else {
        // Random from connected only
        let attempts = 0;
        let setter, guesser;
        const lastPair = suState.turnHistory[suState.turnHistory.length - 1];

        while (attempts < 10) {
            const shuffled = [...connectedPlayers].sort(() => Math.random() - 0.5);
            setter = shuffled[0];
            guesser = shuffled[1];

            if (setter.peerId !== guesser.peerId && 
                (!lastPair || setter.peerId !== lastPair[0] || guesser.peerId !== lastPair[1])) {
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
        autoPlaced,
        // Include round state for recovery
        roundIndex: suState.currentRound,
        setter: suState.currentSetter,
        guesser: suState.currentGuesser,
        totalRounds: suState.totalRounds
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
        setterName: suState.currentSetter.name,
        guesserName: suState.currentGuesser.name,
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

    // Sync players to ensure guests have latest scores for reveal leaderboard
    broadcastSuEvent('playersUpdate', { players: suState.players });
    broadcastSuEvent('roundReveal', result);
}
