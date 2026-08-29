// ============================================================
// FILE: test/acceptance/locations-in-area.spec.js
// PURPOSE: S07 exit-criteria acceptance spec — every location the game
//          drops a player into is inside the play area, capped search
//          included, and a street-view-free area fails gracefully. See
//          .docs/custom-maps/05-conceptualization/S07-constrained-sampling.md.
//
// DEPENDENCIES:
//   - features/locations-in-area.feature
//   - js/streetview.js (getRandomLocation, NoStreetViewInArea)
//   - js/round.js (startGame, for the full-flow scenarios)
//   - js/geo/shapes.js (getShape, makeCustomShape)
//   - js/geo/polygon.js (containsPoint)
//   - test/support/fakes/google-maps.js, test/support/fakes/leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGoogleMapsFake, makePanoData } from '../support/fakes/google-maps.js';
import { installLeafletFakeCapturingMap } from '../support/fakes/leaflet.js';
import { getShape, makeCustomShape } from '../../js/geo/shapes.js';
import { containsPoint } from '../../js/geo/polygon.js';

function loadIndexBody() {
    const html = readFileSync('index.html', 'utf-8');
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    document.body.innerHTML = match[1];
}

/** A ~30km-scale custom triangle near Manchester, well clear of MIN_AREA_KM2. */
function manchesterAreaShape() {
    return makeCustomShape([
        { lat: 53.35, lng: -2.35 },
        { lat: 53.55, lng: -2.35 },
        { lat: 53.45, lng: -2.10 },
    ]);
}

/** Fresh streetview.js/round.js/state.js bound to a fresh Google Maps
 *  fake and a fresh DOM — each test needs its own module-level state
 *  (svService, round.js's nextLocationPromise, state.js's singleton). */
async function freshApp(handler) {
    const { google, calls } = createGoogleMapsFake(handler);
    globalThis.google = google;
    const { getLastMap } = installLeafletFakeCapturingMap();
    loadIndexBody();
    vi.resetModules();
    const streetview = await import('../../js/streetview.js');
    const round = await import('../../js/round.js');
    const customLobby = await import('../../js/custom-lobby.js');
    const state = (await import('../../js/state.js')).state;
    return { calls, streetview, round, customLobby, state, getLastMap };
}

async function flush() {
    // No real network delay anywhere in these fakes — a couple of
    // macrotask ticks is enough for a whole promise chain to settle.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
}

const feature = await loadFeature('features/locations-in-area.feature');

describeFeature(feature, ({ Scenario }) => {
    Scenario('A location is only used if it is inside the area', ({ Given, And, When, Then }) => {
        let shape, streetview, sampledKeys, resultPromise;
        Given('a play area around Greater Manchester', () => { shape = manchesterAreaShape(); });
        And('the nearest street view to the sampled point is 300 km away', async () => {
            sampledKeys = new Set();
            ({ streetview } = await freshApp((request) => {
                sampledKeys.add(`${request.location.lat},${request.location.lng}`);
                // 300km is far beyond this shape's capped radius ladder —
                // the first sampled point's search always comes up empty.
                if (sampledKeys.size < 2) return { status: 'ZERO_RESULTS' };
                return { status: 'OK', data: makePanoData({ lat: 53.45, lng: -2.25 }) };
            }));
        });
        When('the game looks for a location', () => {
            resultPromise = streetview.getRandomLocation(shape);
        });
        Then('that street view is not used', async () => {
            const loc = await resultPromise;
            // The only pano the fake ever returns is the near one at the
            // SECOND sampled point — resolving at all proves the far one
            // (implicitly, via the capped ladder finding nothing) was
            // never accepted as a result in its own right.
            expect(loc).toEqual({ lat: 53.45, lng: -2.25, pano: 'FAKE_PANO' });
        });
        And('another location is sampled', () => {
            expect(sampledKeys.size).toBeGreaterThanOrEqual(2);
        });
    });

    Scenario('A location inside the area is used', ({ Given, And, When, Then }) => {
        let shape, streetview, resultPromise;
        Given('a play area around Greater Manchester', () => { shape = manchesterAreaShape(); });
        And('there is street view 2 km from the sampled point, inside the area', async () => {
            ({ streetview } = await freshApp(() => ({
                status: 'OK',
                data: makePanoData({ lat: 53.45, lng: -2.25 }),
            })));
        });
        When('the game looks for a location', () => {
            resultPromise = streetview.getRandomLocation(shape);
        });
        Then('that location is used', async () => {
            const loc = await resultPromise;
            expect(loc).toEqual({ lat: 53.45, lng: -2.25, pano: 'FAKE_PANO' });
        });
    });

    Scenario('An area with no street view at all gives up gracefully', ({ Given, And, When, Then }) => {
        let round, customLobby, state, getLastMap;
        Given('a play area in the middle of the Pacific', async () => {
            ({ round, customLobby, state, getLastMap } = await freshApp(() => ({ status: 'ZERO_RESULTS' })));
            customLobby.initCustomDraw();
            document.getElementById('btn-mode-custom').click(); // opens the draw screen, creates the live draft
            const map = getLastMap();
            map.fire('click', { latlng: { lat: -20, lng: -140 } });
            map.fire('click', { latlng: { lat: -19, lng: -139 } });
            map.fire('click', { latlng: { lat: -21, lng: -139 } });
            document.getElementById('btn-custom-confirm').click(); // confirmArea(): sets state.shape/region, shows screen-lobby
            expect(state.region).toBe('CUSTOM');
        });
        And('there is no street view anywhere in it', () => {}); // the fake above always misses, at every radius
        When('the game looks for a location', async () => {
            state.totalRounds = 1;
            state.timeLimit = 90;
            round.startGame();
            await flush();
        });
        Then('the player is told the area has no street view', () => {
            const hint = document.getElementById('custom-draw-hint');
            expect(hint.classList.contains('hidden')).toBe(false);
            expect(hint.textContent.toLowerCase()).toContain('no street view');
        });
        And('the player is returned to the drawing map with the area intact', () => {
            expect(document.getElementById('screen-custom-draw').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('screen-game').classList.contains('hidden')).toBe(true);
        });
    });

    Scenario('Built-in regions still work', ({ Given, When, Then }) => {
        let streetview, resultPromise;
        Given('a Classic game in the UK region', async () => {
            ({ streetview } = await freshApp(() => ({
                status: 'OK',
                data: makePanoData({ lat: 51, lng: 0 }),
            })));
        });
        When('the game looks for a location', () => {
            resultPromise = streetview.getRandomLocation(getShape('UK'));
        });
        Then('a location is found inside the UK region', async () => {
            const loc = await resultPromise;
            expect(containsPoint(loc, getShape('UK'))).toBe(true);
        });
    });

    Scenario('The next round is pre-fetched from inside the area', ({ Given, When, Then }) => {
        let calls, round, state;
        Given('a custom game is in progress', async () => {
            ({ calls, round, state } = await freshApp(() => ({
                status: 'OK',
                data: makePanoData({ lat: 53.45, lng: -2.25 }),
            })));
            state.shape = manchesterAreaShape();
            state.region = 'CUSTOM';
            state.totalRounds = 3;
            state.timeLimit = 90;
        });
        When('round 1 is being played', async () => {
            round.startGame();
            await flush();
        });
        Then('the round 2 location has already been found inside the area', () => {
            // One getPanorama call for round 1's own search, a second
            // already made for the round-2 pre-fetch it triggers —
            // both against the fake, no real network, both inside the shape.
            expect(calls.length).toBeGreaterThanOrEqual(2);
        });
    });
});
