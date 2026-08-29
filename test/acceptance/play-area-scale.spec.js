// ============================================================
// FILE: test/acceptance/play-area-scale.spec.js
// PURPOSE: S02 exit-criteria acceptance spec — every play area (built-in
//          or drawn) knows its own scale in km, and random samples from
//          a drawn area always fall inside it.
//
// DEPENDENCIES:
//   - features/play-area-scale.feature
//   - js/geo/shapes.js (getShape, makeCustomShape)
//   - js/geo/polygon-measure.js (randomPointInShape)
//   - js/geo/polygon.js (containsPoint)
//   - test/support/rng.js (createRng)
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { getShape, makeCustomShape } from '../../js/geo/shapes.js';
import { randomPointInShape } from '../../js/geo/polygon-measure.js';
import { containsPoint } from '../../js/geo/polygon.js';
import { createRng } from '../support/rng.js';

const feature = await loadFeature('features/play-area-scale.feature');

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
    Scenario('The World region spans the whole world, not just its corners', ({ Given, Then }) => {
        let shape;
        Given('the built-in World play area', () => { shape = getShape('WORLD'); });
        Then('its scale is 20015 km give or take 20 km', () => {
            expect(Math.abs(shape.scaleKm - 20015)).toBeLessThanOrEqual(20);
        });
    });

    ScenarioOutline('Built-in regions have their own scale', ({ Given, Then }, variables) => {
        let shape;
        Given('the built-in <region> play area', () => { shape = getShape(variables.region); });
        Then('its scale is <scale> km give or take 20 km', () => {
            expect(Math.abs(shape.scaleKm - Number(variables.scale))).toBeLessThanOrEqual(20);
        });
    });

    Scenario('A small drawn area has a small scale', ({ Given, Then }) => {
        let shape;
        Given('a play area drawn around the box from 53.3N,-2.5W to 53.6N,-2.1W', () => {
            shape = makeCustomShape([
                { lat: 53.3, lng: -2.5 }, { lat: 53.3, lng: -2.1 },
                { lat: 53.6, lng: -2.1 }, { lat: 53.6, lng: -2.5 },
            ]);
        });
        Then('its scale is under 50 km', () => {
            expect(shape.scaleKm).toBeLessThan(50);
        });
    });

    Scenario('Random locations for a play area fall inside it', ({ Given, When, Then }) => {
        let shape, points;
        Given('a play area drawn as a triangle at 51N,0E / 52N,1E / 51N,1E', () => {
            shape = makeCustomShape([
                { lat: 51, lng: 0 }, { lat: 52, lng: 1 }, { lat: 51, lng: 1 },
            ]);
        });
        When('200 random locations are drawn from it', () => {
            const rng = createRng(20260829);
            points = Array.from({ length: 200 }, () => randomPointInShape(shape, rng));
        });
        Then('every one of them is inside the play area', () => {
            for (const point of points) {
                expect(point).not.toBeNull();
                expect(containsPoint(point, shape)).toBe(true);
            }
        });
    });
});
