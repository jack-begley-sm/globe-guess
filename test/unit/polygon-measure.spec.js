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
import { densifyRing, diameterKm, randomPointInShape, areaKm2 } from '../../js/geo/polygon-measure.js';
import { unrollRing, ringBbox, containsPoint } from '../../js/geo/polygon.js';
import { REGIONS, CUSTOM_MAP } from '../../js/config.js';
import { createRng } from '../support/rng.js';

function shapeFromRing(ring) {
    const unrolled = unrollRing(ring);
    return { ring: unrolled, bbox: ringBbox(unrolled) };
}

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
        const occurrences = out.filter((p) => p.lat === SQUARE[0].lat && p.lng === SQUARE[0].lng).length;
        expect(occurrences).toBe(1);
    });

    it('throws for a non-positive stepDeg instead of looping forever', () => {
        expect(() => densifyRing(SQUARE, 0)).toThrow();
        expect(() => densifyRing(SQUARE, -1)).toThrow();
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
        // Deliberately the RAW bbox ring, NOT passed through unrollRing:
        // WORLD's lng span is exactly 360 degrees, which unrollRing
        // collapses to a degenerate zero-width ring (every vertex lands
        // on the same meridian) — see 01-scoring-model.md's own worked
        // example, which treats -180 and 180 as distinct boundary points.
        // Item 14 (js/geo/shapes.js) MUST NOT call unrollRing on WORLD's
        // ring for this reason; other built-in regions don't cross the
        // antimeridian so this doesn't apply to them.
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
    ])('the %s region has scale ~%skm (within 20km)', (name, expectedKm) => {
        const km = diameterKm(bboxRing(REGIONS[name]), 2);
        expect(Math.abs(km - expectedKm)).toBeLessThanOrEqual(20);
    });

    it('handles a two-vertex degenerate ring as the exact distance between them', () => {
        const ring = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }];
        expect(diameterKm(ring, 2)).toBeCloseTo(1111.95, 1);
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

describe('randomPointInShape', () => {
    const square = shapeFromRing(SQUARE);

    it('returns only points that satisfy containsPoint (1000 draws)', () => {
        const rng = createRng(42);
        for (let i = 0; i < 1000; i++) {
            const point = randomPointInShape(square, rng);
            expect(point).not.toBeNull();
            expect(containsPoint(point, square)).toBe(true);
        }
    });

    it('succeeds on the first attempt for a square with a fixed rng', () => {
        let calls = 0;
        const rng = () => { calls++; return 0.5; };
        const point = randomPointInShape(square, rng);
        expect(point).toEqual({ lat: 5, lng: 5 });
        expect(calls).toBe(2);
    });

    it('returns null for a pathologically thin sliver after exhausting the attempt budget', () => {
        // A near-zero-width diagonal sliver: at lat=5 it spans lng
        // [5, 5.00000005] — every sample below lands outside it every time.
        const sliver = shapeFromRing([
            { lat: 0, lng: 0 },
            { lat: 10, lng: 10.0000001 },
            { lat: 10, lng: 10 },
        ]);
        let calls = 0;
        const seq = [0.5, 0.01]; // -> point (5, 0.1), well clear of the sliver
        const rng = () => { const v = seq[calls % 2]; calls++; return v; };
        const point = randomPointInShape(sliver, rng);
        expect(point).toBeNull();
        expect(calls).toBe(CUSTOM_MAP.SAMPLE_ATTEMPTS * 2);
    });
});

describe('areaKm2', () => {
    it('is ~700000km2 for the UK bbox (within 10%)', () => {
        const km2 = areaKm2(bboxRing(REGIONS.UK));
        expect(Math.abs(km2 - 700000)).toBeLessThanOrEqual(70000);
    });

    it('is 0 for a degenerate (fewer than 3 vertex) ring', () => {
        expect(areaKm2([])).toBe(0);
        expect(areaKm2([{ lat: 0, lng: 0 }])).toBe(0);
        expect(areaKm2([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])).toBe(0);
    });
});
