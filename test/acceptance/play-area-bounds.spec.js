// ============================================================
// FILE: test/acceptance/play-area-bounds.spec.js
// PURPOSE: S01 exit-criteria acceptance spec — a play area has a
//          definite inside and outside, including across the
//          antimeridian, and rejects a self-crossing ring.
//
// DEPENDENCIES:
//   - features/play-area-bounds.feature
//   - js/geo/polygon.js (unrollRing, ringBbox, containsPoint)
//   - js/geo/polygon-validate.js (ringIsSimple)
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { unrollRing, ringBbox, containsPoint } from '../../js/geo/polygon.js';
import { ringIsSimple } from '../../js/geo/polygon-validate.js';

function shapeFromBox(sw, ne) {
    const ring = unrollRing([
        { lat: sw.lat, lng: sw.lng }, { lat: sw.lat, lng: ne.lng },
        { lat: ne.lat, lng: ne.lng }, { lat: ne.lat, lng: sw.lng }
    ]);
    return { ring, bbox: ringBbox(ring) };
}

const feature = await loadFeature('features/play-area-bounds.feature');

describeFeature(feature, ({ Scenario }) => {
    Scenario('A location inside the drawn area counts', ({ Given, When, Then }) => {
        let shape, point;
        Given('a play area drawn around the box from 50N,-8W to 58N,2E', () => {
            shape = shapeFromBox({ lat: 50, lng: -8 }, { lat: 58, lng: 2 });
        });
        When('the point 54N,-3W is tested', () => { point = { lat: 54, lng: -3 }; });
        Then('it is inside the play area', () => {
            expect(containsPoint(point, shape)).toBe(true);
        });
    });

    Scenario('A location outside the drawn area does not count', ({ Given, When, Then }) => {
        let shape, point;
        Given('a play area drawn around the box from 50N,-8W to 58N,2E', () => {
            shape = shapeFromBox({ lat: 50, lng: -8 }, { lat: 58, lng: 2 });
        });
        When('the point 48N,10E is tested', () => { point = { lat: 48, lng: 10 }; });
        Then('it is outside the play area', () => {
            expect(containsPoint(point, shape)).toBe(false);
        });
    });

    Scenario('An area drawn across the date line stays in one piece', ({ Given, When, Then, And }) => {
        let shape, point;
        Given('a play area drawn around the box from 10S,170E to 10N,170W', () => {
            shape = shapeFromBox({ lat: -10, lng: 170 }, { lat: 10, lng: -170 });
        });
        When('the point 0N,179E is tested', () => { point = { lat: 0, lng: 179 }; });
        Then('it is inside the play area', () => {
            expect(containsPoint(point, shape)).toBe(true);
        });
        And('the point 0N,150E is outside the play area', () => {
            expect(containsPoint({ lat: 0, lng: 150 }, shape)).toBe(false);
        });
    });

    Scenario('A point exactly on the edge counts as inside', ({ Given, When, Then }) => {
        let shape, point;
        Given('a play area drawn around the box from 50N,-8W to 58N,2E', () => {
            shape = shapeFromBox({ lat: 50, lng: -8 }, { lat: 58, lng: 2 });
        });
        When('the point 50N,-3W is tested', () => { point = { lat: 50, lng: -3 }; });
        Then('it is inside the play area', () => {
            expect(containsPoint(point, shape)).toBe(true);
        });
    });

    Scenario('An area that crosses over itself is not a valid play area', ({ Given, Then }) => {
        let ring;
        Given('the player has drawn the ring 0N0E, 10N10E, 0N10E, 10N0E', () => {
            ring = [{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }, { lat: 0, lng: 10 }, { lat: 10, lng: 0 }];
        });
        Then('the ring is rejected as self-crossing', () => {
            expect(ringIsSimple(ring)).toBe(false);
        });
    });
});
