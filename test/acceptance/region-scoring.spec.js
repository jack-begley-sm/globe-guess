// ============================================================
// FILE: test/acceptance/region-scoring.spec.js
// PURPOSE: S04 exit-criteria acceptance spec — every existing mode
//          (Classic, VS, Stitch Up) scores against its own region's
//          scale, per .docs/custom-maps/05-conceptualization/
//          S04-regions-migrate.md. Exercises the real calculateScore
//          pipeline end to end (lat/lng -> haversine -> relative
//          score), not just scoreFromDistance in isolation.
//
// DEPENDENCIES:
//   - features/region-scoring.feature
//   - js/scoring.js (calculateScore, setterScoreFromGuesserScore)
//   - js/geo/shapes.js (getShape)
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { calculateScore, setterScoreFromGuesserScore } from '../../js/scoring.js';
import { getShape } from '../../js/geo/shapes.js';

const HOME = { lat: 0, lng: 0 };

/** A guess exactly distKm from HOME, via the equatorial haversine identity
 *  (dLat=0 makes distance = R * dLng-in-radians exactly). */
function guessAtDistanceKm(distKm) {
    const R = 6371;
    const dLngDeg = (distKm / R) * (180 / Math.PI);
    return { lat: 0, lng: dLngDeg };
}

function scoreAt(distKm, scaleKm) {
    return calculateScore(guessAtDistanceKm(distKm), HOME, 0, 0, false, 0, scaleKm).totalScore;
}

const feature = await loadFeature('features/region-scoring.feature');

describeFeature(feature, ({ Scenario }) => {
    Scenario('A 100 km miss in the UK is a worse guess than in the World', ({ Given, When, Then, And }) => {
        let distKm, ukScore;
        Given('a Classic game in the UK region', () => {});
        When('the player guesses 100 km from the location', () => { distKm = 100; });
        // Recomputed against the real getShape('UK')/getShape('WORLD')
        // scaleKm and the live SCORING.CURVE_EXPONENT (1.5, lowered from
        // the originally-shipped 2 after playing a small Custom area —
        // see js/config.js), not copied from any doc's illustrative
        // numbers, which still assume the old exponent.
        Then('they score 3647 points', () => {
            ukScore = scoreAt(distKm, getShape('UK').scaleKm);
            expect(ukScore).toBe(3647);
        });
        And('the same guess in the World region would score 4917 points', () => {
            expect(scoreAt(distKm, getShape('WORLD').scaleKm)).toBe(4917);
            expect(scoreAt(distKm, getShape('WORLD').scaleKm)).toBeGreaterThan(ukScore);
        });
    });

    Scenario('A wrong-continent guess in a World game scores something, not nothing', ({ Given, When, Then }) => {
        let distKm;
        Given('a Classic game in the World region', () => {});
        When('the player guesses 4000 km from the location', () => { distKm = 4000; });
        Then('they score 2072 points', () => {
            expect(scoreAt(distKm, getShape('WORLD').scaleKm)).toBe(2072);
        });
    });

    Scenario('A guess more than 45% across the region scores nothing', ({ Given, When, Then }) => {
        let distKm;
        Given('a Classic game in the UK region', () => {});
        When('the player guesses 600 km from the location', () => { distKm = 600; });
        Then('they score 0 points', () => {
            expect(scoreAt(distKm, getShape('UK').scaleKm)).toBe(0);
        });
    });

    Scenario('A VS round scores every player against the region size', ({ Given, When, Then, And }) => {
        let first, second;
        Given('a VS game in the Europe region with two players', () => {});
        When('one guesses 100 km away and the other guesses 3000 km away', () => {
            const scaleKm = getShape('EUROPE').scaleKm;
            first = scoreAt(100, scaleKm);
            second = scoreAt(3000, scaleKm);
        });
        Then('the first scores more than the second', () => {
            expect(first).toBeGreaterThan(second);
        });
        And('the second scores 0 points', () => {
            expect(second).toBe(0);
        });
    });

    Scenario("A Stitch Up setter is rewarded by the guesser's shortfall", ({ Given, When, Then, And }) => {
        let guesserScore, setterScore;
        Given('a Stitch Up round in the World region', () => {});
        When("the guesser lands 4000 km from the setter's location", () => {
            guesserScore = scoreAt(4000, getShape('WORLD').scaleKm);
            setterScore = setterScoreFromGuesserScore(guesserScore, false);
        });
        Then('the guesser scores 2072 points', () => {
            expect(guesserScore).toBe(2072);
        });
        And('the setter scores 2928 points', () => {
            expect(setterScore).toBe(2928);
        });
    });
});
