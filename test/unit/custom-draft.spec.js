// ============================================================
// FILE: test/unit/custom-draft.spec.js
// PURPOSE: Unit tests for js/custom-draft.js — the drawing-rules model
//          from .docs/custom-maps/05-conceptualization/S05-draft-model.md.
//          This file covers item 1's happy path (addPoint/undo/clear);
//          rejection codes land in item 2, status()/close() in item 3.
//
// DEPENDENCIES:
//   - js/custom-draft.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { createDraft } from '../../js/custom-draft.js';
import { createRng } from '../support/rng.js';

const TRIANGLE = [{ lat: 51, lng: 0 }, { lat: 52, lng: 1 }, { lat: 51, lng: 1 }];

describe('createDraft', () => {
    it('starts with no points', () => {
        expect(createDraft().points).toEqual([]);
    });

    it('addPoint succeeds on the happy path and appends the point', () => {
        const draft = createDraft();
        const result = draft.addPoint({ lat: 51, lng: 0 });
        expect(result).toEqual({ ok: true });
        expect(draft.points).toEqual([{ lat: 51, lng: 0 }]);
    });

    it('accumulates points in tap order', () => {
        const draft = createDraft();
        draft.addPoint({ lat: 51, lng: 0 });
        draft.addPoint({ lat: 52, lng: 1 });
        draft.addPoint({ lat: 51, lng: 1 });
        expect(draft.points).toEqual([
            { lat: 51, lng: 0 }, { lat: 52, lng: 1 }, { lat: 51, lng: 1 },
        ]);
    });

    it('points is a readonly snapshot — mutating the returned array does not affect the draft', () => {
        const draft = createDraft();
        draft.addPoint({ lat: 51, lng: 0 });
        const snapshot = draft.points;
        snapshot.push({ lat: 99, lng: 99 });
        expect(draft.points).toEqual([{ lat: 51, lng: 0 }]);
    });

    it('undo removes the last point', () => {
        const draft = createDraft();
        draft.addPoint({ lat: 51, lng: 0 });
        draft.addPoint({ lat: 52, lng: 1 });
        draft.undo();
        expect(draft.points).toEqual([{ lat: 51, lng: 0 }]);
    });

    it('undo on an empty draft is a no-op, not a throw', () => {
        const draft = createDraft();
        expect(() => draft.undo()).not.toThrow();
        expect(draft.points).toEqual([]);
    });

    it('clear empties the draft', () => {
        const draft = createDraft();
        draft.addPoint({ lat: 51, lng: 0 });
        draft.addPoint({ lat: 52, lng: 1 });
        draft.clear();
        expect(draft.points).toEqual([]);
    });
});

describe('addPoint rejection codes', () => {
    it('rejects a 25th point as TOO_MANY once 24 are already placed', () => {
        const draft = createDraft();
        for (let i = 0; i < 24; i++) {
            const result = draft.addPoint({ lat: 0, lng: i * 0.01 });
            expect(result.ok).toBe(true);
        }
        const result = draft.addPoint({ lat: 0, lng: 1 });
        expect(result).toEqual({ ok: false, reason: 'TOO_MANY' });
        expect(draft.points.length).toBe(24);
    });

    it('rejects a tap that would make the open path cross itself, leaving points unchanged', () => {
        const draft = createDraft();
        draft.addPoint({ lat: 0, lng: 0 });
        draft.addPoint({ lat: 10, lng: 10 });
        draft.addPoint({ lat: 0, lng: 10 });
        const before = draft.points;
        const result = draft.addPoint({ lat: 10, lng: 0 }); // edge 0-1 crosses edge 2-3
        expect(result).toEqual({ ok: false, reason: 'SELF_CROSSING' });
        expect(draft.points).toEqual(before);
    });

    it('rejects a tap that would wind the shape all the way round the world', () => {
        const draft = createDraft();
        draft.addPoint({ lat: 0, lng: 0 });
        draft.addPoint({ lat: 0, lng: 170 });
        draft.addPoint({ lat: 0, lng: -20 });
        const before = draft.points;
        const result = draft.addPoint({ lat: 10, lng: 0 });
        expect(result).toEqual({ ok: false, reason: 'WOUND_ROUND_WORLD' });
        expect(draft.points).toEqual(before);
    });
});

describe('status', () => {
    it('cannot close with fewer than 3 points (TOO_FEW)', () => {
        const draft = createDraft();
        draft.addPoint({ lat: 51, lng: 0 });
        draft.addPoint({ lat: 52, lng: 1 });
        expect(draft.status()).toEqual({ canClose: false, reason: 'TOO_FEW', vertexCount: 2 });
    });

    it('cannot close an area smaller than MIN_AREA_KM2 (TOO_SMALL)', () => {
        const draft = createDraft();
        // Three points within ~50m of each other — well under 25km2.
        draft.addPoint({ lat: 51.0000, lng: 0.0000 });
        draft.addPoint({ lat: 51.0004, lng: 0.0000 });
        draft.addPoint({ lat: 51.0000, lng: 0.0004 });
        const status = draft.status();
        expect(status.canClose).toBe(false);
        expect(status.reason).toBe('TOO_SMALL');
        expect(status.vertexCount).toBe(3);
    });

    it('can close a normal triangle with vertexCount and no reason', () => {
        const draft = createDraft();
        TRIANGLE.forEach((p) => draft.addPoint(p));
        expect(draft.status()).toEqual({ canClose: true, vertexCount: 3 });
    });

    it('cannot close a ring whose only self-crossing is via the closing edge (SELF_CROSSING)', () => {
        // A spiral: every individual tap is accepted (the OPEN path never
        // crosses itself), but closing it — the edge from the last point
        // back to the first — crosses an earlier edge. addPoint's own
        // pathIsSimple check cannot see this; only a closed-ring check
        // (ringIsSimple) run in status() can.
        const draft = createDraft();
        const spiral = [
            { lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 },
            { lat: 1, lng: -1 }, { lat: -1, lng: -1 }, { lat: -1, lng: 2 }, { lat: 3, lng: 2 },
        ];
        for (const p of spiral) {
            expect(draft.addPoint(p)).toEqual({ ok: true });
        }
        const status = draft.status();
        expect(status.canClose).toBe(false);
        expect(status.reason).toBe('SELF_CROSSING');
    });
});

describe('close', () => {
    it('throws when the draft cannot be closed', () => {
        const draft = createDraft();
        draft.addPoint({ lat: 51, lng: 0 });
        expect(() => draft.close()).toThrow();
    });

    it('produces a CUSTOM shape with a computed bbox and scale, for a valid draft', () => {
        const draft = createDraft();
        TRIANGLE.forEach((p) => draft.addPoint(p));
        const shape = draft.close();
        expect(shape.id).toBe('CUSTOM');
        expect(shape.scaleKm).toBeGreaterThan(0);
    });
});

describe('convex hulls always close (property test)', () => {
    it('a draft built from points on a convex hull, in order, always closes successfully', () => {
        const rng = createRng(2026);
        for (let trial = 0; trial < 20; trial++) {
            const centerLat = rng() * 40 - 20;
            const centerLng = rng() * 40 - 20;
            const radius = 2 + rng() * 3; // degrees; big enough to clear MIN_AREA_KM2
            const n = 3 + Math.floor(rng() * 10);
            const angles = Array.from({ length: n }, (_, i) => (i / n) * 2 * Math.PI);

            const draft = createDraft();
            for (const angle of angles) {
                const point = {
                    lat: centerLat + Math.sin(angle) * radius,
                    lng: centerLng + Math.cos(angle) * radius,
                };
                const result = draft.addPoint(point);
                expect(result.ok).toBe(true);
            }
            expect(draft.status().canClose).toBe(true);
        }
    });
});
