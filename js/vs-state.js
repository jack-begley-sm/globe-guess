// ============================================================
// FILE: js/vs-state.js
// PURPOSE: Single source of truth for VS game state.
// ============================================================

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
    timeLimit: 180, // 3 minutes fixed
    roundResults: [], // { correctLocation: {lat, lng}, guesses: { peerId: { lat, lng, score, distance } } }
    sessionAwards: {},
    gameStarted: false,
    gameOver: false,

    reset() {
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
