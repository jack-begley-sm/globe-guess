// ============================================================
// FILE: test/unit/map-overlay.spec.js
// PURPOSE: Unit tests for js/map-overlay.js against the Leaflet fake.
//          See .docs/custom-maps/05-conceptualization/S08-constrained-guessing.md.
//
// DEPENDENCIES:
//   - js/map-overlay.js
//   - js/geo/shapes.js (getShape, makeCustomShape)
//   - test/support/fakes/leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { installLeafletFake } from '../support/fakes/leaflet.js';
import { drawShapeOverlay, guardClick } from '../../js/map-overlay.js';
import { getShape, makeCustomShape } from '../../js/geo/shapes.js';

let L;
beforeEach(() => { L = installLeafletFake(); });

function fakeMap() {
    return L.map('guess-map', {});
}

describe('drawShapeOverlay', () => {
    it('is a no-op for WORLD — no layers added, returns null', () => {
        const map = fakeMap();
        const overlay = drawShapeOverlay(map, getShape('WORLD'));
        expect(overlay).toBeNull();
        expect(map._layers.length).toBe(0);
    });

    it('draws an outline and a world-with-a-hole mask for a non-WORLD shape', () => {
        const map = fakeMap();
        drawShapeOverlay(map, getShape('UK'));
        const polygons = map._layers.filter((l) => l.kind === 'polygon');
        expect(polygons.length).toBe(2);
    });

    it('the mask polygon is [outerWorldRing, shapeRing] — outer winds opposite the inner', () => {
        const map = fakeMap();
        drawShapeOverlay(map, getShape('UK'));
        const mask = map._layers.find((l) => l.kind === 'polygon' && l.args[1]?.className === 'map-overlay-mask');
        expect(mask).toBeDefined();
        const [outer, inner] = mask.args[0];
        expect(outer.length).toBe(4); // world rectangle
        expect(inner.length).toBe(getShape('UK').ring.length);
    });

    it('remove() takes both layers back off the map', () => {
        const map = fakeMap();
        const overlay = drawShapeOverlay(map, getShape('UK'));
        expect(map._layers.length).toBe(2);
        overlay.remove();
        expect(map._layers.length).toBe(0);
    });
});

describe('guardClick', () => {
    const TRIANGLE = makeCustomShape([{ lat: 51, lng: 0 }, { lat: 52, lng: 1 }, { lat: 51, lng: 1 }]);

    it('calls the handler for a click inside the shape', () => {
        let called = null;
        const guarded = guardClick(TRIANGLE, (e) => { called = e; });
        const e = { latlng: L.latLng(51.3, 0.5) };
        guarded(e);
        expect(called).toBe(e);
    });

    it('drops a click outside the shape — the handler never runs', () => {
        let called = false;
        const guarded = guardClick(TRIANGLE, () => { called = true; });
        guarded({ latlng: L.latLng(0, 0) });
        expect(called).toBe(false);
    });
});
