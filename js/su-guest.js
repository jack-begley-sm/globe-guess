// ============================================================
// FILE: js/su-guest.js
// PURPOSE: Guest-side PeerJS for Stitch Up.
// ============================================================

import { suState } from './su-state.js';
import { renderSuPlayerList } from './su-lobby.js';
import { initSetterPhase } from './su-setter.js';
import { initGuesserPhase } from './su-guesser.js';
import { initSpectatorView, updateLiveGuesserPin } from './su-spectator.js';
import { initRoundReveal, showSuResults } from './su-results.js';

let hostConn = null;

export function joinSuGame(roomCode, name) {
    const peer = new Peer();
    
    peer.on('open', (id) => {
        suState.localPlayer.peerId = id;
        suState.localPlayer.name = name;
        
        hostConn = peer.connect(roomCode);
        
        hostConn.on('open', () => {
            hostConn.send({ type: 'join', payload: { name } });
            document.getElementById('modal-su-join').classList.add('hidden');
            document.getElementById('screen-landing').classList.add('hidden');
            document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
        });

        hostConn.on('data', (data) => handleSuEvent(data.type, data.payload));
        hostConn.on('close', () => handleHostDisconnect());
    });

    peer.on('error', (err) => {
        console.error('SU Guest Peer error:', err);
        handleHostDisconnect();
    });
}

export function handleSuEvent(type, payload) {
    switch (type) {
        case 'playersUpdate':
            suState.players = payload.players;
            
            // Sync game state if provided (recovery mechanism)
            if (payload.gameState && payload.gameState.inProgress) {
                const gs = payload.gameState;
                if (suState.currentRound !== gs.currentRound || !suState.currentSetter) {
                    console.warn('Syncing game state from playersUpdate');
                    suState.currentRound = gs.currentRound;
                    suState.totalRounds = gs.totalRounds;
                    suState.currentSetter = gs.currentSetter;
                    suState.currentGuesser = gs.currentGuesser;
                    if (gs.region) suState.region = gs.region;
                    
                    // Trigger UI transition if we are in the lobby/waiting
                    const lobbyVisible = document.getElementById('screen-multiplayer-lobby') && !document.getElementById('screen-multiplayer-lobby').classList.contains('hidden');
                    const waitingVisible = document.getElementById('screen-multiplayer-waiting') && !document.getElementById('screen-multiplayer-waiting').classList.contains('hidden');
                    
                    if (lobbyVisible || waitingVisible) {
                        handleStartRound({
                            roundIndex: gs.currentRound,
                            setter: gs.currentSetter,
                            guesser: gs.currentGuesser,
                            totalRounds: gs.totalRounds,
                            region: gs.region
                        });
                    }
                }
            }

            const lobbyVisible = document.getElementById('screen-multiplayer-lobby') && !document.getElementById('screen-multiplayer-lobby').classList.contains('hidden');
            const waitingVisible = document.getElementById('screen-multiplayer-waiting') && !document.getElementById('screen-multiplayer-waiting').classList.contains('hidden');
            
            if (lobbyVisible || waitingVisible) {
                renderSuPlayerList(suState.players);
            }
            break;
        case 'startRound':
            handleStartRound(payload);
            break;
        case 'guesserPhase':
            handleGuesserPhase(payload);
            break;
        case 'livePinUpdate':
            if (suState.localPlayer.peerId !== payload.peerId) {
                updateLiveGuesserPin(payload.latLng);
            }
            break;
        case 'roundReveal':
            suState.confirmedLatLng = payload.correctLatLng; // Ensure we have it for reveal
            if (!suState.isHost) {
                suState.roundResults.push(payload);
            }
            initRoundReveal(payload);
            break;
        case 'startSetup':
            document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
            
            // Reset local state for new game
            suState.currentRound = 0;
            suState.roundResults = [];
            suState.currentSetter = null;
            suState.currentGuesser = null;
            suState.players.forEach(p => {
                p.setterScores = [];
                p.guesserScores = [];
            });

            if (suState.isHost) {
                document.getElementById('screen-su-setup').classList.remove('hidden');
            } else {
                document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
                document.getElementById('waiting-title').textContent = 'Waiting for host to start...';
                document.getElementById('waiting-subtitle').textContent = 'You are in the lobby';
            }
            break;
        case 'gameResults':
            if (payload && payload.results) {
                suState.roundResults = payload.results;
            }
            showSuResults();
            break;
        case 'kicked':
            showSuMessage('KICKED', 'You were removed from the game by the host.');
            break;
        case 'gameAborted':
            showSuMessage('GAME OVER', payload.reason || 'The game was ended because there were not enough players left.');
            break;
    }
}

function handleStartRound(data) {
    suState.currentRound = data.roundIndex;
    suState.currentSetter = data.setter;
    suState.currentGuesser = data.guesser;
    suState.totalRounds = data.totalRounds;
    if (data.region) suState.region = data.region;

    // Hide all game screens
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

    if (suState.localPlayer.peerId === suState.currentSetter.peerId) {
        initSetterPhase(suState.currentGuesser.name, suState.region);
    } else {
        document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
        document.getElementById('waiting-title').textContent = `Waiting for ${suState.currentSetter.name} to pick a location...`;
        document.getElementById('waiting-subtitle').textContent = `Round ${suState.currentRound} of ${suState.totalRounds}`;
    }
}

function handleGuesserPhase(data) {
    suState.confirmedLatLng = data.latLng;
    suState.confirmedPanoId = data.panoId;
    suState.autoPlaced = data.autoPlaced;

    // Recovery check: if we missed startRound, use the data provided in guesserPhase
    if (!suState.currentGuesser || !suState.currentSetter || suState.currentRound !== data.roundIndex) {
        console.warn('Syncing round state from guesserPhase payload');
        suState.currentRound = data.roundIndex;
        suState.currentSetter = data.setter;
        suState.currentGuesser = data.guesser;
        suState.totalRounds = data.totalRounds;
        if (data.region) suState.region = data.region;
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

    if (suState.currentGuesser && suState.localPlayer.peerId === suState.currentGuesser.peerId) {
        initGuesserPhase(data.panoId, data.setterName, data.autoPlaced);
    } else if (suState.currentSetter && suState.localPlayer.peerId === suState.currentSetter.peerId) {
        document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
        document.getElementById('waiting-title').textContent = `Waiting for ${suState.currentGuesser ? suState.currentGuesser.name : 'guesser'} to guess...`;
        document.getElementById('waiting-subtitle').textContent = '';
    } else {
        // Spectator
        initSpectatorView(data.panoId, data.latLng, suState.currentGuesser ? suState.currentGuesser.name : 'Guesser');
    }
}

export function sendSuData(type, payload) {
    if (hostConn && hostConn.open) {
        hostConn.send({ type, payload });
    }
}

function handleHostDisconnect() {
    showSuMessage('CONNECTION LOST', 'The host has left the game.');
}

function showSuMessage(title, body) {
    document.getElementById('su-message-title').textContent = title;
    document.getElementById('su-message-body').textContent = body;
    document.getElementById('modal-su-message').classList.remove('hidden');
}
