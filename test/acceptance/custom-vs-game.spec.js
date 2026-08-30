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
