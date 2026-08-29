// ============================================================
// FILE: js/state.js
// PURPOSE: Single source of truth for all game state.
//
// DEPENDENCIES:
//   - js/config.js      (default values)
//   - js/geo/shapes.js  (getShape, for the default/reset WORLD shape)
//
// USED BY:
//   - js/lobby.js
//   - js/round.js
//   - js/results.js
//   - js/map.js
//   - js/streetview.js
//
// KEY FUNCTIONS:
//   - resetState()       resets the state object to defaults
// ============================================================

import {
    DEFAULT_ROUNDS,
    DEFAULT_TIME_LIMIT,
    DEFAULT_SPEED_BONUS_PCT
} from './config.js';
import { getShape } from './geo/shapes.js';

export const state = {
    currentRound: 0,
    totalRounds: DEFAULT_ROUNDS,
    timeLimit: DEFAULT_TIME_LIMIT,
    speedBonusPct: DEFAULT_SPEED_BONUS_PCT,
    region: 'WORLD',
    shape: getShape('WORLD'),
    scores: [],
    currentLocation: null, // { lat, lng }
    guessLatLng: null,     // { lat, lng }
    timerStart: null
};

export function resetState() {
    state.currentRound = 0;
    state.totalRounds = DEFAULT_ROUNDS;
    state.timeLimit = DEFAULT_TIME_LIMIT;
    state.speedBonusPct = DEFAULT_SPEED_BONUS_PCT;
    // region resets to WORLD, so shape follows it — a drawn Custom shape
    // does not survive resetState(), same as any other region choice.
    state.region = 'WORLD';
    state.shape = getShape('WORLD');
    state.scores = [];
    state.currentLocation = null;
    state.guessLatLng = null;
    state.timerStart = null;
}
