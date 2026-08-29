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
import { scoreFromDistance, calculateScore } from '../../js/scoring.js';
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

describe('calculateScore', () => {
    const HERE = { lat: 51, lng: 0 };
    const THERE = { lat: 51, lng: 0.1 }; // a few km away

    it.each([undefined, 0, -1, NaN])('throws when scaleKm is %s, naming it in the message', (scaleKm) => {
        expect(() => calculateScore(HERE, THERE, 10, 90, false, 20, scaleKm)).toThrow(/scaleKm/);
    });

    it('throws on a missing scaleKm even when the guess is null (timeout round)', () => {
        expect(() => calculateScore(null, THERE, 90, 90, false, 20, undefined)).toThrow(/scaleKm/);
    });

    it('still returns the zero-score timeout shape when scaleKm is valid but guess is null', () => {
        const result = calculateScore(null, THERE, 90, 90, false, 20, 1000);
        expect(result).toEqual({ distanceKm: Infinity, baseScore: 0, speedScore: 0, totalScore: 0 });
    });

    it('reaches MAX_SCORE (5000) for a perfect guess, any scale', () => {
        expect(calculateScore(HERE, HERE, 10, 90, false, 20, 1000).totalScore).toBe(5000);
    });

    it('applies the speed bonus identically to before, with scaleKm fixed', () => {
        const noBonus = calculateScore(HERE, HERE, 45, 90, false, 20, 1000);
        const withBonus = calculateScore(HERE, HERE, 45, 90, true, 20, 1000);
        // timeFactor = 1 - 45/90 = 0.5; bonus = baseScore * 0.20 * 0.5
        expect(withBonus.speedScore).toBe(Math.round(noBonus.baseScore * 0.2 * 0.5));
        expect(withBonus.totalScore).toBe(noBonus.baseScore + withBonus.speedScore);
    });

    it('gives no speed bonus once time runs out, with scaleKm fixed', () => {
        const result = calculateScore(HERE, HERE, 90, 90, true, 20, 1000);
        expect(result.speedScore).toBe(0);
    });
});
