// ============================================================
// FILE: js/vs-state.js
// PURPOSE: Single source of truth for VS game state.
//
// DEPENDENCIES:
//   - js/geo/shapes.js  (getShape, for the default WORLD shape)
// ============================================================

import { getShape } from './geo/shapes.js';

export const vsState = {
    isHost: false,
    gameMode: 'vs', // 'vs' or 'coop'
    localPlayer: {
        name: '',
        peerId: ''
    },
    roomCode: '',
    players: [], // { name, peerId, connected: bool, scores: [], guesses: [], hasSubmitted: bool }
    currentRound: 1,
    totalRounds: 5,
    region: 'WORLD',
    shape: getShape('WORLD'),
    timeLimit: 180, // 3 minutes fixed
    roundResults: [], // { correctLocation: {lat, lng}, guesses: { peerId: { lat, lng, score, distance } } }
    sessionAwards: {},
    gameStarted: false,
    gameOver: false,

    reset() {
        // region/shape deliberately not touched here, same as today:
        // "Play Again" re-hosts the same room and keeps the chosen region.
        this.currentRound = 1;
        this.players.forEach(p => {
            p.scores = [];
            p.guesses = [];
        });
        this.roundResults = [];
        this.sessionAwards = {};
        this.gameStarted = false;
        this.gameOver = false;
    }
};
