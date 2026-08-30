// ============================================================
// FILE: test/unit/peer-fake.spec.js
// PURPOSE: Verifies the PeerJS fake itself — a fake host and a fake
//          guest can exchange a scripted payload with no real network.
//          See .docs/custom-maps/05-conceptualization/S10-vs-mode.md.
//
// DEPENDENCIES:
//   - test/support/fakes/peer.js (installPeerFake)
//
// USED BY:
//   - npm test
//
// KEY FUNCTIONS:
//   - none (test file)
// ============================================================
import { describe, it, expect } from 'vitest';
import { installPeerFake } from '../support/fakes/peer.js';

async function flush() {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
}

describe('PeerJS fake', () => {
    it('lets a fake host and a fake guest exchange a scripted payload', async () => {
        const Peer = installPeerFake();
        const host = new Peer('ROOM1');
        await flush();

        const receivedByHost = [];
        host.on('connection', (conn) => {
            conn.on('data', (data) => receivedByHost.push(data));
        });

        const guest = new Peer();
        await flush();
        const conn = guest.connect('ROOM1');
        await flush();

        conn.send({ type: 'join', payload: { name: 'Ada' } });
        await flush();

        expect(receivedByHost).toEqual([{ type: 'join', payload: { name: 'Ada' } }]);
        expect(conn.open).toBe(true);
    });

    it('lets the host reply on the connection it received', async () => {
        const Peer = installPeerFake();
        const host = new Peer('ROOM2');
        await flush();

        host.on('connection', (conn) => {
            conn.send({ type: 'welcome' });
        });

        const guest = new Peer();
        await flush();
        const conn = guest.connect('ROOM2');
        const receivedByGuest = [];
        conn.on('data', (data) => receivedByGuest.push(data));
        await flush();

        expect(receivedByGuest).toEqual([{ type: 'welcome' }]);
    });

    it('errors the connecting peer when the target id is not registered', async () => {
        const Peer = installPeerFake();
        const guest = new Peer();
        await flush();

        let error;
        guest.on('error', (err) => { error = err; });
        guest.connect('NOBODY');
        await flush();

        expect(error.type).toBe('peer-unavailable');
    });

    it('fires close on both sides when either side closes', async () => {
        const Peer = installPeerFake();
        const host = new Peer('ROOM3');
        await flush();
        let hostConn;
        host.on('connection', (conn) => { hostConn = conn; });

        const guest = new Peer();
        await flush();
        const guestConn = guest.connect('ROOM3');
        await flush();

        let hostClosed = false;
        hostConn.on('close', () => { hostClosed = true; });
        guestConn.close();
        await flush();

        expect(hostClosed).toBe(true);
        expect(guestConn.open).toBe(false);
    });
});
