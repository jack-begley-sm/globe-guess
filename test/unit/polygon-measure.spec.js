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
import { densifyRing, diameterKm } from '../../js/geo/polygon-measure.js';
import { REGIONS } from '../../js/config.js';

const SQUARE = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }];

/** Raw (non-unrolled) bbox ring for a REGIONS entry, corners in bbox order. */
function bboxRing(region) {
    const [south, north] = region.lat;
    const [west, east] = region.lng;
    return [
        { lat: south, lng: west },
        { lat: south, lng: east },
        { lat: north, lng: east },
        { lat: north, lng: west },
    ];
}

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

describe('diameterKm', () => {
    it('is ~20015km for the WORLD region, not the ~14455km vertex-only figure', () => {
        const km = diameterKm(bboxRing(REGIONS.WORLD), 2);
        expect(km).toBeGreaterThan(19995);
        expect(km).toBeLessThan(20035);
    });

    it.each([
        ['UK', 1171],
        ['EUROPE', 6232],
        ['AMERICAS', 17305],
        ['AFRICA', 10783],
        ['ASIA', 13260],
        ['OCEANIA', 7684],
    ])('is ~%skm for the %s region (within 20km)', (name, expectedKm) => {
        const km = diameterKm(bboxRing(REGIONS[name]), 2);
        expect(Math.abs(km - expectedKm)).toBeLessThanOrEqual(20);
    });

    it('handles a two-vertex degenerate ring', () => {
        const ring = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
        const km = diameterKm(ring, 2);
        expect(km).toBeGreaterThan(1000);
        expect(km).toBeLessThan(1200);
    });

    it('never decreases when a vertex further out is added', () => {
        const before = diameterKm(SQUARE, 2);
        const withFarVertex = diameterKm([...SQUARE, { lat: 50, lng: 50 }], 2);
        expect(withFarVertex).toBeGreaterThanOrEqual(before);
    });

    it('computes a 24-vertex ring at 2deg densification in under 100ms', () => {
        const ring = Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * 2 * Math.PI;
            return { lat: Math.sin(angle) * 10, lng: Math.cos(angle) * 10 };
        });
        const start = performance.now();
        diameterKm(ring, 2);
        expect(performance.now() - start).toBeLessThan(100);
    });
});
