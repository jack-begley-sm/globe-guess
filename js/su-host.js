// ============================================================
// FILE: js/su-host.js
// PURPOSE: Host-side PeerJS for Stitch Up.
// ============================================================

import { suState } from './su-state.js';
import { renderSuPlayerList } from './su-lobby.js';
import { initSetterPhase } from './su-setter.js';
import { initRoundReveal } from './su-results.js';
import { saveSession, clearSession } from './user.js';
import { requestWakeLock, releaseWakeLock } from './awake.js';

let suHostPeer = null;
let connections = {};
let hostAloneTimer = null;
let hostAloneSeconds = 60;
import { PEER_CONFIG } from './peer-config.js';

export function initSuHost(roomCode) {
    saveSession({ roomCode, name: suState.localPlayer.name, role: 'host', mode: 'su' });
    requestWakeLock();

    history.replaceState({}, '', window.location.pathname);

    // CHANGE 2: Clean up global
    if (suHostPeer) {
        suHostPeer.destroy();
        suHostPeer = null;
    }

    // CHANGE 3: Use window.Peer and assign to global
    suHostPeer = new window.Peer(roomCode, PEER_CONFIG);

    suHostPeer.on('open', (id) => console.log('SU Host Peer ID:', id));

    suHostPeer.on('connection', (conn) => {
        connections[conn.peer] = conn;
        conn.on('data', (data) => handleGuestData(conn.peer, data));
        conn.on('open', () => {
            console.log('SU Connection open:', conn.peer);
        });
        conn.on('close', () => handleDisconnect(conn.peer));
        conn.on('error', () => handleDisconnect(conn.peer));
    });

    suHostPeer.on('error', (err) => {
        console.error('SU Peer Error:', err);
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
    // Re-association logic: try peerId first, then name
    let player = suState.players.find(p => p.peerId === peerId || p.name === payload.name);
    
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
        player.peerId = peerId;
        player.name = payload.name;
        player.connected = true;
    }
    
    renderSuPlayerList(suState.players);
    broadcastPlayers();

    checkHostAlone();
}

function broadcastPlayers() {
    broadcastSuEvent('playersUpdate', { 
        players: suState.players,
        gameMode: 'su',
        gameState: {
            currentRound: suState.currentRound,
            totalRounds: suState.totalRounds,
            currentSetter: suState.currentSetter,
            currentGuesser: suState.currentGuesser,
            region: suState.region,
            inProgress: suState.currentRound > 0
        }
    });
}

function handleDisconnect(peerId) {
    const player = suState.players.find(p => p.peerId === peerId);
    if (player) {
        player.connected = false;
        renderSuPlayerList(suState.players);
        broadcastPlayers();
        
        const connectedCount = suState.players.filter(p => p.connected).length;

        // Handle in-game disconnects
        if (suState.currentRound > 0 && suState.currentRound <= suState.totalRounds) {
            const isSetter = suState.currentSetter && suState.currentSetter.peerId === peerId;
            const isGuesser = suState.currentGuesser && suState.currentGuesser.peerId === peerId;

            if (isSetter || isGuesser) {
                if (connectedCount < 2) {
                    // Don't abort immediately, wait for reconnection if host is alone
                    // broadcastSuEvent('gameAborted', { reason: 'Not enough players remaining.' });
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

    checkHostAlone();
}

function checkHostAlone() {
    const connectedGuests = suState.players.filter(p => p.connected);
    if (connectedGuests.length === 0 && suState.currentRound > 0) {
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
            quitSuGame();
        }
    }, 1000);

    document.getElementById('btn-host-alone-quit').onclick = () => {
        quitSuGame();
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

function quitSuGame() {
    clearSession();
    releaseWakeLock();
    window.location.href = window.location.origin + window.location.pathname;
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

    broadcastPlayers();
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
    broadcastPlayers();
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
        totalRounds: suState.totalRounds,
        region: suState.region
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
        totalRounds: suState.totalRounds,
        region: suState.region
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
        const scoreObj = calculateScore(latLng, suState.confirmedLatLng, 0, 0, false, 0, suState.shape.scaleKm);
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
    broadcastPlayers();
    broadcastSuEvent('roundReveal', result);
}
