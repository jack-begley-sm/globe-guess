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
