// ============================================================
// FILE: test/unit/scoring.spec.js
// PURPOSE: Unit tests for js/scoring.js's scoreFromDistance(d, scaleKm)
//          — the relative-scorer contract from
//          .docs/custom-maps/01-scoring-model.md and
//          .docs/custom-maps/05-conceptualization/S03-relative-scorer.md.
//
// DEPENDENCIES:
//   - js/scoring.js
//   - test/support/rng.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { scoreFromDistance } from '../../js/scoring.js';
import { createRng } from '../support/rng.js';

describe('scoreFromDistance', () => {
    it.each([0, -1, NaN, undefined])('throws for scaleKm = %s', (scaleKm) => {
        expect(() => scoreFromDistance(10, scaleKm)).toThrow();
    });

    it('is exactly MAX_SCORE (5000) at d = 0', () => {
        expect(scoreFromDistance(0, 1000)).toBe(5000);
    });

    it('is exactly 0 at d = 0.45 * scaleKm (the cutoff)', () => {
        expect(scoreFromDistance(450, 1000)).toBe(0);
    });

    it('is 0 well beyond the cutoff', () => {
        expect(scoreFromDistance(8000, 1000)).toBe(0);
    });

    it('is small and positive just under the cutoff', () => {
        const score = scoreFromDistance(449, 1000);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThan(50);
    });

    it('scores a near miss worth less in a small area than a large one', () => {
        const small = scoreFromDistance(10, 40);
        const large = scoreFromDistance(10, 20015);
        expect(small).toBeLessThan(large);
    });

    it('never increases as distance increases, for a fixed scale (1000 seeded pairs)', () => {
        const rng = createRng(7);
        for (let i = 0; i < 1000; i++) {
            const scaleKm = 1 + rng() * 20000;
            const d1 = rng() * scaleKm;
            const d2 = d1 + rng() * scaleKm;
            expect(scoreFromDistance(d2, scaleKm)).toBeLessThanOrEqual(scoreFromDistance(d1, scaleKm));
        }
    });
});
