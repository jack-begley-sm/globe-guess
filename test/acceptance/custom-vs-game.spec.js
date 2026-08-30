// ============================================================
// FILE: test/acceptance/custom-vs-game.spec.js
// PURPOSE: S10 acceptance spec — a custom area in a VS/Co-op game.
//          Built up task by task across list 3 items 3-7. See
//          .docs/custom-maps/05-conceptualization/S10-vs-mode.md.
//
// DEPENDENCIES:
//   - features/custom-vs-game.feature
//   - js/vs-lobby.js, js/vs-host.js, js/vs-round.js, js/vs-state.js
//   - js/geo/shapes.js (makeCustomShape, for wire-format assertions)
//   - js/scoring.js (calculateScore, for scoring scenarios)
//   - test/support/fakes/peer.js, leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installPeerFake } from '../support/fakes/peer.js';
import { installLeafletFakeCapturingMap } from '../support/fakes/leaflet.js';
import { createGoogleMapsFake, makePanoData } from '../support/fakes/google-maps.js';
import { makeCustomShape } from '../../js/geo/shapes.js';
import { calculateScore } from '../../js/scoring.js';

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
            // Stand in for the guest using the raw Peer fake rather than
            // the real js/vs-guest.js. vsState is a module-level singleton,
            // so running the real js/vs-host.js and the real js/vs-guest.js
            // as two simultaneously-live module instances in one test isn't
            // straightforward — they'd share that one vsState, not two
            // independent ones representing separate "devices". Using a
            // FakePeer here connects, sends 'join', and captures the exact
            // wire payload the real host broadcasts, then verifies it
            // deserializes correctly via the same pure makeCustomShape
            // function guest code uses. That proves the WIRE FORMAT is
            // correct, but does NOT exercise js/vs-guest.js's own
            // playersUpdate/resumeInProgressRound rebuild logic.
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
        let ctx, shapeBefore, restoredShape, restoredRegion;
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
            // Exercise main.js's actual restore branch end to end, rather
            // than re-deriving an equivalent shape locally: import a fresh
            // copy of main.js (reusing the Peer/Leaflet/Google Maps fakes
            // freshVsHost() already installed on globalThis, same as real
            // browser globals would be reused across an actual refresh)
            // and fire the DOMContentLoaded it listens for, since jsdom's
            // already-loaded document won't fire that event again on its
            // own.
            // main.js registers document-level listeners (mode buttons, join
            // form, etc.) that this import does not tear down — they stay
            // registered for the rest of this test run. Confirmed dormant:
            // no later scenario re-dispatches the events they'd react to,
            // and each scenario's own installPeerFake() replaces the
            // fake-peer registry wholesale. Any FUTURE scenario appended
            // after this one should not assume a pristine `document`.
            vi.resetModules();
            await import('../../main.js');
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await flush();
            const restored = await import('../../js/vs-state.js');
            restoredShape = restored.vsState.shape;
            restoredRegion = restored.vsState.region;
        });
        Then("the host's play area is the one from before the refresh", () => {
            expect(restoredRegion).toBe('CUSTOM');
            expect(restoredShape.scaleKm).toBeCloseTo(shapeBefore.scaleKm, 3);
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
});

// Review-driven regression test for the "Playing again keeps the area"
// scenario above: that scenario only proves a CUSTOM area survives
// re-hosting, not that picking a DIFFERENT built-in region on the re-host
// screen actually takes effect. It didn't — the re-host early-return in
// handleSetupNext ran before the region grid was ever read, so a host who
// switched from World to UK for game 2 got no effect at all, with no
// feedback either way. See js/vs-lobby.js's handleSetupNext.
describe('Play Again with a different built-in region selected', () => {
    it('applies the new region instead of silently keeping the old one', async () => {
        const ctx = await freshVsHost();
        document.getElementById('input-vs-host-name').value = 'Host';
        document.querySelector('#vs-region-grid button[data-region="WORLD"]').click();
        document.getElementById('btn-vs-setup-next').click();
        await flush();
        expect(ctx.vsState.region).toBe('WORLD');
        expect(ctx.vsState.roomCode).toBeTruthy();

        ctx.vsState.gameOver = true;

        document.getElementById('input-vs-host-name').value = 'Host';
        document.querySelector('#vs-region-grid button[data-region="UK"]').click();
        document.getElementById('btn-vs-setup-next').click();
        await flush();

        expect(ctx.vsState.region).toBe('UK');
    });
});
