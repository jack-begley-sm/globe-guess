// ============================================================
// FILE: test/acceptance/draw-screen.spec.js
// PURPOSE: S06 exit-criteria acceptance spec — a player can open
//          Custom mode, tap out an area on a world map, see it, fix
//          it, and confirm it. Exercises the REAL index.html markup
//          loaded into jsdom, wired by the real js/custom-lobby.js and
//          js/custom-map.js, against the Leaflet fake. See
//          .docs/custom-maps/05-conceptualization/S06-draw-screen.md.
//
// DEPENDENCIES:
//   - features/draw-screen.feature
//   - index.html (real markup, loaded via fs)
//   - js/custom-lobby.js (initCustomDraw)
//   - test/support/fakes/leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installLeafletFakeCapturingMap } from '../support/fakes/leaflet.js';
import { initCustomDraw } from '../../js/custom-lobby.js';

function loadIndexBody() {
    const html = readFileSync('index.html', 'utf-8');
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    document.body.innerHTML = match[1];
}

function isHidden(id) {
    return document.getElementById(id).classList.contains('hidden');
}

let L, getLastMap;

/** Fresh DOM + fresh fake L + fresh listeners for one scenario. Run from
 *  the Background's own Given, NOT a vitest beforeEach — vitest-cucumber
 *  creates one test() per Gherkin step, so a beforeEach would wipe the
 *  DOM between steps of the SAME scenario, not just between scenarios. */
function resetWorld() {
    ({ L, getLastMap } = installLeafletFakeCapturingMap());
    loadIndexBody();
    initCustomDraw();
}

function clickCustomTile() {
    document.getElementById('btn-mode-custom').click();
}

function tapMap(lat, lng) {
    getLastMap().fire('click', { latlng: L.latLng(lat, lng) });
}

const feature = await loadFeature('features/draw-screen.feature');

describeFeature(feature, ({ Background, Scenario }) => {
    Background(({ Given }) => {
        Given('the player is on the home screen', () => {
            resetWorld();
            expect(isHidden('screen-landing')).toBe(false);
        });
    });

    Scenario('Custom mode opens the drawing map', ({ When, Then, And }) => {
        When('the player chooses Custom', () => { clickCustomTile(); });
        Then('the drawing map is shown', () => {
            expect(isHidden('screen-custom-draw')).toBe(false);
        });
        And('the confirm button is disabled', () => {
            expect(document.getElementById('btn-custom-confirm').disabled).toBe(true);
        });
    });

    Scenario('Tapping the map builds up the area', ({ Given, When, Then, And }) => {
        Given('the player is on the drawing map', () => { clickCustomTile(); });
        When('the player taps three points on the map', () => {
            tapMap(51, 0);
            tapMap(52, 1);
            tapMap(51, 1);
        });
        Then('the area outline is drawn', () => {
            const polygons = getLastMap()._layers.filter((l) => l.kind === 'polygon');
            expect(polygons.length).toBeGreaterThanOrEqual(1);
        });
        And('the confirm button is enabled', () => {
            expect(document.getElementById('btn-custom-confirm').disabled).toBe(false);
        });
    });

    Scenario('The world outside the area is dimmed', ({ Given, Then }) => {
        Given('the player has drawn a valid area', () => {
            clickCustomTile();
            tapMap(51, 0);
            tapMap(52, 1);
            tapMap(51, 1);
        });
        Then('the map shows the area highlighted and the rest of the world dimmed', () => {
            // Ring outline + world-with-a-hole mask: two polygons once >= 3 points.
            const polygons = getLastMap()._layers.filter((l) => l.kind === 'polygon');
            expect(polygons.length).toBe(2);
        });
    });

    Scenario('Undo steps back one point', ({ Given, When, Then }) => {
        Given('the player has drawn a valid area', () => {
            clickCustomTile();
            tapMap(51, 0);
            tapMap(52, 1);
            tapMap(51, 1);
        });
        When('the player taps undo', () => {
            document.getElementById('btn-custom-undo').click();
        });
        Then('the confirm button is disabled', () => {
            expect(document.getElementById('btn-custom-confirm').disabled).toBe(true);
        });
    });

    Scenario('A rejected tap explains itself', ({ Given, When, Then, And }) => {
        Given('the player has drawn a valid area', () => {
            clickCustomTile();
            tapMap(0, 0);
            tapMap(10, 10);
            tapMap(0, 10);
        });
        When('the player taps a point that would make the shape cross itself', () => {
            tapMap(10, 0);
        });
        Then('no point is added', () => {
            const markers = getLastMap()._layers.filter((l) => l.kind === 'circleMarker');
            expect(markers.length).toBe(3);
        });
        And('a message explains that the shape crosses itself', () => {
            const hint = document.getElementById('custom-draw-hint');
            expect(hint.classList.contains('hidden')).toBe(false);
            expect(hint.textContent.toLowerCase()).toContain('cross');
        });
    });

    Scenario('Confirming carries the area into the game options', ({ Given, When, Then, And }) => {
        Given('the player has drawn a valid area', () => {
            clickCustomTile();
            tapMap(51, 0);
            tapMap(52, 1);
            tapMap(51, 1);
        });
        When('the player confirms the area', () => {
            document.getElementById('btn-custom-confirm').click();
        });
        Then('the game options screen is shown', () => {
            expect(isHidden('screen-lobby')).toBe(false);
        });
        And('the options screen shows the chosen area instead of the region grid', () => {
            expect(isHidden('section-region')).toBe(true);
            expect(isHidden('custom-area-summary')).toBe(false);
        });
    });

    Scenario('Going back from the drawing map returns home', ({ Given, When, Then, And }) => {
        Given('the player is on the drawing map with two points tapped', () => {
            clickCustomTile();
            tapMap(51, 0);
            tapMap(52, 1);
        });
        When('the player goes back', () => {
            document.getElementById('btn-custom-back').click();
        });
        Then('the home screen is shown', () => {
            expect(isHidden('screen-landing')).toBe(false);
        });
        And('the drawing is discarded', () => {
            clickCustomTile(); // re-enter Custom
            const markers = getLastMap()._layers.filter((l) => l.kind === 'circleMarker');
            expect(markers.length).toBe(0);
        });
    });
});

// Not part of S06's own feature scenarios (those stop at "confirming
// carries the area into the game options") — this covers the one real
// transition none of them exercise: pressing the actual Classic lobby
// START button afterward. Caught a real Critical bug on first write:
// js/lobby.js's handleStart() unconditionally read `.region-grid
// button.active` and overwrote state.region/state.shape, discarding the
// confirmed Custom area and silently playing WORLD instead — the region
// grid's buttons stay in the DOM (WORLD still marked .active) even once
// #section-region itself is hidden.
describe('Pressing START after confirming a Custom area', () => {
    it('keeps the drawn area instead of falling back to whichever built-in region is marked active', async () => {
        vi.resetModules();
        const { L, getLastMap } = installLeafletFakeCapturingMap();
        const html = readFileSync('index.html', 'utf-8');
        document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];

        const { initCustomDraw: initDraw } = await import('../../js/custom-lobby.js');
        const { initLobby } = await import('../../js/lobby.js');
        const state = (await import('../../js/state.js')).state;

        initDraw();
        initLobby();

        document.getElementById('btn-mode-custom').click();
        const map = getLastMap();
        map.fire('click', { latlng: L.latLng(51, 0) });
        map.fire('click', { latlng: L.latLng(52, 1) });
        map.fire('click', { latlng: L.latLng(51, 1) });
        document.getElementById('btn-custom-confirm').click();
        expect(state.region).toBe('CUSTOM');
        const drawnShape = state.shape;

        document.getElementById('input-player-name').value = 'Tester';
        document.getElementById('btn-start-classic').click();

        expect(state.region).toBe('CUSTOM');
        expect(state.shape).toBe(drawnShape);
    });
});

// Also not part of S06's own scenarios. addPoint only validates the OPEN
// path (no closing edge), so a ring whose sole crossing is via that
// closing edge sailed through every tap and left CONFIRM enabled —
// pressing it then threw unhandled out of the click listener. Fixed by
// checking ringIsSimple on the closed ring in custom-draft.js's status().
describe('A ring that only crosses itself via the closing edge', () => {
    it('leaves CONFIRM disabled instead of throwing when pressed', () => {
        resetWorld();
        clickCustomTile();
        // A spiral: every individual tap is accepted, but the ring
        // closes(last point back to the first) across an earlier edge.
        tapMap(0, 0);
        tapMap(0, 1);
        tapMap(1, 1);
        tapMap(1, -1);
        tapMap(-1, -1);
        tapMap(-1, 2);
        tapMap(3, 2);

        expect(document.getElementById('btn-custom-confirm').disabled).toBe(true);
        expect(() => document.getElementById('btn-custom-confirm').click()).not.toThrow();
    });
});
