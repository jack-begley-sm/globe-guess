// ============================================================
// FILE: test/unit/polygon-measure.spec.js
// PURPOSE: Unit tests for js/geo/polygon-measure.js — ring
//          measurement contracts from
//          .docs/custom-maps/02-geometry-contracts.md.
//
// DEPENDENCIES:
//   - js/geo/polygon-measure.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { densifyRing } from '../../js/geo/polygon-measure.js';

const SQUARE = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }];

describe('densifyRing', () => {
    it('returns at least as many points as the input', () => {
        expect(densifyRing(SQUARE, 2).length).toBeGreaterThanOrEqual(SQUARE.length);
    });

    it('includes every input vertex', () => {
        const out = densifyRing(SQUARE, 2);
        for (const v of SQUARE) {
            expect(out).toContainEqual(v);
        }
    });

    it('returns exactly the input vertices when every edge is shorter than stepDeg', () => {
        expect(densifyRing(SQUARE, 20)).toEqual(SQUARE);
    });

    it('densifies the closing edge (last vertex back to first)', () => {
        // Every edge of SQUARE is 10 deg; step 3 deg needs ceil(10/3)=4
        // segments per edge, so 3 interior points per edge including closing.
        const out = densifyRing(SQUARE, 3);
        expect(out.length).toBe(SQUARE.length * 4);
    });

    it('never returns the closing duplicate (a copy of the first vertex at the end)', () => {
        const out = densifyRing(SQUARE, 3);
        const last = out[out.length - 1];
        expect(last).not.toEqual(SQUARE[0]);
    });

    it('handles a two-vertex degenerate ring by densifying both traversal directions', () => {
        const ring = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
        const out = densifyRing(ring, 3);
        expect(out).toContainEqual(ring[0]);
        expect(out).toContainEqual(ring[1]);
        expect(out.length).toBeGreaterThan(ring.length);
    });
});
