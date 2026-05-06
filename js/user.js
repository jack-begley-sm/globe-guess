// ============================================================
// FILE: js/user.js
// PURPOSE: Store and retrieve the player's name via localStorage.
//
// DEPENDENCIES: none
//
// USED BY:
//   - js/lobby.js    (reads/writes name)
//   - js/results.js  (displays name on scoreboard)
//
// KEY FUNCTIONS:
//   - getUser()        returns stored name or null
//   - setUser(name)    saves name to localStorage
// ============================================================

const STORAGE_KEY = 'globe_guess_player_name';

export function getUser() {
    return localStorage.getItem(STORAGE_KEY);
}

export function setUser(name) {
    if (name) {
        localStorage.setItem(STORAGE_KEY, name);
    }
}
