// ============================================================
// FILE: test/support/fakes/peer.js
// PURPOSE: In-memory fake of the PeerJS `Peer`/`DataConnection` API used
//          by js/vs-host.js and js/vs-guest.js (and, later, js/su-host.js
//          / js/su-guest.js) — lets multiplayer acceptance specs exchange
//          real messages between a fake host and a fake guest with no
//          network and no signalling server. See
//          .docs/custom-maps/05-conceptualization/S10-vs-mode.md.
//
// DEPENDENCIES:
//   - none
//
// USED BY:
//   - test/unit/peer-fake.spec.js
//   - test/acceptance/custom-vs-game.spec.js (Task 2 onward)
//
// KEY FUNCTIONS:
//   - installPeerFake()   installs FakePeer as globalThis.Peer, returns it
//   - resetPeerFake()     clears the shared registry (called by install)
// ============================================================

let registry;

export function resetPeerFake() {
    registry = new Map();
}
resetPeerFake();

function randomId() {
    return 'peer-' + Math.random().toString(36).slice(2, 10);
}

function makeEmitter() {
    const handlers = {};
    return {
        on(event, fn) { (handlers[event] ??= []).push(fn); },
        emit(event, ...args) { (handlers[event] || []).forEach((fn) => fn(...args)); },
    };
}

function makeConnection(peerId) {
    const emitter = makeEmitter();
    const conn = {
        peer: peerId,
        open: false,
        on: emitter.on,
        _emit: emitter.emit,
        _other: null,
        send(data) {
            if (!conn.open) return;
            const other = conn._other;
            Promise.resolve().then(() => other?._emit('data', data));
        },
        close() {
            if (!conn.open) return;
            conn.open = false;
            const other = conn._other;
            if (other) other.open = false;
            Promise.resolve().then(() => {
                conn._emit('close');
                other?._emit('close');
            });
        },
    };
    return conn;
}

export class FakePeer {
    constructor(id) {
        this.id = id || randomId();
        this._emitter = makeEmitter();
        this._connections = [];
        this.destroyed = false;
        registry.set(this.id, this);
        Promise.resolve().then(() => {
            if (!this.destroyed) this._emitter.emit('open', this.id);
        });
    }

    on(event, fn) { this._emitter.on(event, fn); }

    connect(remoteId) {
        const localConn = makeConnection(remoteId);
        this._connections.push(localConn);

        const remotePeer = registry.get(remoteId);
        if (!remotePeer || remotePeer.destroyed) {
            Promise.resolve().then(() => this._emitter.emit('error', {
                type: 'peer-unavailable',
                message: `Could not connect to peer ${remoteId}`,
            }));
            return localConn;
        }

        const remoteConn = makeConnection(this.id);
        remotePeer._connections.push(remoteConn);
        localConn._other = remoteConn;
        remoteConn._other = localConn;

        Promise.resolve().then(() => {
            localConn.open = true;
            remoteConn.open = true;
            // Fires on the target FIRST, synchronously within this
            // microtask, so its 'connection' handler (which typically
            // registers conn.on('open'/'data'/...) on remoteConn) has
            // already run before remoteConn's own 'open' fires below.
            remotePeer._emitter.emit('connection', remoteConn);
            remoteConn._emit('open');
            localConn._emit('open');
        });

        return localConn;
    }

    destroy() {
        this.destroyed = true;
        this._connections.forEach((c) => c.close());
        registry.delete(this.id);
    }
}

/** Installs the fake as `window.Peer`/`globalThis.Peer`, matching how
 *  js/vs-host.js and js/vs-guest.js read `window.Peer` — real PeerJS is
 *  loaded from a CDN <script> tag, never imported as a module. Resets
 *  the registry first so peer ids from a previous scenario never leak
 *  in. Call once per scenario (in a Given/Background). */
export function installPeerFake() {
    resetPeerFake();
    globalThis.Peer = FakePeer;
    return FakePeer;
}
