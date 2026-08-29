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
import { drawShapeOverlay, guardClick, fitMapToShape } from '../../js/map-overlay.js';
import { getShape, makeCustomShape } from '../../js/geo/shapes.js';

let L;
beforeEach(() => { L = installLeafletFake(); });

function fakeMap() {
    return L.map('guess-map', {});
}

describe('drawShapeOverlay', () => {
    it('draws the outline and mask for WORLD too — its bbox is lat:[-60,70], not the whole globe', () => {
        // An earlier version special-cased WORLD as a no-op, on the
        // mistaken assumption its bbox spanned the whole globe. It
        // doesn't (REGIONS.WORLD is lat:[-60,70]), and guardClick was
        // never given the same exemption — so a tap above 70N or below
        // 60S was silently refused with no outline ever shown for why.
        const map = fakeMap();
        const overlay = drawShapeOverlay(map, getShape('WORLD'));
        expect(overlay).not.toBeNull();
        const polygons = map._layers.filter((l) => l.kind === 'polygon');
        expect(polygons.length).toBe(2);
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
        const guarded = guardClick(() => TRIANGLE, (e) => { called = e; });
        const e = { latlng: L.latLng(51.3, 0.5) };
        guarded(e);
        expect(called).toBe(e);
    });

    it('drops a click outside the shape — the handler never runs', () => {
        let called = false;
        const guarded = guardClick(() => TRIANGLE, () => { called = true; });
        guarded({ latlng: L.latLng(0, 0) });
        expect(called).toBe(false);
    });

    it('takes a getter, not a fixed shape, so it tracks a shape that changes after the guard is created', () => {
        let shape = TRIANGLE;
        let called = false;
        const guarded = guardClick(() => shape, () => { called = true; });
        guarded({ latlng: L.latLng(0, 0) }); // outside the triangle
        expect(called).toBe(false);

        shape = getShape('WORLD'); // a later round switches to a region containing (0,0)
        guarded({ latlng: L.latLng(0, 0) });
        expect(called).toBe(true);
    });

    it('passes the click through when there is no current shape yet', () => {
        let called = false;
        const guarded = guardClick(() => null, () => { called = true; });
        guarded({ latlng: L.latLng(0, 0) });
        expect(called).toBe(true);
    });
});

describe('fitMapToShape', () => {
    it('fits the view to the shape bbox and bounds panning around it', () => {
        const map = L.map('guess-map', {});
        const shape = getShape('UK');
        fitMapToShape(map, shape);

        expect(map._fitBounds).toEqual([
            [shape.bbox.south, shape.bbox.west],
            [shape.bbox.north, shape.bbox.east],
        ]);
        expect(map._maxBounds).toBeDefined();
        const [[maxSouth, maxWest], [maxNorth, maxEast]] = map._maxBounds;
        // The max bounds are a real margin outside the shape, not the
        // shape's own bbox verbatim — otherwise "bounded" means "can't
        // move the map at all".
        expect(maxSouth).toBeLessThan(shape.bbox.south);
        expect(maxWest).toBeLessThan(shape.bbox.west);
        expect(maxNorth).toBeGreaterThan(shape.bbox.north);
        expect(maxEast).toBeGreaterThan(shape.bbox.east);
    });

    it('gives a small custom area a sensible margin too, not a fixed degree count', () => {
        const map = L.map('guess-map', {});
        const tiny = makeCustomShape([{ lat: 51.0, lng: 0.0 }, { lat: 51.01, lng: 0.0 }, { lat: 51.0, lng: 0.01 }]);
        fitMapToShape(map, tiny);
        const [[maxSouth], , ] = [map._maxBounds[0]];
        const margin = tiny.bbox.south - maxSouth;
        expect(margin).toBeGreaterThan(0);
        expect(margin).toBeLessThan(1); // proportional to the tiny shape, not a flat 1deg-plus pad
    });
});
