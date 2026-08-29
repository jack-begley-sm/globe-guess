// ============================================================
// FILE: test/unit/map.spec.js
// PURPOSE: Unit tests for js/map.js's shape-aware resetMap/placeMarker
//          — the Classic guess map's wiring into js/map-overlay.js.
//          See .docs/custom-maps/05-conceptualization/S08-constrained-guessing.md.
//
// DEPENDENCIES:
//   - js/map.js
//   - js/geo/shapes.js (getShape, makeCustomShape)
//   - test/support/fakes/leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installLeafletFakeCapturingMap } from '../support/fakes/leaflet.js';
import { getShape, makeCustomShape } from '../../js/geo/shapes.js';

function loadIndexBody() {
    const html = readFileSync('index.html', 'utf-8');
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    document.body.innerHTML = match[1];
}

const TRIANGLE = makeCustomShape([{ lat: 51, lng: 0 }, { lat: 52, lng: 1 }, { lat: 51, lng: 1 }]);

/** map.js keeps module-level map/marker/shape state — each test needs a
 *  fresh module bound to its own DOM and fake map instance. */
async function freshMap() {
    const { L, getLastMap } = installLeafletFakeCapturingMap();
    loadIndexBody();
    vi.resetModules();
    const mod = await import('../../js/map.js');
    mod.initMap();
    return { ...mod, L, getLastMap };
}

function expandWidget() {
    document.getElementById('guess-map-widget').classList.remove('collapsed');
    document.getElementById('guess-map-widget').classList.add('expanded');
}

describe('resetMap(shape)', () => {
    it('draws the shape overlay via map-overlay.js for a non-WORLD shape', async () => {
        const { resetMap, getLastMap } = await freshMap();
        resetMap(TRIANGLE);
        const polygons = getLastMap()._layers.filter((l) => l.kind === 'polygon');
        expect(polygons.length).toBe(2); // outline + mask
    });

    it('draws the overlay for WORLD too, not just custom/other built-in shapes', async () => {
        // WORLD's bbox (lat:[-60,70]) isn't the whole globe, so it needs
        // the same outline/mask as any other shape — see map-overlay.js.
        const { resetMap, getLastMap } = await freshMap();
        resetMap(getShape('WORLD'));
        const polygons = getLastMap()._layers.filter((l) => l.kind === 'polygon');
        expect(polygons.length).toBe(2);
    });

    it('replaces the previous overlay rather than stacking them across rounds', async () => {
        const { resetMap, getLastMap } = await freshMap();
        resetMap(getShape('UK'));
        resetMap(TRIANGLE);
        const polygons = getLastMap()._layers.filter((l) => l.kind === 'polygon');
        expect(polygons.length).toBe(2); // UK's pair was removed, not left behind
    });
});

describe('placeMarker (via a guess-map click)', () => {
    it('places nothing and leaves the submit button disabled for a tap outside the shape', async () => {
        const { resetMap, getLastMap, L } = await freshMap();
        resetMap(TRIANGLE);
        expandWidget();
        getLastMap().fire('click', { latlng: L.latLng(0, 0) }); // well outside the triangle
        expect(getLastMap()._layers.some((l) => l.kind === 'marker')).toBe(false);
        expect(document.getElementById('btn-submit-guess').disabled).toBe(true);
    });

    it('places a marker and enables submit for a tap inside the shape', async () => {
        const { resetMap, getLastMap, L } = await freshMap();
        resetMap(TRIANGLE);
        expandWidget();
        getLastMap().fire('click', { latlng: L.latLng(51.3, 0.5) });
        expect(getLastMap()._layers.some((l) => l.kind === 'marker')).toBe(true);
        expect(document.getElementById('btn-submit-guess').disabled).toBe(false);
    });

    it('a later outside tap keeps the existing valid guess rather than clearing it', async () => {
        const { resetMap, getLastMap, L } = await freshMap();
        resetMap(TRIANGLE);
        expandWidget();
        getLastMap().fire('click', { latlng: L.latLng(51.3, 0.5) }); // valid guess
        getLastMap().fire('click', { latlng: L.latLng(0, 0) }); // stray outside tap
        expect(getLastMap()._layers.filter((l) => l.kind === 'marker').length).toBe(1);
        expect(document.getElementById('btn-submit-guess').disabled).toBe(false);
    });

    it('the first tap on a collapsed widget only expands it — no marker placed', async () => {
        const { resetMap, getLastMap, L } = await freshMap();
        resetMap(TRIANGLE);
        // guess-map-widget starts collapsed by default in index.html.
        getLastMap().fire('click', { latlng: L.latLng(51.3, 0.5) });
        expect(getLastMap()._layers.some((l) => l.kind === 'marker')).toBe(false);
        expect(document.getElementById('guess-map-widget').classList.contains('expanded')).toBe(true);
    });
});
