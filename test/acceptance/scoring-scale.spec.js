// ============================================================
// FILE: test/acceptance/scoring-scale.spec.js
// PURPOSE: Walking-skeleton acceptance test for the play-area-relative
//          scoring rule, bound against a TEMPORARY local scorer.
//          S03 repoints these steps at the real js/scoring.js and
//          deletes localScoreFromDistance — this file's feature does
//          not change when that happens.
//
// DEPENDENCIES:
//   - features/scoring-scale.feature
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';

const MAX_SCORE = 5000;
const CUTOFF_RATIO = 0.45;
const CURVE_EXPONENT = 2;

function localScoreFromDistance(distKm, scaleKm) {
    if (!Number.isFinite(scaleKm) || scaleKm <= 0) {
        throw new Error(`localScoreFromDistance: invalid scaleKm ${scaleKm}`);
    }
    if (!Number.isFinite(distKm)) return 0;
    if (distKm <= 0) return MAX_SCORE;

    const ratio = distKm / scaleKm;
    if (ratio >= CUTOFF_RATIO) return 0;

    return MAX_SCORE * Math.pow(1 - ratio / CUTOFF_RATIO, CURVE_EXPONENT);
}

const feature = await loadFeature('features/scoring-scale.feature');

describeFeature(feature, ({ ScenarioOutline }) => {
    ScenarioOutline('The same miss is worth more in a bigger area',
        ({ Given, When, Then }, variables) => {
            let scaleKm, distKm;
            Given('a play area whose diameter is <diameter> km', () => {
                scaleKm = Number(variables.diameter);
            });
            When('a player guesses <miss> km from the location', () => {
                distKm = Number(variables.miss);
            });
            Then('they score <score> points', () => {
                expect(Math.round(localScoreFromDistance(distKm, scaleKm)))
                    .toBe(Number(variables.score));
            });
        });
});
