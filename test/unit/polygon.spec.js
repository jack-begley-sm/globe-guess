// ============================================================
// FILE: test/unit/polygon.spec.js
// PURPOSE: Unit tests for js/geo/polygon.js — pure geometry contracts
//          from .docs/custom-maps/02-geometry-contracts.md.
//
// DEPENDENCIES:
//   - js/geo/polygon.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { unrollRing, normalisePointTo, pointInRing } from '../../js/geo/polygon.js';

const SQUARE = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }];
const DIAMOND = [{ lat: 10, lng: 5 }, { lat: 5, lng: 10 }, { lat: 0, lng: 5 }, { lat: 5, lng: 0 }];
const L_SHAPE = [
    { lat: 0, lng: 0 }, { lat: 10, lng: 0 }, { lat: 10, lng: 4 },
    { lat: 4, lng: 4 }, { lat: 4, lng: 10 }, { lat: 0, lng: 10 }
];

describe('unrollRing', () => {
    it('returns a copy, unchanged, for an empty ring', () => {
        expect(unrollRing([])).toEqual([]);
    });

    it('returns a copy, unchanged, for a single-point ring', () => {
        const ring = [{ lat: 10, lng: 20 }];
        expect(unrollRing(ring)).toEqual(ring);
    });

    it('never leaves consecutive vertices more than 180 deg apart in longitude', () => {
        const ring = [{ lat: 0, lng: 178 }, { lat: 0, lng: -179 }];
        const out = unrollRing(ring);
        for (let i = 1; i < out.length; i++) {
            expect(Math.abs(out[i].lng - out[i - 1].lng)).toBeLessThanOrEqual(180);
        }
    });

    it('unrolls -179 following 178 to 181', () => {
        const ring = [{ lat: 0, lng: 178 }, { lat: 0, lng: -179 }];
        const out = unrollRing(ring);
        expect(out[0]).toEqual({ lat: 0, lng: 178 });
        expect(out[1]).toEqual({ lat: 0, lng: 181 });
    });

    it('is idempotent', () => {
        const ring = [{ lat: 0, lng: 178 }, { lat: 0, lng: -179 }, { lat: 5, lng: -177 }];
        const once = unrollRing(ring);
        const twice = unrollRing(once);
        expect(twice).toEqual(once);
    });

    it('does not mutate the input', () => {
        const ring = [{ lat: 0, lng: 178 }, { lat: 0, lng: -179 }];
        const snapshot = JSON.parse(JSON.stringify(ring));
        unrollRing(ring);
        expect(ring).toEqual(snapshot);
    });
});

describe('normalisePointTo', () => {
    it('moves a -179 point to the 181-side representation against a ring centred on 181', () => {
        const ring = [{ lat: 0, lng: 178 }, { lat: 0, lng: 181 }, { lat: 5, lng: 183 }];
        const out = normalisePointTo({ lat: 0, lng: -179 }, ring);
        expect(out.lng).toBeCloseTo(181, 6);
    });

    it('resolves a 380 degree Leaflet over-pan point against a ring centred on 20', () => {
        const ring = [{ lat: 0, lng: 10 }, { lat: 0, lng: 30 }, { lat: 10, lng: 20 }];
        const out = normalisePointTo({ lat: 0, lng: 380 }, ring);
        expect(out.lng).toBeCloseTo(20, 6);
    });

    it('passes latitude through untouched', () => {
        const ring = [{ lat: 0, lng: 10 }, { lat: 0, lng: 30 }];
        const out = normalisePointTo({ lat: 42.5, lng: 380 }, ring);
        expect(out.lat).toBe(42.5);
    });
});

describe('pointInRing', () => {
    it('is true for a point clearly inside a simple square', () => {
        expect(pointInRing({ lat: 5, lng: 5 }, SQUARE)).toBe(true);
    });

    it('is false for a point clearly outside', () => {
        expect(pointInRing({ lat: 20, lng: 20 }, SQUARE)).toBe(false);
    });

    it('is false for a ring with fewer than 3 vertices', () => {
        expect(pointInRing({ lat: 5, lng: 5 }, [])).toBe(false);
        expect(pointInRing({ lat: 5, lng: 5 }, [{ lat: 0, lng: 0 }])).toBe(false);
        expect(pointInRing({ lat: 5, lng: 5 }, [{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }])).toBe(false);
    });

    it('is true for a point exactly on a vertex', () => {
        expect(pointInRing({ lat: 0, lng: 0 }, SQUARE)).toBe(true);
    });

    it('is true for a point exactly on an edge', () => {
        expect(pointInRing({ lat: 0, lng: 5 }, SQUARE)).toBe(true);
    });

    it('does not double-count a ray passing exactly through a vertex', () => {
        // The scanline through the diamond's centre passes exactly through
        // its left and right vertices (both at lat 5) without touching them.
        expect(pointInRing({ lat: 5, lng: 5 }, DIAMOND)).toBe(true);
        expect(pointInRing({ lat: 5, lng: -1 }, DIAMOND)).toBe(false);
        expect(pointInRing({ lat: 5, lng: 11 }, DIAMOND)).toBe(false);
    });

    it('is false for a point in the bite of a concave L-shape', () => {
        expect(pointInRing({ lat: 8, lng: 8 }, L_SHAPE)).toBe(false);
        expect(pointInRing({ lat: 8, lng: 2 }, L_SHAPE)).toBe(true);
    });

    it('gives the same answer regardless of winding order', () => {
        const reversed = [...SQUARE].reverse();
        expect(pointInRing({ lat: 5, lng: 5 }, reversed)).toBe(true);
        expect(pointInRing({ lat: 20, lng: 20 }, reversed)).toBe(false);
    });
});
