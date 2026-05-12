// ============================================================
// FILE: js/vs-network.js
// PURPOSE: Thin communication layer to break circular deps between
// vs-host/vs-guest and vs-round. Both sides register their send
// functions here; vs-round imports from here only.
// ============================================================

let _broadcastFn = null;
let _sendGuessFn = null;

export function registerBroadcast(fn) {
    _broadcastFn = fn;
}

export function registerSendGuess(fn) {
    _sendGuessFn = fn;
}

export function broadcastEvent(type, payload) {
    if (_broadcastFn) _broadcastFn(type, payload);
}

export function sendVsGuess(latLng, timeTaken) {
    if (_sendGuessFn) _sendGuessFn(latLng, timeTaken);
}