// ============================================================
// FILE: test/unit/results.spec.js
// PURPOSE: Unit test for js/results.js's new area-summary line (item
//          15, S09) — also guards against import breakage, since this
//          file previously had zero test coverage and silently kept a
//          stale `import ... from './map.js'` after showResultOnMap
//          moved to js/result-map.js (item 12) undetected until now.
//
// DEPENDENCIES:
//   - js/results.js
//   - js/geo/shapes.js (makeCustomShape)
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installLeafletFake } from '../support/fakes/leaflet.js';
import { makeCustomShape } from '../../js/geo/shapes.js';

function loadIndexBody() {
    const html = readFileSync('index.html', 'utf-8');
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    document.body.innerHTML = match[1];
}

async function freshResults() {
    installLeafletFake();
    loadIndexBody();
    vi.resetModules();
    const results = await import('../../js/results.js');
    const state = (await import('../../js/state.js')).state;
    return { ...results, state };
}

describe('renderResults', () => {
    it('imports cleanly and shows the area scale/cutoff line for the active shape', async () => {
        const { renderResults, state } = await freshResults();
        state.shape = makeCustomShape([{ lat: 51, lng: 0 }, { lat: 51.36, lng: 0 }, { lat: 51, lng: 0.36 }]);
        state.scores = [{ distanceKm: 10, totalScore: 3000, location: { lat: 51, lng: 0 }, guess: null }];

        renderResults();

        const summary = document.getElementById('results-area-summary').textContent;
        const scale = Math.round(state.shape.scaleKm);
        const cutoff = Math.round(state.shape.scaleKm * 0.45);
        expect(summary).toBe(`Area: ${scale} km across — anything over ${cutoff} km scored zero`);
    });

    it('shows the correct total score alongside the area summary', async () => {
        const { renderResults, state } = await freshResults();
        state.shape = makeCustomShape([{ lat: 51, lng: 0 }, { lat: 51.36, lng: 0 }, { lat: 51, lng: 0.36 }]);
        state.scores = [
            { distanceKm: 10, totalScore: 3000, location: { lat: 51, lng: 0 }, guess: null },
            { distanceKm: 20, totalScore: 1500, location: { lat: 51, lng: 0 }, guess: null },
        ];

        renderResults();

        expect(document.getElementById('final-total-score').textContent).toBe((3000 + 1500).toLocaleString());
    });
});
