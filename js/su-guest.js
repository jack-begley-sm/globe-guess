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
            if (document.getElementById('screen-multiplayer-lobby').classList.contains('hidden') === false) {
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
            initRoundReveal(payload);
            break;
        case 'startSetup':
            document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
            if (suState.isHost) {
                document.getElementById('screen-su-setup').classList.remove('hidden');
            } else {
                document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
                document.getElementById('waiting-title').textContent = 'Waiting for host to start...';
                document.getElementById('waiting-subtitle').textContent = 'You are in the lobby';
            }
            break;
        case 'gameResults':
            showSuResults();
            break;
        case 'kicked':
            showSuMessage('KICKED', 'You were removed from the game by the host.');
            break;
    }
}

function handleStartRound(data) {
    suState.currentRound = data.roundIndex;
    suState.currentSetter = data.setter;
    suState.currentGuesser = data.guesser;
    suState.totalRounds = data.totalRounds;

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
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

    suState.confirmedLatLng = data.latLng;
    suState.confirmedPanoId = data.panoId;
    suState.autoPlaced = data.autoPlaced;

    if (suState.localPlayer.peerId === suState.currentGuesser.peerId) {
        initGuesserPhase(data.panoId, data.setterName, data.autoPlaced);
    } else if (suState.localPlayer.peerId === suState.currentSetter.peerId) {
        document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
        document.getElementById('waiting-title').textContent = `Waiting for ${suState.currentGuesser.name} to guess...`;
    } else {
        // Spectator
        initSpectatorView(data.panoId, data.latLng, suState.currentGuesser.name);
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
