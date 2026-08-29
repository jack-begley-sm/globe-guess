// ============================================================
// FILE: test/acceptance/scoring-scale.spec.js
// PURPOSE: Acceptance test for the play-area-relative scoring rule,
//          bound against the real js/scoring.js. Started in S00 (item 2)
//          against a temporary local scorer, deleted in S03 (item 18) —
//          this feature file has not changed since.
//
// DEPENDENCIES:
//   - features/scoring-scale.feature
//   - js/scoring.js (scoreFromDistance)
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { scoreFromDistance } from '../../js/scoring.js';

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
                expect(Math.round(scoreFromDistance(distKm, scaleKm)))
                    .toBe(Number(variables.score));
            });
        });
});
