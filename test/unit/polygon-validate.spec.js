// ============================================================
// FILE: test/unit/polygon-validate.spec.js
// PURPOSE: Unit tests for js/geo/polygon-validate.js — ring simplicity
//          contracts from .docs/custom-maps/02-geometry-contracts.md.
//
// DEPENDENCIES:
//   - js/geo/polygon-validate.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { ringIsSimple, pathIsSimple } from '../../js/geo/polygon-validate.js';
import { unrollRing } from '../../js/geo/polygon.js';

const SQUARE = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }];

describe('ringIsSimple', () => {
    it('is true for a square', () => {
        expect(ringIsSimple(SQUARE)).toBe(true);
    });

    it('is false for a figure-eight (bowtie) quadrilateral', () => {
        const bowtie = [{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }, { lat: 0, lng: 10 }];
        expect(ringIsSimple(bowtie)).toBe(false);
    });

    it('does not treat adjacent edges sharing a vertex as an intersection', () => {
        // A sharp concave notch — adjacent edges meet at a shared vertex
        // at a steep angle, which must not be flagged as a crossing.
        const notched = [
            { lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 },
            { lat: 5, lng: 5 }, { lat: 10, lng: 0 }
        ];
        expect(ringIsSimple(notched)).toBe(true);
    });

    it('is false when two non-adjacent vertices share a coordinate', () => {
        const duplicate = [{ lat: 0, lng: 0 }, { lat: 5, lng: 5 }, { lat: 10, lng: 0 }, { lat: 5, lng: 5 }];
        expect(ringIsSimple(duplicate)).toBe(false);
    });

    it('is true for three collinear points', () => {
        expect(ringIsSimple([{ lat: 0, lng: 0 }, { lat: 0, lng: 5 }, { lat: 0, lng: 10 }])).toBe(true);
    });

    it('is false when two non-adjacent edges overlap collinearly', () => {
        const overlapping = [
            { lat: 0, lng: 0 }, { lat: 0, lng: 10 },
            { lat: 5, lng: 5 }, { lat: 0, lng: 8 }, { lat: 0, lng: -2 }
        ];
        expect(ringIsSimple(overlapping)).toBe(false);
    });

    it('is false for a T-junction where one edge touches the interior of a non-adjacent edge', () => {
        const tJunction = [
            { lat: 10, lng: 10 }, { lat: 0, lng: 5 },
            { lat: -5, lng: 5 }, { lat: 5, lng: 5 }
        ];
        expect(ringIsSimple(tJunction)).toBe(false);
    });

    it('is true for rings with fewer than 3 vertices', () => {
        expect(ringIsSimple([])).toBe(true);
        expect(ringIsSimple([{ lat: 0, lng: 0 }])).toBe(true);
        expect(ringIsSimple([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])).toBe(true);
    });

    it('requires the unrolled frame — a raw antimeridian-crossing ring gives the wrong answer', () => {
        // Edge 0 (170 -> -170) and edge 2 (175 -> -175) genuinely cross at
        // lng 175 once unrolled; in the raw (wrapped) frame they don't
        // appear to, because -170 and -175 read as far from 170/175.
        const raw = [{ lat: 0, lng: 170 }, { lat: 0, lng: -170 }, { lat: 10, lng: 175 }, { lat: -10, lng: 175 }];
        expect(ringIsSimple(raw)).toBe(true); // wrong answer on raw input — documents the trap
        expect(ringIsSimple(unrollRing(raw))).toBe(false); // correct once unrolled
    });
});

describe('pathIsSimple', () => {
    it('is true for a simple open path', () => {
        expect(pathIsSimple(SQUARE)).toBe(true);
    });

    it('does not check the closing edge — true for a path whose CLOSED ring would cross', () => {
        // A-B-C-D as an open path never crosses; closing D back to A adds
        // the ring's other diagonal, which crosses edge B-C. This is the
        // exact case S05-draft-model.md warns about: checking the open
        // path must not treat the not-yet-existing closing edge as real.
        const path = [{ lat: 0, lng: 0 }, { lat: 10, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }];
        expect(pathIsSimple(path)).toBe(true);
        expect(ringIsSimple(path)).toBe(false);
    });

    it('is false when two non-adjacent points share a coordinate', () => {
        const duplicate = [{ lat: 0, lng: 0 }, { lat: 5, lng: 5 }, { lat: 10, lng: 0 }, { lat: 5, lng: 5 }];
        expect(pathIsSimple(duplicate)).toBe(false);
    });

    it('is false when two non-adjacent edges of the open path cross', () => {
        // 0N,0E -> 10N,10E -> 0N,10E -> 10N,0E: edge 0 and edge 2 cross at (5,5).
        const path = [{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }, { lat: 0, lng: 10 }, { lat: 10, lng: 0 }];
        expect(pathIsSimple(path)).toBe(false);
    });

    it('is true for paths with fewer than 3 points', () => {
        expect(pathIsSimple([])).toBe(true);
        expect(pathIsSimple([{ lat: 0, lng: 0 }])).toBe(true);
        expect(pathIsSimple([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])).toBe(true);
    });

    it('is true for exactly 3 points — only one edge pair exists and they are always adjacent', () => {
        expect(pathIsSimple([{ lat: 0, lng: 0 }, { lat: 5, lng: 5 }, { lat: 10, lng: 0 }])).toBe(true);
    });
});
