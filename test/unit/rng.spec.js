// ============================================================
// FILE: test/unit/rng.spec.js
// PURPOSE: Determinism test for the seeded RNG. Item 3 of
//          .docs/custom-maps/06-list-of-items.md.
//
// DEPENDENCIES:
//   - test/support/rng.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { createRng } from '../support/rng.js';

describe('createRng', () => {
    it('produces an identical sequence for the same seed', () => {
        const a = createRng(42);
        const b = createRng(42);
        const seqA = Array.from({ length: 20 }, () => a());
        const seqB = Array.from({ length: 20 }, () => b());
        expect(seqA).toEqual(seqB);
    });

    it('produces a different sequence for a different seed', () => {
        const a = createRng(1);
        const b = createRng(2);
        const seqA = Array.from({ length: 20 }, () => a());
        const seqB = Array.from({ length: 20 }, () => b());
        expect(seqA).not.toEqual(seqB);
    });

    it('stays within [0, 1)', () => {
        const rng = createRng(7);
        for (let i = 0; i < 1000; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});
