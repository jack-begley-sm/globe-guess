// ============================================================
// FILE: test/unit/su-guesser.spec.js
// PURPOSE: Unit tests for js/su-guesser.js's shape-aware guess map —
//          the Stitch Up wiring into js/map-overlay.js. See
//          .docs/custom-maps/05-conceptualization/S08-constrained-guessing.md.
//
// DEPENDENCIES:
//   - js/su-guesser.js
//   - js/su-state.js (suState)
//   - js/geo/shapes.js (makeCustomShape)
//   - test/support/fakes/leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installLeafletFakeCapturingMap } from '../support/fakes/leaflet.js';
import { makeCustomShape } from '../../js/geo/shapes.js';

function loadIndexBody() {
    const html = readFileSync('index.html', 'utf-8');
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    document.body.innerHTML = match[1];
}

const TRIANGLE = makeCustomShape([{ lat: 51, lng: 0 }, { lat: 52, lng: 1 }, { lat: 51, lng: 1 }]);

async function freshSuGuesser() {
    const { L, getLastMap } = installLeafletFakeCapturingMap();
    loadIndexBody();
    vi.resetModules();
    const suGuesser = await import('../../js/su-guesser.js');
    const suState = (await import('../../js/su-state.js')).suState;
    return { ...suGuesser, suState, L, getLastMap };
}

function expandGuessMap() {
    document.getElementById('su-guess-map-container').classList.add('expanded');
}

describe('su-guesser guess map', () => {
    it('draws the shape overlay when the map is built', async () => {
        const { initGuesserPhase, suState, getLastMap } = await freshSuGuesser();
        suState.shape = TRIANGLE;
        initGuesserPhase('PANO_ID', 'Setter', false);
        const polygons = getLastMap()._layers.filter((l) => l.kind === 'polygon');
        expect(polygons.length).toBe(2); // outline + mask
    });

    it('rejects a click outside the shape — no marker, submit stays disabled', async () => {
        const { initGuesserPhase, suState, getLastMap, L } = await freshSuGuesser();
        suState.shape = TRIANGLE;
        initGuesserPhase('PANO_ID', 'Setter', false);
        expandGuessMap();
        getLastMap().fire('click', { latlng: L.latLng(0, 0) }); // outside the triangle
        expect(getLastMap()._layers.some((l) => l.kind === 'marker')).toBe(false);
        expect(document.getElementById('btn-su-submit-guess').disabled).toBe(true);
    });

    it('accepts a click inside the shape — places a marker, enables submit', async () => {
        const { initGuesserPhase, suState, getLastMap, L } = await freshSuGuesser();
        suState.shape = TRIANGLE;
        initGuesserPhase('PANO_ID', 'Setter', false);
        expandGuessMap();
        getLastMap().fire('click', { latlng: L.latLng(51.3, 0.5) });
        expect(getLastMap()._layers.some((l) => l.kind === 'marker')).toBe(true);
        expect(document.getElementById('btn-su-submit-guess').disabled).toBe(false);
    });

    it('the first tap only expands the map — no marker placed', async () => {
        const { initGuesserPhase, suState, getLastMap, L } = await freshSuGuesser();
        suState.shape = TRIANGLE;
        initGuesserPhase('PANO_ID', 'Setter', false);
        // su-guess-map-container starts un-expanded.
        getLastMap().fire('click', { latlng: L.latLng(51.3, 0.5) });
        expect(getLastMap()._layers.some((l) => l.kind === 'marker')).toBe(false);
        expect(document.getElementById('su-guess-map-container').classList.contains('expanded')).toBe(true);
    });
});
