# Custom Mode in VS / Co-op — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the host draw a Custom play area for a VS/Co-op game before the room exists, sync it correctly to every guest, and score/guess/session-restore against it exactly as built-in regions already do.

**Architecture:** `js/vs-lobby.js`'s `handleSetupNext` gains a `CUSTOM` branch that opens the existing generic `openCustomDraw()` draw screen and defers room creation to its `onConfirm` callback. The confirmed `Shape`'s ring travels to guests inside the existing `gameState` broadcast payload (`js/vs-host.js`); guests rebuild an identical `Shape` locally via the pure `makeCustomShape(ring)` rather than receiving a transmitted scale, so host and guest agree by construction. Scoring, the guess map's click-guard, and `getRandomLocation` already consume `vsState.shape` generically (verified by reading the current code) — this plan does not touch them beyond adding acceptance coverage.

**Tech Stack:** Vanilla JS/ESM, Vitest + `@amiceli/vitest-cucumber` (jsdom environment), Leaflet (faked in tests), PeerJS (faked in tests, new fake built in Task 1).

**Spec:** `.docs/custom-maps/08-list-of-items-3.md` (items 2–7) and `.docs/custom-maps/05-conceptualization/S10-vs-mode.md`. This plan implements items 2–7 of that list (S10, VS/Co-op); items 8–17 (S11 Stitch Up, S12 edge cases) are out of scope and covered by a later plan once this one has been played, per that doc's own "completed and replaced" rule.

## Global Constraints

- No file exceeds 150 lines; every JS file carries the CLAUDE.md header-comment format (PURPOSE / DEPENDENCIES / USED BY / KEY FUNCTIONS).
- All VS game state lives only in `js/vs-state.js`. No new constants belong in this plan (no new magic numbers are introduced).
- `SCORING.CURVE_EXPONENT` is currently `1.5` (`js/config.js`) — every example score in this plan is computed against that value, not the `2.0` used in S10's own doc (explicitly called stale by `08-list-of-items-3.md`).
- Test loop per task: AGREE (feature scenario reads as English) → RED outer (bind it, watch it fail for the right reason) → RED inner/GREEN/REFACTOR (plain Vitest for the pieces) → whole suite green → one commit.
- No scenario asserts on a DOM id directly in Gherkin text; ids live in step definitions only.
- `npm test` runs the whole suite (`vitest run`); run it after every task, not just at the end.

---

## Task 1: PeerJS test fake (item 2)

**Files:**
- Create: `test/support/fakes/peer.js`
- Create: `test/unit/peer-fake.spec.js`

**Interfaces:**
- Produces: `installPeerFake()` — installs a fresh `FakePeer` class as `globalThis.Peer` (matching production code's `window.Peer`) and returns the class. `new Peer(id?, config?)` registers in an in-memory registry (auto-generates an id if omitted) and asynchronously emits `'open'` with its id. `peer.connect(remoteId)` returns a `DataConnection`-shaped object (`{ peer, open, on, send, close }`); if `remoteId` isn't registered, the *connecting* peer asynchronously emits `'error'` with `{ type: 'peer-unavailable' }` instead. `peer.on('connection', conn => …)` fires on the target when a live connection completes. `peer.destroy()` closes all its connections and deregisters it.

- [ ] **Step 1: Write the failing test**

```js
// test/unit/peer-fake.spec.js
// ============================================================
// FILE: test/unit/peer-fake.spec.js
// PURPOSE: Verifies the PeerJS fake itself — a fake host and a fake
//          guest can exchange a scripted payload with no real network.
//          See .docs/custom-maps/05-conceptualization/S10-vs-mode.md.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- peer-fake`
Expected: FAIL — `test/support/fakes/peer.js` does not exist (`Cannot find module`).

- [ ] **Step 3: Write the fake**

```js
// test/support/fakes/peer.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- peer-fake`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — no existing test touches `globalThis.Peer`, so nothing else can regress.

- [ ] **Step 6: Commit**

```bash
git add test/support/fakes/peer.js test/unit/peer-fake.spec.js
git commit -m "test: add in-memory PeerJS fake (list 3, item 2)"
```

---

## Task 2: VS lobby Custom tile + deferred room creation (item 3)

**Files:**
- Modify: `index.html` (`#vs-region-grid`, around line 277)
- Modify: `js/vs-lobby.js` (`handleSetupNext`, lines 86–196)
- Create: `features/custom-vs-game.feature`
- Create: `test/acceptance/custom-vs-game.spec.js`

**Interfaces:**
- Consumes: `openCustomDraw(originScreenId, onConfirm)` from `js/custom-lobby.js` (existing, `onConfirm(shape)` receives a frozen `Shape`); `installPeerFake()` from Task 1.
- Produces: `createRoomAndShowShareScreen(name)` — a new (unexported, module-private) function in `js/vs-lobby.js` holding the room-creation logic previously inlined in `handleSetupNext`; later tasks do not call it directly, only `handleSetupNext` does.

- [ ] **Step 1: Write the failing feature + acceptance spec**

```gherkin
# features/custom-vs-game.feature
Feature: A custom area in a VS game

  Scenario: The host draws the area before the room is created
    Given the host has chosen VS mode with a custom area
    When the host confirms the area
    Then the room code is created
    And the share screen is shown

  Scenario: Playing again keeps the area
    Given a VS game in a custom area has finished
    When the host chooses play again
    Then the same area is used
    And the room code is unchanged
```

```js
// test/acceptance/custom-vs-game.spec.js
// ============================================================
// FILE: test/acceptance/custom-vs-game.spec.js
// PURPOSE: S10 acceptance spec — a custom area in a VS/Co-op game.
//          Built up task by task across list 3 items 3-7. See
//          .docs/custom-maps/05-conceptualization/S10-vs-mode.md.
//
// DEPENDENCIES:
//   - features/custom-vs-game.feature
//   - js/vs-lobby.js, js/vs-host.js, js/vs-guest.js, js/vs-round.js,
//     js/vs-state.js
//   - js/geo/shapes.js (makeCustomShape, for wire-format assertions)
//   - test/support/fakes/peer.js, leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installPeerFake } from '../support/fakes/peer.js';
import { installLeafletFakeCapturingMap } from '../support/fakes/leaflet.js';
import { createGoogleMapsFake, makePanoData } from '../support/fakes/google-maps.js';
import { makeCustomShape } from '../../js/geo/shapes.js';

function loadIndexBody() {
    const html = readFileSync('index.html', 'utf-8');
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    document.body.innerHTML = match[1];
}

async function flush() {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
}

// Inside the Manchester triangle drawManchesterArea() below draws — every
// scenario that starts a round needs Street View to resolve to a point
// actually inside the custom area, or getRandomLocation's containment
// re-check would resample forever and the 20-attempt budget would blow.
const PANO_POINT = { lat: 53.45, lng: -2.25 };

/** Fresh DOM + fresh Peer/Leaflet/Google-Maps fakes + fresh VS host
 *  modules for one scenario. Mirrors custom-solo-game.spec.js's
 *  freshGame(). Clears localStorage too — Task 5 onward asserts on the
 *  saved session, and jsdom's localStorage otherwise survives across
 *  scenarios in the same file (vi.resetModules() only resets the module
 *  registry, not browser globals). */
async function freshVsHost() {
    localStorage.clear();
    installPeerFake();
    const { L, getLastMap } = installLeafletFakeCapturingMap();
    const { google } = createGoogleMapsFake(() => ({
        status: 'OK',
        data: makePanoData({ lat: PANO_POINT.lat, lng: PANO_POINT.lng }),
    }));
    globalThis.google = google;
    loadIndexBody();
    vi.resetModules();
    const vsLobby = await import('../../js/vs-lobby.js');
    const vsHost = await import('../../js/vs-host.js');
    const vsRound = await import('../../js/vs-round.js');
    const customLobby = await import('../../js/custom-lobby.js');
    const { vsState } = await import('../../js/vs-state.js');
    customLobby.initCustomDraw();
    vsLobby.initVsSetup();
    return { vsState, vsLobby, vsHost, vsRound, L, getLastMap };
}

/** Three points near Manchester — same triangle used by the solo Custom
 *  acceptance spec, kept small so scaleKm stays well under a global
 *  region's, exercising the actual relative-scoring code path. */
function drawManchesterArea(ctx) {
    const map = ctx.getLastMap();
    map.fire('click', { latlng: ctx.L.latLng(53.35, -2.35) });
    map.fire('click', { latlng: ctx.L.latLng(53.55, -2.35) });
    map.fire('click', { latlng: ctx.L.latLng(53.45, -2.10) });
    document.getElementById('btn-custom-confirm').click();
}

const feature = await loadFeature('features/custom-vs-game.feature');

describeFeature(feature, ({ Scenario }) => {
    Scenario('The host draws the area before the room is created', ({ Given, When, Then, And }) => {
        let ctx;
        Given('the host has chosen VS mode with a custom area', async () => {
            ctx = await freshVsHost();
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            document.getElementById('btn-vs-setup-next').click();
            expect(document.getElementById('screen-custom-draw').classList.contains('hidden')).toBe(false);
            expect(ctx.vsState.roomCode).toBe('');
        });
        When('the host confirms the area', async () => {
            drawManchesterArea(ctx);
            await flush();
        });
        Then('the room code is created', () => {
            expect(ctx.vsState.roomCode).toBeTruthy();
            expect(ctx.vsState.region).toBe('CUSTOM');
            expect(ctx.vsState.shape.scaleKm).toBeGreaterThan(0);
        });
        And('the share screen is shown', () => {
            expect(document.getElementById('screen-multiplayer-share').classList.contains('hidden')).toBe(false);
        });
    });

    Scenario('Playing again keeps the area', ({ Given, When, Then, And }) => {
        let ctx, shape;
        Given('a VS game in a custom area has finished', async () => {
            ctx = await freshVsHost();
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            document.getElementById('btn-vs-setup-next').click();
            drawManchesterArea(ctx);
            await flush();
            shape = ctx.vsState.shape;
            ctx.vsState.gameOver = true;
        });
        When('the host chooses play again', async () => {
            document.getElementById('input-vs-host-name').value = 'Host';
            document.getElementById('btn-vs-setup-next').click();
            await flush();
        });
        Then('the same area is used', () => {
            expect(ctx.vsState.shape).toBe(shape);
            expect(ctx.vsState.region).toBe('CUSTOM');
        });
        And('the room code is unchanged', () => {
            expect(document.getElementById('lobby-room-code').textContent).toContain(ctx.vsState.roomCode);
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- custom-vs-game`
Expected: FAIL — clicking the CUSTOM tile does nothing special yet (no such button exists in `#vs-region-grid`, and `handleSetupNext` has no `CUSTOM` branch), so the draw screen never opens and `roomCode` assertions fail.

- [ ] **Step 3: Add the Custom tile to the VS region grid**

In `index.html`, inside `#vs-region-grid` (after the OCEANIA button, before the closing `</div>`):

```html
                            <button data-region="OCEANIA">🌏 Oceania</button>
                            <button data-region="CUSTOM">🖌️ Custom</button>
```

- [ ] **Step 4: Rewrite `handleSetupNext` to defer room creation for Custom**

In `js/vs-lobby.js`, add the import and replace the whole `handleSetupNext` function (lines 86–196) with the version below, which extracts the existing room-creation body (currently lines 121–195) into a new `createRoomAndShowShareScreen(name)`:

```js
import { openCustomDraw } from './custom-lobby.js';
```

```js
async function handleSetupNext() {
    const nameInput = document.getElementById('input-vs-host-name');
    const name = nameInput.value.trim();
    const errorMsg = document.getElementById('error-vs-host-name');

    if (!name) {
        errorMsg.classList.remove('hidden');
        nameInput.focus();
        return;
    }
    errorMsg.classList.add('hidden');
    setUser(name);

    vsState.isHost = true;
    vsState.localPlayer.name = name;

    const roundsBtn = document.querySelector('#control-vs-rounds button.active');
    vsState.totalRounds = parseInt(roundsBtn.dataset.value);

    // Re-hosting an existing room ("Play Again") keeps the same room code,
    // peer connection, player list, and region/shape — checked BEFORE the
    // region grid is read at all, so re-hosting never overwrites an
    // already-drawn Custom area (or any other region) with whatever the
    // grid happens to show underneath.
    if (vsState.roomCode) {
        document.getElementById('screen-vs-setup').classList.add('hidden');
        document.getElementById('screen-multiplayer-lobby').classList.remove('hidden');
        const lobbyCodeEl = document.getElementById('lobby-room-code');
        if (lobbyCodeEl) lobbyCodeEl.textContent = `CODE: ${vsState.roomCode}`;
        renderPlayerList();
        return;
    }

    const regionBtn = document.querySelector('#vs-region-grid button.active');
    const region = regionBtn.dataset.region;

    if (region === 'CUSTOM') {
        // Per S10-vs-mode.md: the area must exist before the room does, so
        // no guest can ever connect to a room whose play area is
        // undefined. Room creation moves into the onConfirm callback.
        // Next stays disabled for the whole drawing gap (both the confirm
        // and the back path clear it) so a rapid double-tap on Next can't
        // slip a second draw-screen visit in and end up creating two rooms.
        const nextBtn = document.getElementById('btn-vs-setup-next');
        const backBtn = document.getElementById('btn-custom-back');
        nextBtn.disabled = true;
        const reenableOnBack = () => { nextBtn.disabled = false; };
        backBtn?.addEventListener('click', reenableOnBack, { once: true });

        openCustomDraw('screen-vs-setup', (shape) => {
            backBtn?.removeEventListener('click', reenableOnBack);
            nextBtn.disabled = false;
            vsState.region = 'CUSTOM';
            vsState.shape = shape;
            createRoomAndShowShareScreen(name);
        });
        return;
    }

    vsState.region = region;
    vsState.shape = getShape(region);
    createRoomAndShowShareScreen(name);
}

function createRoomAndShowShareScreen(name) {
    const roomCode = generateRoomCode();
    vsState.roomCode = roomCode;
    vsState.localPlayer.peerId = roomCode;

    // --- CONSOLIDATED ROBUST URL GENERATION ---
    let finalJoinURL;
    const modeParam = vsState.gameMode === 'coop' ? 'join-coop' : 'join';

    if (window.Capacitor?.isNativePlatform()) {
        finalJoinURL = `${GITHUB_PAGES_URL}/?${modeParam}=${roomCode}`;
    } else {
        const currentURL = new URL(window.location.href);
        const hostname = currentURL.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            finalJoinURL = `${GITHUB_PAGES_URL}/?${modeParam}=${roomCode}`;
        } else {
            finalJoinURL = `${currentURL.origin}${currentURL.pathname}?${modeParam}=${roomCode}`;
        }
    }

    const urlInput = document.getElementById('input-share-url');
    if (urlInput) {
        urlInput.value = finalJoinURL;
        urlInput.readOnly = false;
        urlInput.addEventListener('input', () => {
            updateWhatsAppLink(urlInput.value);
        });
    }

    updateWhatsAppLink(finalJoinURL);
    // --- END URL GENERATION ---

    vsState.players = [{
        name: name,
        peerId: roomCode,
        connected: true,
        scores: [],
        guesses: [],
        hasSubmitted: false
    }];

    initHost(roomCode);

    document.getElementById('display-room-code').textContent = roomCode;
    document.getElementById('lobby-room-code').textContent = `CODE: ${roomCode}`;

    document.getElementById('btn-copy-link').onclick = () => {
        const valToCopy = urlInput ? urlInput.value : finalJoinURL;
        navigator.clipboard.writeText(valToCopy);
        const btn = document.getElementById('btn-copy-link');
        const icon = btn.querySelector('i, svg');
        if (!icon) return;
        const oldIcon = icon.getAttribute('data-lucide');
        icon.setAttribute('data-lucide', 'check');
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
            icon.setAttribute('data-lucide', oldIcon);
            if (window.lucide) window.lucide.createIcons();
        }, 2000);
    };

    document.getElementById('screen-vs-setup').classList.add('hidden');
    document.getElementById('screen-multiplayer-share').classList.remove('hidden');

    renderPlayerList();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- custom-vs-game`
Expected: PASS, both scenarios green.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS. Pay particular attention to any existing VS lobby test — none currently exists, but re-run the full suite anyway since `handleSetupNext`'s control flow changed for every region, not just CUSTOM.

- [ ] **Step 7: Commit**

```bash
git add index.html js/vs-lobby.js features/custom-vs-game.feature test/acceptance/custom-vs-game.spec.js
git commit -m "feat: VS lobby Custom tile defers room creation until the area is drawn (list 3, item 3)"
```

---

## Task 3: Ring sync to guests (item 4)

**Files:**
- Modify: `js/vs-host.js` (`broadcastPlayers`, lines 132–150)
- Modify: `js/vs-guest.js` (`handleEvent`'s `playersUpdate` branch, lines 118–146; add import)
- Modify: `js/vs-round.js` (`resumeInProgressRound`, lines 118–168; add import)
- Modify: `features/custom-vs-game.feature`, `test/acceptance/custom-vs-game.spec.js`

**Interfaces:**
- Consumes: `makeCustomShape(ring)` from `js/geo/shapes.js` (existing).
- Produces: `broadcastPlayers()`'s `gameState` payload now always includes `ring: vsState.shape.ring` alongside `region`.

- [ ] **Step 1: Write the failing scenarios**

Append to `features/custom-vs-game.feature`:

```gherkin
  Scenario: A guest joining receives the area
    Given a host has created a VS room with a custom area
    When a guest joins the room
    Then the guest's play area matches the host's

  Scenario: A guest in the lobby already knows the area
    Given a host has created a VS room with a custom area
    And a guest has joined but the game has not started
    Then the guest's play area matches the host's

  Scenario: A guest joining mid-game receives the area
    Given a VS game with a custom area is in progress
    When a guest joins the room
    Then the guest's play area matches the host's
```

Append to `test/acceptance/custom-vs-game.spec.js`, inside the same `describeFeature` block (add these imports at the top of the file first: `import { makeCustomShape } from '../../js/geo/shapes.js';` is already imported in Task 2's version — keep it):

```js
    Scenario('A guest joining receives the area', ({ Given, When, Then }) => {
        let ctx, capturedRing;
        Given('a host has created a VS room with a custom area', async () => {
            ctx = await freshVsHost();
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            document.getElementById('btn-vs-setup-next').click();
            drawManchesterArea(ctx);
            await flush();
        });
        When("a guest joins the room", async () => {
            // Stand in for the guest using the raw Peer fake (see the
            // Task 2 note on why the real vs-guest.js module isn't used
            // here) — connects, sends 'join', and records the ring the
            // real vs-host.js broadcasts back.
            const guestPeer = new globalThis.Peer();
            await flush();
            const conn = guestPeer.connect(ctx.vsState.roomCode);
            const received = [];
            conn.on('data', (data) => received.push(data));
            await flush();
            conn.send({ type: 'join', payload: { name: 'Guest' } });
            await flush();
            const update = received.find((m) => m.type === 'playersUpdate');
            capturedRing = update?.payload?.gameState?.ring;
        });
        Then("the guest's play area matches the host's", () => {
            expect(capturedRing).toBeTruthy();
            const rebuilt = makeCustomShape(capturedRing);
            expect(rebuilt.scaleKm).toBeCloseTo(ctx.vsState.shape.scaleKm, 3);
        });
    });

    Scenario('A guest in the lobby already knows the area', ({ Given, And, Then }) => {
        let ctx, capturedRing, capturedInProgress;
        Given('a host has created a VS room with a custom area', async () => {
            ctx = await freshVsHost();
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            document.getElementById('btn-vs-setup-next').click();
            drawManchesterArea(ctx);
            await flush();
        });
        And('a guest has joined but the game has not started', async () => {
            const guestPeer = new globalThis.Peer();
            await flush();
            const conn = guestPeer.connect(ctx.vsState.roomCode);
            const received = [];
            conn.on('data', (data) => received.push(data));
            await flush();
            conn.send({ type: 'join', payload: { name: 'Guest' } });
            await flush();
            const update = received.find((m) => m.type === 'playersUpdate');
            capturedRing = update?.payload?.gameState?.ring;
            capturedInProgress = update?.payload?.gameState?.inProgress;
        });
        Then("the guest's play area matches the host's", () => {
            expect(capturedInProgress).toBe(false); // proves this arrived before kickoff, not via a round-start message
            expect(capturedRing).toBeTruthy();
            expect(makeCustomShape(capturedRing).scaleKm).toBeCloseTo(ctx.vsState.shape.scaleKm, 3);
        });
    });

    Scenario('A guest joining mid-game receives the area', ({ Given, When, Then }) => {
        let ctx, capturedRing;
        Given('a VS game with a custom area is in progress', async () => {
            ctx = await freshVsHost();
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            document.getElementById('btn-vs-setup-next').click();
            drawManchesterArea(ctx);
            await flush();
            // A second player is required before Start is enabled.
            ctx.vsState.players.push({ name: 'P2', peerId: 'p2', connected: true, scores: [], guesses: [], hasSubmitted: false });
            document.getElementById('btn-start-multiplayer').click();
            await flush();
        });
        When('a guest joins the room', async () => {
            const guestPeer = new globalThis.Peer();
            await flush();
            const conn = guestPeer.connect(ctx.vsState.roomCode);
            const received = [];
            conn.on('data', (data) => received.push(data));
            await flush();
            conn.send({ type: 'join', payload: { name: 'Guest2' } });
            await flush();
            const update = received.find((m) => m.type === 'playersUpdate');
            capturedRing = update?.payload?.gameState?.ring;
            expect(update.payload.gameState.inProgress).toBe(true);
        });
        Then("the guest's play area matches the host's", () => {
            expect(capturedRing).toBeTruthy();
            expect(makeCustomShape(capturedRing).scaleKm).toBeCloseTo(ctx.vsState.shape.scaleKm, 3);
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- custom-vs-game`
Expected: FAIL — `gameState.ring` is `undefined` in every captured payload (`broadcastPlayers` doesn't send it yet).

- [ ] **Step 3: Broadcast the ring**

In `js/vs-host.js`, in `broadcastPlayers()`'s `gameState` object, add one line:

```js
        gameState: {
            inProgress: vsState.gameStarted && !vsState.gameOver,
            currentRound: vsState.currentRound,
            totalRounds: vsState.totalRounds,
            region: vsState.region,
            ring: vsState.shape.ring,
            currentLocation: vsState.currentLocation,
            timeLimit: vsState.timeLimit,
            timerStart: vsState.timerStart
        }
```

- [ ] **Step 4: Guest rebuilds the shape at the `playersUpdate` level**

In `js/vs-guest.js`, add the import:

```js
import { makeCustomShape } from './geo/shapes.js';
```

And in `handleEvent`'s `playersUpdate` branch, right after the `gameMode` line and before `renderPlayerList()`:

```js
        // A guest sitting in the lobby before kickoff previously had no
        // play area at all — nothing read the region before a round
        // started, which was invisible for built-in regions but a real
        // bug for Custom, whose guess map needs an outline the moment it
        // opens. Rebuild it here too, not only in resumeInProgressRound.
        if (payload.gameState?.region === 'CUSTOM' && payload.gameState.ring) {
            try {
                vsState.region = 'CUSTOM';
                vsState.shape = makeCustomShape(payload.gameState.ring);
            } catch (err) {
                console.warn('playersUpdate: could not rebuild custom shape from ring', err);
            }
        }
```

- [ ] **Step 5: Fix `resumeInProgressRound` for Custom**

In `js/vs-round.js`, extend the existing import:

```js
import { getShape, makeCustomShape } from './geo/shapes.js';
```

And replace the shape-rebuild block inside `resumeInProgressRound` (currently `getShape(vsState.region)` inside a try/catch):

```js
    vsState.region = gameState.region;
    try {
        vsState.shape = (vsState.region === 'CUSTOM' && gameState.ring)
            ? makeCustomShape(gameState.ring)
            : getShape(vsState.region);
    } catch (err) {
        // Peer-supplied region/ring (e.g. a version-skewed host) must not
        // crash a reconnect — keep the previous shape and log it instead.
        console.warn(`resumeInProgressRound: unusable region '${vsState.region}' from peer`, err);
    }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- custom-vs-game`
Expected: PASS, all 5 scenarios so far green.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add js/vs-host.js js/vs-guest.js js/vs-round.js features/custom-vs-game.feature test/acceptance/custom-vs-game.spec.js
git commit -m "feat: sync custom play area ring from VS host to guests (list 3, item 4)"
```

---

## Task 4: Scoring and guessing verification (item 5)

Reading `js/vs-round.js` shows `onAllGuessesReceived` already passes `vsState.shape.scaleKm` into `calculateScore`, `startVsRound`/`setupHostRound` already call `getRandomLocation(vsState.shape)`, and `initVsMap` already wires `guardClick(() => vsState.shape, …)` around `placeVsMarker`. This task is verification, not new production code — it adds the acceptance coverage item 5 requires and fixes anything that coverage catches.

**Files:**
- Modify: `features/custom-vs-game.feature`, `test/acceptance/custom-vs-game.spec.js`
- Modify only if Step 2 fails for a real reason: `js/vs-round.js`

**Interfaces:**
- Consumes: `ctx.vsRound` (already returned by `freshVsHost()`), `ctx.vsState`.

- [ ] **Step 1: Write the failing scenarios**

Append to `features/custom-vs-game.feature`:

```gherkin
  Scenario: All players are scored against the same scale
    Given a VS game in a custom area whose scale is 200 km
    When one player guesses 10 km away and another guesses 60 km away
    Then the first scores 4190 points
    And the second scores 962 points

  Scenario: Guests cannot guess outside the area
    Given a VS game with a custom area is in progress
    When a guest taps outside the play area
    Then no pin is placed
```

The two scores are `scoreFromDistance` at `scaleKm=200`, `CURVE_EXPONENT=1.5`: `r=10/200=0.05 → 5000×(1−0.05/0.45)^1.5 = 4190`; `r=60/200=0.3 → 5000×(1−0.3/0.45)^1.5 = 962` (recomputed from the current formula — S10's own doc numbers, 3951/556, were computed against the exponent's original value of 2 and are stale, per `08-list-of-items-3.md`).

Append to `test/acceptance/custom-vs-game.spec.js` (add `import { calculateScore } from '../../js/scoring.js';` at the top):

```js
    Scenario('All players are scored against the same scale', ({ Given, When, Then, And }) => {
        let scoreA, scoreB;
        const HOME = { lat: 0, lng: 0 };
        function guessAtDistanceKm(distKm) {
            const R = 6371;
            const dLngDeg = (distKm / R) * (180 / Math.PI);
            return { lat: 0, lng: dLngDeg };
        }
        Given('a VS game in a custom area whose scale is 200 km', () => {});
        When('one player guesses 10 km away and another guesses 60 km away', () => {
            scoreA = calculateScore(guessAtDistanceKm(10), HOME, 0, 180, false, 0, 200).totalScore;
            scoreB = calculateScore(guessAtDistanceKm(60), HOME, 0, 180, false, 0, 200).totalScore;
        });
        Then('the first scores 4190 points', () => {
            const expected = Math.round(5000 * Math.pow(1 - (10 / 200) / 0.45, 1.5));
            expect(expected).toBe(4190);
            expect(scoreA).toBe(expected);
        });
        And('the second scores 962 points', () => {
            const expected = Math.round(5000 * Math.pow(1 - (60 / 200) / 0.45, 1.5));
            expect(expected).toBe(962);
            expect(scoreB).toBe(expected);
        });
    });

    Scenario('Guests cannot guess outside the area', ({ Given, When, Then }) => {
        let ctx;
        Given('a VS game with a custom area is in progress', async () => {
            ctx = await freshVsHost();
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            document.getElementById('btn-vs-setup-next').click();
            drawManchesterArea(ctx);
            await flush();
            ctx.vsState.players.push({ name: 'P2', peerId: 'p2', connected: true, scores: [], guesses: [], hasSubmitted: false });
            document.getElementById('btn-start-multiplayer').click();
            await flush();
        });
        When('a guest taps outside the play area', async () => {
            const map = ctx.getLastMap();
            // Widget starts collapsed — first click only expands it.
            map.fire('click', { latlng: ctx.L.latLng(10, 10) });
            map.fire('click', { latlng: ctx.L.latLng(10, 10) }); // far outside the Manchester triangle
        });
        Then('no pin is placed', () => {
            expect(document.getElementById('btn-vs-submit-guess').disabled).toBe(true);
        });
    });
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npm test -- custom-vs-game`
Expected: The scoring scenario should PASS immediately (pure function, nothing to wire). If "Guests cannot guess outside the area" fails, read the failure carefully — per the code already read in this plan's research, `map-overlay.js`'s `guardClick` is already wired into `initVsMap`, so this is expected to PASS too. If it fails, the cause is almost certainly `vsState.shape` being unset at map-creation time for a freshly-drawn Custom area — fix by confirming `drawManchesterArea`'s confirm callback (Task 2) really sets `vsState.shape` before `startVsRound()`/`initVsMap()` runs (it does, per Task 2's code), and re-check the test's own timing (`await flush()` placement) before touching production code.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add features/custom-vs-game.feature test/acceptance/custom-vs-game.spec.js
git commit -m "test: verify custom-area scoring and guess-guarding in VS (list 3, item 5)"
```

(If Step 2 required a production fix, include the changed file(s) in this same commit and note the fix in the commit body.)

---

## Task 5: Session restore + double-tap guard (item 6)

**Files:**
- Modify: `js/vs-host.js` (`initHost`, the `saveSession` call at line 40)
- Modify: `main.js` (host-restore branch, lines 259–267; add import)
- Modify: `features/custom-vs-game.feature`, `test/acceptance/custom-vs-game.spec.js`

**Interfaces:**
- Consumes: `makeCustomShape`, `getShape` from `js/geo/shapes.js`.
- Produces: `saveSession()`'s stored object now includes `region` and (only for `CUSTOM`) `ring`.

Guest-side restore needs no new code: `main.js`'s guest-restore branch already calls `joinGame(session.roomCode, session.name)` unchanged, which re-runs the full join handshake — Task 3's `playersUpdate`-level rebuild already restores the guest's shape as soon as the host replies. This task adds the regression scenario proving that, plus the double-tap guard test proving Task 2's disable/enable logic (Step 4 there) holds.

- [ ] **Step 1: Write the failing scenarios**

Append to `features/custom-vs-game.feature`:

```gherkin
  Scenario: Refreshing mid-game keeps the area for a guest
    Given a guest is playing a VS game in a custom area
    When the guest's session is restored after a refresh
    Then the guest rejoins with the same play area

  Scenario: Refreshing mid-game keeps the area for the host
    Given a host is running a VS game in a custom area
    When the host's session is restored after a refresh
    Then the host's play area is the one from before the refresh

  Scenario: A rapid double-click on Next does not create two rooms
    Given the host has chosen VS mode with a custom area
    When the host clicks Next twice in immediate succession
    And the host confirms the area
    Then only one room was ever created
```

Append to `test/acceptance/custom-vs-game.spec.js`:

```js
    Scenario('Refreshing mid-game keeps the area for a guest', ({ Given, When, Then }) => {
        let ctx, hostRing, capturedRing;
        Given('a guest is playing a VS game in a custom area', async () => {
            ctx = await freshVsHost();
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            document.getElementById('btn-vs-setup-next').click();
            drawManchesterArea(ctx);
            await flush();
            hostRing = ctx.vsState.shape.ring;
        });
        When("the guest's session is restored after a refresh", async () => {
            // Simulates main.js calling joinGame(roomCode, name) again on
            // load — the join handshake alone must restore the area, with
            // no guest-specific session storage of the ring required.
            const guestPeer = new globalThis.Peer();
            await flush();
            const conn = guestPeer.connect(ctx.vsState.roomCode);
            const received = [];
            conn.on('data', (data) => received.push(data));
            await flush();
            conn.send({ type: 'join', payload: { name: 'Guest' } });
            await flush();
            capturedRing = received.find((m) => m.type === 'playersUpdate')?.payload?.gameState?.ring;
        });
        Then('the guest rejoins with the same play area', () => {
            expect(capturedRing).toEqual(hostRing);
        });
    });

    Scenario('Refreshing mid-game keeps the area for the host', ({ Given, When, Then }) => {
        let ctx, session, shapeBefore;
        Given('a host is running a VS game in a custom area', async () => {
            ctx = await freshVsHost();
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            document.getElementById('btn-vs-setup-next').click();
            drawManchesterArea(ctx);
            await flush();
            shapeBefore = ctx.vsState.shape;
        });
        When("the host's session is restored after a refresh", async () => {
            const { getSession } = await import('../../js/user.js');
            session = getSession();
        });
        Then("the host's play area is the one from before the refresh", () => {
            expect(session.region).toBe('CUSTOM');
            expect(session.ring).toEqual(shapeBefore.ring);
            const rebuilt = makeCustomShape(session.ring);
            expect(rebuilt.scaleKm).toBeCloseTo(shapeBefore.scaleKm, 3);
        });
    });

    Scenario('A rapid double-click on Next does not create two rooms', ({ Given, When, And, Then }) => {
        let ctx, roomCodesSeen;
        Given('the host has chosen VS mode with a custom area', async () => {
            ctx = await freshVsHost();
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            roomCodesSeen = [];
        });
        When('the host clicks Next twice in immediate succession', () => {
            const nextBtn = document.getElementById('btn-vs-setup-next');
            nextBtn.click();
            nextBtn.click(); // disabled by the first call before this one is dispatched
            expect(nextBtn.disabled).toBe(true);
        });
        And('the host confirms the area', async () => {
            drawManchesterArea(ctx);
            await flush();
            roomCodesSeen.push(ctx.vsState.roomCode);
        });
        Then('only one room was ever created', () => {
            expect(roomCodesSeen.length).toBe(1);
            expect(document.getElementById('btn-vs-setup-next').disabled).toBe(false);
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- custom-vs-game`
Expected: FAIL — `session.region`/`session.ring` are `undefined` (not saved yet); the double-click scenario should already PASS since Task 2 implemented the guard, confirming that step correctly rather than adding new behavior.

- [ ] **Step 3: Persist region/ring in the session**

In `js/vs-host.js`, in `initHost`, replace the `saveSession` call:

```js
    saveSession({
        roomCode,
        name: vsState.localPlayer.name,
        role: 'host',
        mode: 'vs',
        gameMode: vsState.gameMode,
        region: vsState.region,
        ring: vsState.region === 'CUSTOM' ? vsState.shape.ring : undefined
    });
```

- [ ] **Step 4: Restore region/ring on host session restore**

In `main.js`, extend the import:

```js
import { getShape, makeCustomShape } from './js/geo/shapes.js';
```

And in the `session.role === 'host'` / `session.mode === 'vs'` branch, before `initHost(session.roomCode)`:

```js
            if (session.mode === 'vs') {
                vsState.localPlayer.name = session.name;
                vsState.gameMode = session.gameMode || 'vs';
                if (session.region === 'CUSTOM' && session.ring) {
                    try {
                        vsState.region = 'CUSTOM';
                        vsState.shape = makeCustomShape(session.ring);
                    } catch (err) {
                        console.warn('Session restore: could not rebuild custom shape from ring', err);
                    }
                } else if (session.region) {
                    vsState.region = session.region;
                    vsState.shape = getShape(session.region);
                }
                initHost(session.roomCode);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- custom-vs-game`
Expected: PASS, all scenarios so far green.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/vs-host.js main.js features/custom-vs-game.feature test/acceptance/custom-vs-game.spec.js
git commit -m "feat: persist and restore VS host's custom area across a refresh (list 3, item 6)"
```

---

## Task 6: S10 close-out — Co-op coverage, recomputed scores, full green (item 7)

**Files:**
- Modify: `features/custom-vs-game.feature`, `test/acceptance/custom-vs-game.spec.js`
- No production code expected; fix inline only if a genuine bug surfaces.

**Interfaces:**
- Consumes: everything produced by Tasks 1–5.

- [ ] **Step 1: Write the failing Co-op scenario**

Append to `features/custom-vs-game.feature`:

```gherkin
  Scenario: Co-op games support a custom area the same way
    Given a Co-op game in a custom area whose scale is 200 km
    When one player guesses 10 km away and another guesses 60 km away
    Then everyone is awarded the best score of 4190 points
```

Append to `test/acceptance/custom-vs-game.spec.js`:

```js
    Scenario('Co-op games support a custom area the same way', ({ Given, When, Then }) => {
        let ctx;
        const HOME = { lat: 0, lng: 0 };
        function guessAtDistanceKm(distKm) {
            const R = 6371;
            const dLngDeg = (distKm / R) * (180 / Math.PI);
            return { lat: 0, lng: dLngDeg };
        }
        Given('a Co-op game in a custom area whose scale is 200 km', async () => {
            ctx = await freshVsHost();
            ctx.vsState.gameMode = 'coop';
            document.getElementById('input-vs-host-name').value = 'Host';
            document.querySelector('#vs-region-grid button[data-region="CUSTOM"]').click();
            document.getElementById('btn-vs-setup-next').click();
            drawManchesterArea(ctx);
            await flush();
            ctx.vsState.shape = { ...ctx.vsState.shape, scaleKm: 200 }; // fix the scale so the Gherkin numbers are exact
            ctx.vsState.currentLocation = HOME;
            ctx.vsState.players = [
                { name: 'A', peerId: 'a', connected: true, scores: [], guesses: [guessAtDistanceKm(10)], hasSubmitted: true, lastTimeTaken: 0 },
                { name: 'B', peerId: 'b', connected: true, scores: [], guesses: [guessAtDistanceKm(60)], hasSubmitted: true, lastTimeTaken: 0 },
            ];
            ctx.vsState.currentRound = 1;
        });
        When('one player guesses 10 km away and another guesses 60 km away', () => {
            ctx.vsRound.onAllGuessesReceived();
        });
        Then('everyone is awarded the best score of 4190 points', () => {
            expect(ctx.vsState.players[0].scores[0]).toBe(4190);
            expect(ctx.vsState.players[1].scores[0]).toBe(4190);
        });
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- custom-vs-game`
Expected: FAIL only if Co-op's scoring path doesn't already read `vsState.shape.scaleKm` the same way VS does — per the code read for this plan, `onAllGuessesReceived` branches on `vsState.gameMode === 'coop'` only AFTER computing each player's `result` via the same `calculateScore(..., vsState.shape.scaleKm)` call, so this is expected to PASS immediately, confirming Co-op already shares the fixed code path with no further change needed.

- [ ] **Step 3: If it failed, fix inline; if it passed, proceed**

No placeholder — if Step 2 surprises you, the fix belongs in `js/vs-round.js`'s `onAllGuessesReceived`, scoped to whatever the failure actually shows. Do not pre-guess it.

- [ ] **Step 4: Re-read the whole feature file for consistency**

Open `features/custom-vs-game.feature` and read it top to bottom as English, per the ATDD "AGREE" step. Confirm:
- Every scenario describes player-visible behavior, no DOM ids.
- The two scoring scenarios' numbers (4190, 962) are the current ones, not S10 doc's stale 3951/556.
- No scenario needs splitting (none exceeds ~7 steps).

- [ ] **Step 5: Run the whole suite one more time**

Run: `npm test`
Expected: PASS, full suite green, all `custom-vs-game.feature` scenarios (11 total across Tasks 2–6) bound and passing.

- [ ] **Step 6: Record progress in the List of Items**

Append a row to the progress table in `.docs/custom-maps/08-list-of-items-3.md` for items 2–7, following the existing format (evenings actually taken, whether the box held, a note). This is documentation, not code — hand-write it based on what actually happened this session.

- [ ] **Step 7: Commit**

```bash
git add features/custom-vs-game.feature test/acceptance/custom-vs-game.spec.js .docs/custom-maps/08-list-of-items-3.md
git commit -m "test: S10 closed out — Co-op coverage, scores recomputed for CURVE_EXPONENT=1.5 (list 3, item 7)"
```

---

## After this plan

Two real browser profiles (or two devices) should play one VS game and one Co-op game in a hand-drawn Custom area before S11 (Stitch Up, items 8–12) starts — this is explicitly listed as manual verification in S10's own exit criteria and is not something the automated suite can substitute for. Once that's done and has taught whatever it teaches, item 8 onward gets its own plan the same way this one was written, per `08-list-of-items-3.md`'s "completed and replaced" rule — do not extend this plan file with S11 tasks.
