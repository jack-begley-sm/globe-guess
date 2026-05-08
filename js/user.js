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
const SESSION_KEY = 'globe_guess_session';

export function getUser() {
    return localStorage.getItem(STORAGE_KEY);
}

export function setUser(name) {
    if (name) {
        localStorage.setItem(STORAGE_KEY, name);
    }
}

export function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
        ...session,
        timestamp: Date.now()
    }));
}

export function getSession() {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    
    const session = JSON.parse(data);
    // Session valid for 1 hour
    if (Date.now() - session.timestamp > 3600000) {
        clearSession();
        return null;
    }
    return session;
}

export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}
