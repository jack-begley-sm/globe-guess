// ============================================================
// FILE: test/acceptance/guessing-in-area.spec.js
// PURPOSE: S08 exit-criteria acceptance spec — every guess map (Classic,
//          VS, Co-op, Stitch Up) shows the play area and refuses a tap
//          outside it. See
//          .docs/custom-maps/05-conceptualization/S08-constrained-guessing.md.
//
// DEPENDENCIES:
//   - features/guessing-in-area.feature
//   - js/map.js, js/vs-round.js, js/su-guesser.js (the three guess maps)
//   - js/geo/shapes.js (getShape, makeCustomShape)
//   - test/support/fakes/leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installLeafletFakeCapturingMap } from '../support/fakes/leaflet.js';
import { getShape, makeCustomShape } from '../../js/geo/shapes.js';

function loadIndexBody() {
    const html = readFileSync('index.html', 'utf-8');
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    document.body.innerHTML = match[1];
}

const TRIANGLE = makeCustomShape([{ lat: 51, lng: 0 }, { lat: 52, lng: 1 }, { lat: 51, lng: 1 }]);
const INSIDE = { lat: 51.3, lng: 0.5 };
const OUTSIDE = { lat: 0, lng: 0 };

/** One driver per mode, each returning enough for the shared assertions
 *  below to work without caring which file actually implements it —
 *  the point of the ScenarioOutline is that all four behave the same. */
const MODE_DRIVERS = {
    async Classic(shape) {
        const map = await import('../../js/map.js');
        const state = (await import('../../js/state.js')).state;
        state.shape = shape;
        map.initMap();
        map.resetMap(shape);
        return { widgetId: 'guess-map-widget', submitButtonId: 'btn-submit-guess' };
    },
    async VS(shape) {
        const vsRound = await import('../../js/vs-round.js');
        const vsState = (await import('../../js/vs-state.js')).vsState;
        vsState.gameMode = 'vs';
        vsState.shape = shape;
        vsRound.initVsMap();
        vsRound.resetVsMap();
        return { widgetId: 'vs-guess-map-widget', submitButtonId: 'btn-vs-submit-guess' };
    },
    async 'Co-op'(shape) {
        const vsRound = await import('../../js/vs-round.js');
        const vsState = (await import('../../js/vs-state.js')).vsState;
        vsState.gameMode = 'coop';
        vsState.shape = shape;
        vsRound.initVsMap();
        vsRound.resetVsMap();
        return { widgetId: 'vs-guess-map-widget', submitButtonId: 'btn-vs-submit-guess' };
    },
    async 'Stitch Up'(shape) {
        const suGuesser = await import('../../js/su-guesser.js');
        const suState = (await import('../../js/su-state.js')).suState;
        suState.shape = shape;
        suGuesser.initGuesserPhase('PANO', 'Setter', false);
        // Stitch Up's guess map container starts un-expanded, same idea
        // as Classic/VS's "collapsed" widget, different class name.
        document.getElementById('su-guess-map-container').classList.add('expanded');
        return { submitButtonId: 'btn-su-submit-guess' };
    },
};

/** Fresh DOM + fresh Leaflet fake + fresh modules for one scenario/row. */
async function setUpMode(modeName, shape) {
    const { L, getLastMap } = installLeafletFakeCapturingMap();
    loadIndexBody();
    vi.resetModules();
    const driverInfo = await MODE_DRIVERS[modeName](shape);
    return { L, getLastMap, ...driverInfo };
}

function markerCount(map) {
    return map._layers.filter((l) => l.kind === 'marker').length;
}

function polygonCount(map) {
    return map._layers.filter((l) => l.kind === 'polygon').length;
}

const feature = await loadFeature('features/guessing-in-area.feature');

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
    Scenario('The play area is visible on the guess map', ({ Given, When, Then }) => {
        let ctx;
        Given('a custom game is in progress', async () => {
            ctx = await setUpMode('Classic', TRIANGLE);
        });
        When('the player opens the guess map', () => {}); // the map is already built by setup
        Then('the play area is outlined and the rest of the world is dimmed', () => {
            expect(polygonCount(ctx.getLastMap())).toBe(2); // outline + mask
        });
    });

    Scenario('Tapping inside the area places a pin', ({ Given, And, When, Then }) => {
        let ctx;
        Given('a custom game is in progress', async () => { ctx = await setUpMode('Classic', TRIANGLE); });
        And('the guess map is open', () => {
            document.getElementById(ctx.widgetId).classList.remove('collapsed');
            document.getElementById(ctx.widgetId).classList.add('expanded');
        });
        When('the player taps a point inside the play area', () => {
            ctx.getLastMap().fire('click', { latlng: ctx.L.latLng(INSIDE.lat, INSIDE.lng) });
        });
        Then('a pin is placed there', () => {
            expect(markerCount(ctx.getLastMap())).toBe(1);
        });
        And('the submit button is enabled', () => {
            expect(document.getElementById(ctx.submitButtonId).disabled).toBe(false);
        });
    });

    Scenario('Tapping outside the area places nothing', ({ Given, And, When, Then }) => {
        let ctx;
        Given('a custom game is in progress', async () => { ctx = await setUpMode('Classic', TRIANGLE); });
        And('the guess map is open', () => {
            document.getElementById(ctx.widgetId).classList.remove('collapsed');
            document.getElementById(ctx.widgetId).classList.add('expanded');
        });
        When('the player taps a point outside the play area', () => {
            ctx.getLastMap().fire('click', { latlng: ctx.L.latLng(OUTSIDE.lat, OUTSIDE.lng) });
        });
        Then('no pin is placed', () => {
            expect(markerCount(ctx.getLastMap())).toBe(0);
        });
        And('the submit button stays disabled', () => {
            expect(document.getElementById(ctx.submitButtonId).disabled).toBe(true);
        });
    });

    Scenario('Tapping outside after a valid guess keeps the valid guess', ({ Given, When, Then, And }) => {
        let ctx;
        Given('the player has placed a pin inside the play area', async () => {
            ctx = await setUpMode('Classic', TRIANGLE);
            document.getElementById(ctx.widgetId).classList.remove('collapsed');
            document.getElementById(ctx.widgetId).classList.add('expanded');
            ctx.getLastMap().fire('click', { latlng: ctx.L.latLng(INSIDE.lat, INSIDE.lng) });
        });
        When('the player taps a point outside the play area', () => {
            ctx.getLastMap().fire('click', { latlng: ctx.L.latLng(OUTSIDE.lat, OUTSIDE.lng) });
        });
        Then('the pin stays where it was', () => {
            expect(markerCount(ctx.getLastMap())).toBe(1);
        });
        And('the submit button stays enabled', () => {
            expect(document.getElementById(ctx.submitButtonId).disabled).toBe(false);
        });
    });

    Scenario('Built-in regions constrain guesses too', ({ Given, And, When, Then }) => {
        let ctx;
        Given('a Classic game in the UK region', async () => { ctx = await setUpMode('Classic', getShape('UK')); });
        And('the guess map is open', () => {
            document.getElementById(ctx.widgetId).classList.remove('collapsed');
            document.getElementById(ctx.widgetId).classList.add('expanded');
        });
        When('the player taps a point in France', () => {
            ctx.getLastMap().fire('click', { latlng: ctx.L.latLng(48.85, 2.35) }); // Paris
        });
        Then('no pin is placed', () => {
            expect(markerCount(ctx.getLastMap())).toBe(0);
        });
    });

    ScenarioOutline("Every mode's guess map refuses outside taps", ({ Given, And, When, Then }, variables) => {
        let ctx;
        Given('a <mode> game with a custom play area is in progress', async () => {
            ctx = await setUpMode(variables.mode, TRIANGLE);
        });
        And('the guess map is open', () => {
            if (ctx.widgetId) {
                document.getElementById(ctx.widgetId).classList.remove('collapsed');
                document.getElementById(ctx.widgetId).classList.add('expanded');
            }
            // Stitch Up's setUpMode already expands its own container.
        });
        When('the player taps a point outside the play area', () => {
            ctx.getLastMap().fire('click', { latlng: ctx.L.latLng(OUTSIDE.lat, OUTSIDE.lng) });
        });
        Then('no pin is placed', () => {
            expect(markerCount(ctx.getLastMap())).toBe(0);
        });
        And('the submit button stays disabled', () => {
            expect(document.getElementById(ctx.submitButtonId).disabled).toBe(true);
        });
    });

    Scenario('The first tap still just expands the collapsed map', ({ Given, And, When, Then }) => {
        let ctx;
        Given('a custom game is in progress', async () => { ctx = await setUpMode('Classic', TRIANGLE); });
        And('the guess map is collapsed', () => {
            expect(document.getElementById(ctx.widgetId).classList.contains('collapsed')).toBe(true);
        });
        When('the player taps the map', () => {
            ctx.getLastMap().fire('click', { latlng: ctx.L.latLng(INSIDE.lat, INSIDE.lng) });
        });
        Then('the map expands', () => {
            expect(document.getElementById(ctx.widgetId).classList.contains('expanded')).toBe(true);
        });
        And('no pin is placed', () => {
            expect(markerCount(ctx.getLastMap())).toBe(0);
        });
    });
});
