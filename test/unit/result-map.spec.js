// ============================================================
// FILE: test/unit/result-map.spec.js
// PURPOSE: Unit tests for js/result-map.js's shape outline (review
//          finding I6 — S08's own "watch out for" flagged the result
//          map as the one place a player sees their miss in context,
//          so it should show the play area boundary too).
//
// DEPENDENCIES:
//   - js/result-map.js
//   - js/geo/shapes.js (makeCustomShape)
//   - test/support/fakes/leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect, vi } from 'vitest';
import { installLeafletFakeCapturingMap } from '../support/fakes/leaflet.js';
import { makeCustomShape } from '../../js/geo/shapes.js';

async function freshResultMap() {
    const { L, getLastMap } = installLeafletFakeCapturingMap();
    document.body.innerHTML = '<div id="result-mini-map"></div>';
    vi.resetModules();
    const { showResultOnMap } = await import('../../js/result-map.js');
    const state = (await import('../../js/state.js')).state;
    return { showResultOnMap, state, L, getLastMap };
}

describe('showResultOnMap', () => {
    it('draws the play area outline alongside the actual/guess markers', async () => {
        const { showResultOnMap, state, getLastMap } = await freshResultMap();
        state.shape = makeCustomShape([{ lat: 51, lng: 0 }, { lat: 51.36, lng: 0 }, { lat: 51, lng: 0.36 }]);

        showResultOnMap({ lat: 51.1, lng: 0.1 }, 'result-mini-map', { lat: 51.2, lng: 0.2 });

        const polygons = getLastMap()._layers.filter((l) => l.kind === 'polygon');
        expect(polygons.length).toBe(1);
    });

    it('does not throw and draws no outline when there is no active shape', async () => {
        const { showResultOnMap, state, getLastMap } = await freshResultMap();
        state.shape = null;

        expect(() => showResultOnMap({ lat: 51.1, lng: 0.1 }, 'result-mini-map')).not.toThrow();
        const polygons = getLastMap()._layers.filter((l) => l.kind === 'polygon');
        expect(polygons.length).toBe(0);
    });
});
