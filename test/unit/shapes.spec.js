// ============================================================
// FILE: test/unit/shapes.spec.js
// PURPOSE: Unit tests for js/geo/shapes.js — Shape construction and
//          memoisation contracts from
//          .docs/custom-maps/02-geometry-contracts.md.
//
// DEPENDENCIES:
//   - js/geo/shapes.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { getShape, makeCustomShape } from '../../js/geo/shapes.js';
import { REGIONS, REGION_LABELS } from '../../js/config.js';

describe('getShape', () => {
    it('returns the identical object on repeat calls (memoised)', () => {
        expect(getShape('UK')).toBe(getShape('UK'));
    });

    it('matches the reference table for WORLD', () => {
        const shape = getShape('WORLD');
        expect(shape.id).toBe('WORLD');
        expect(shape.label).toBe('World');
        expect(Math.abs(shape.scaleKm - 20015)).toBeLessThanOrEqual(20);
    });

    it('matches the reference table for UK', () => {
        const shape = getShape('UK');
        expect(Math.abs(shape.scaleKm - 1171)).toBeLessThanOrEqual(20);
    });

    it('throws for an unknown region id', () => {
        expect(() => getShape('MOON')).toThrow();
    });

    it('throws for an inherited-but-not-own property name (prototype pollution guard)', () => {
        expect(() => getShape('constructor')).toThrow();
        expect(() => getShape('toString')).toThrow();
    });

    it('is immutable — mutating the returned shape or its ring throws', () => {
        const shape = getShape('UK');
        expect(() => { shape.scaleKm = 1; }).toThrow();
        expect(() => { shape.ring[0].lat = 999; }).toThrow();
    });

    it('has a label for every region (REGION_LABELS cannot silently drift from REGIONS)', () => {
        expect(Object.keys(REGION_LABELS).sort()).toEqual(Object.keys(REGIONS).sort());
    });
});

describe('makeCustomShape', () => {
    const SQUARE = [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }];

    it('produces a CUSTOM shape with computed bbox and scale', () => {
        const shape = makeCustomShape(SQUARE);
        expect(shape.id).toBe('CUSTOM');
        expect(shape.bbox).toEqual({ south: 0, north: 10, west: 0, east: 10 });
        expect(shape.scaleKm).toBeGreaterThan(0);
    });

    it('throws for fewer than 3 vertices', () => {
        expect(() => makeCustomShape([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])).toThrow();
    });

    it('throws for a self-crossing ring', () => {
        const bowtie = [{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }, { lat: 10, lng: 0 }, { lat: 0, lng: 10 }];
        expect(() => makeCustomShape(bowtie)).toThrow();
    });

    it('throws for a ring spanning 360 degrees or more once unrolled', () => {
        const wrapped = [{ lat: 0, lng: -180 }, { lat: 0, lng: 180 }, { lat: 10, lng: 0 }];
        expect(() => makeCustomShape(wrapped)).toThrow();
    });

    it('unrolls a ring drawn across the antimeridian instead of rejecting it', () => {
        const acrossDateLine = [{ lat: 0, lng: 178 }, { lat: 0, lng: -179 }, { lat: 10, lng: -179 }, { lat: 10, lng: 178 }];
        const shape = makeCustomShape(acrossDateLine);
        expect(shape.bbox.east).toBeGreaterThan(180);
        expect(shape.scaleKm).toBeGreaterThan(0);
    });

    it('is immutable — mutating the returned shape or its ring throws', () => {
        const shape = makeCustomShape(SQUARE);
        expect(() => { shape.scaleKm = 1; }).toThrow();
        expect(() => { shape.ring[0].lat = 999; }).toThrow();
    });
});
