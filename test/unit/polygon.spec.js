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
import { unrollRing, normalisePointTo } from '../../js/geo/polygon.js';

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
