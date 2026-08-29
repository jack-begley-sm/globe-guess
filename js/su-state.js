// ============================================================
// FILE: js/su-state.js
// PURPOSE: Single source of truth for Stitch Up game state.
//
// DEPENDENCIES:
//   - js/geo/shapes.js  (getShape, for the default WORLD shape)
// ============================================================

import { getShape } from './geo/shapes.js';

export const suState = {
    isHost: false,
    localPlayer: {
        name: '',
        peerId: ''
    },
    players: [], // { name, peerId, connected, setterScores: [], guesserScores: [] }
    currentRound: 0,
    totalRounds: 5,
    region: 'WORLD',
    shape: getShape('WORLD'),
    currentSetter: null,
    currentGuesser: null,
    confirmedPanoId: null,
    confirmedLatLng: null,
    autoPlaced: false,
    roundResults: [], // { setterId, guesserId, guessLatLng, correctLatLng, distance, guesserScore, setterScore, timeTaken, autoPlaced }
    turnHistory: [], // tracks previous setter→guesser pairs for constraint check
    roomCode: ''
};
