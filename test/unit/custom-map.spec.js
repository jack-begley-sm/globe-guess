// ============================================================
// FILE: test/unit/custom-map.spec.js
// PURPOSE: Unit tests for js/custom-map.js — the Leaflet adapter for
//          the Custom-mode draw screen, against the Leaflet fake. See
//          .docs/custom-maps/05-conceptualization/S06-draw-screen.md.
//
// DEPENDENCIES:
//   - js/custom-map.js
//   - js/custom-draft.js (createDraft)
//   - test/support/fakes/leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { installLeafletFake } from '../support/fakes/leaflet.js';
import { initCustomMap } from '../../js/custom-map.js';
import { createDraft } from '../../js/custom-draft.js';

let L;
beforeEach(() => { L = installLeafletFake(); });

describe('initCustomMap', () => {
    it('creates a map on the given container', () => {
        const { map } = initCustomMap('custom-map', createDraft());
        expect(map.container).toBe('custom-map');
    });

    it('forwards a click to the draft as a new point', () => {
        const draft = createDraft();
        const { map } = initCustomMap('custom-map', draft);
        map.fire('click', { latlng: L.latLng(51, 0) });
        expect(draft.points).toEqual([{ lat: 51, lng: 0 }]);
    });

    it('draws a vertex marker per point after each click', () => {
        const draft = createDraft();
        const { map } = initCustomMap('custom-map', draft);
        map.fire('click', { latlng: L.latLng(51, 0) });
        map.fire('click', { latlng: L.latLng(52, 1) });
        const markers = map._layers.filter((l) => l.kind === 'circleMarker');
        expect(markers.length).toBe(2);
    });

    it('draws the ring outline once there are at least 2 points', () => {
        const draft = createDraft();
        const { map } = initCustomMap('custom-map', draft);
        map.fire('click', { latlng: L.latLng(51, 0) });
        expect(map._layers.filter((l) => l.kind === 'polygon').length).toBe(0);
        map.fire('click', { latlng: L.latLng(52, 1) });
        expect(map._layers.filter((l) => l.kind === 'polygon').length).toBe(1);
    });

    it('draws the world-with-a-hole mask once there are at least 3 points', () => {
        const draft = createDraft();
        const { map } = initCustomMap('custom-map', draft);
        map.fire('click', { latlng: L.latLng(51, 0) });
        map.fire('click', { latlng: L.latLng(52, 1) });
        // 2 points: ring polygon only, no mask yet — 1 polygon total.
        expect(map._layers.filter((l) => l.kind === 'polygon').length).toBe(1);
        map.fire('click', { latlng: L.latLng(51, 1) });
        // 3 points: ring polygon + mask polygon — 2 polygons total.
        expect(map._layers.filter((l) => l.kind === 'polygon').length).toBe(2);
    });

    it('a rejected click does not add a point, but redraw still runs harmlessly', () => {
        const draft = createDraft();
        const { map } = initCustomMap('custom-map', draft);
        for (let i = 0; i < 24; i++) {
            map.fire('click', { latlng: L.latLng(0, i * 0.01) });
        }
        expect(draft.points.length).toBe(24);
        map.fire('click', { latlng: L.latLng(0, 1) }); // 25th, TOO_MANY
        expect(draft.points.length).toBe(24);
        expect(map._layers.filter((l) => l.kind === 'circleMarker').length).toBe(24);
    });

    it('reports each addPoint result via the optional onAddPointResult callback', () => {
        const draft = createDraft();
        const results = [];
        const { map } = initCustomMap('custom-map', draft, {
            onAddPointResult: (r) => results.push(r),
        });
        map.fire('click', { latlng: L.latLng(0, 0) });
        map.fire('click', { latlng: L.latLng(10, 10) });
        map.fire('click', { latlng: L.latLng(0, 10) });
        map.fire('click', { latlng: L.latLng(10, 0) }); // self-crossing
        expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
        expect(results[3].reason).toBe('SELF_CROSSING');
    });

    it('redraw() reflects undo — calling draft.undo() then redraw() removes the last marker', () => {
        const draft = createDraft();
        const { map, redraw } = initCustomMap('custom-map', draft);
        map.fire('click', { latlng: L.latLng(51, 0) });
        map.fire('click', { latlng: L.latLng(52, 1) });
        draft.undo();
        redraw();
        expect(map._layers.filter((l) => l.kind === 'circleMarker').length).toBe(1);
    });
});
