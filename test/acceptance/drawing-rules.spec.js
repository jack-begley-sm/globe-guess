// ============================================================
// FILE: test/acceptance/drawing-rules.spec.js
// PURPOSE: S05 exit-criteria acceptance spec — the rules of drawing a
//          custom play area, with no map involved. See
//          .docs/custom-maps/05-conceptualization/S05-draft-model.md.
//
// DEPENDENCIES:
//   - features/drawing-rules.feature
//   - js/custom-draft.js (createDraft)
//   - js/geo/polygon.js (containsPoint)
//   - js/geo/polygon-measure.js (randomPointInShape)
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { createDraft } from '../../js/custom-draft.js';
import { containsPoint } from '../../js/geo/polygon.js';
import { randomPointInShape } from '../../js/geo/polygon-measure.js';

const feature = await loadFeature('features/drawing-rules.feature');

describeFeature(feature, ({ Scenario }) => {
    Scenario('Three points make an area', ({ Given, When, Then }) => {
        let draft;
        Given('an empty drawing', () => { draft = createDraft(); });
        When('the player taps 51N,0E and 52N,1E and 51N,1E', () => {
            draft.addPoint({ lat: 51, lng: 0 });
            draft.addPoint({ lat: 52, lng: 1 });
            draft.addPoint({ lat: 51, lng: 1 });
        });
        Then('the area can be confirmed', () => {
            expect(draft.status().canClose).toBe(true);
        });
    });

    Scenario('Two points are not enough', ({ Given, When, Then, And }) => {
        let draft;
        Given('an empty drawing', () => { draft = createDraft(); });
        When('the player taps 51N,0E and 52N,1E', () => {
            draft.addPoint({ lat: 51, lng: 0 });
            draft.addPoint({ lat: 52, lng: 1 });
        });
        Then('the area cannot be confirmed', () => {
            expect(draft.status().canClose).toBe(false);
        });
        And('the reason is that there are too few points', () => {
            expect(draft.status().reason).toBe('TOO_FEW');
        });
    });

    Scenario('Undo removes the last point', ({ Given, When, Then, And }) => {
        let draft;
        Given('a drawing with points 51N,0E and 52N,1E and 51N,1E', () => {
            draft = createDraft();
            draft.addPoint({ lat: 51, lng: 0 });
            draft.addPoint({ lat: 52, lng: 1 });
            draft.addPoint({ lat: 51, lng: 1 });
        });
        When('the player undoes once', () => { draft.undo(); });
        Then('the area cannot be confirmed', () => {
            expect(draft.status().canClose).toBe(false);
        });
        And('the drawing has 2 points', () => {
            expect(draft.points.length).toBe(2);
        });
    });

    Scenario('A shape that crosses itself cannot be confirmed', ({ Given, When, Then, And }) => {
        // Self-crossing is checked on every add (S05's own exit criterion),
        // so the offending tap here is the 4th one, rejected outright —
        // "the area cannot be confirmed" describes that rejection, not a
        // later status() call on a 3-point draft (which would be a valid,
        // closeable triangle).
        let draft, lastResult;
        Given('an empty drawing', () => { draft = createDraft(); });
        When('the player taps 0N,0E and 10N,10E and 0N,10E and 10N,0E', () => {
            draft.addPoint({ lat: 0, lng: 0 });
            draft.addPoint({ lat: 10, lng: 10 });
            draft.addPoint({ lat: 0, lng: 10 });
            lastResult = draft.addPoint({ lat: 10, lng: 0 });
        });
        Then('the area cannot be confirmed', () => {
            expect(lastResult.ok).toBe(false);
        });
        And('the reason is that the shape crosses itself', () => {
            expect(lastResult.reason).toBe('SELF_CROSSING');
        });
    });

    Scenario('An area too small to hold a street cannot be confirmed', ({ Given, When, Then, And }) => {
        let draft;
        Given('an empty drawing', () => { draft = createDraft(); });
        When('the player taps three points within 200 metres of each other', () => {
            draft = createDraft();
            draft.addPoint({ lat: 51.0000, lng: 0.0000 });
            draft.addPoint({ lat: 51.0010, lng: 0.0000 });
            draft.addPoint({ lat: 51.0000, lng: 0.0010 });
        });
        Then('the area cannot be confirmed', () => {
            expect(draft.status().canClose).toBe(false);
        });
        And('the reason is that the area is too small', () => {
            expect(draft.status().reason).toBe('TOO_SMALL');
        });
    });

    Scenario('The player cannot wrap all the way round the world', ({ Given, When, Then, And }) => {
        let draft, lastResult;
        Given('an empty drawing', () => { draft = createDraft(); });
        When('the player taps 0N,0E and 0N,170E and 0N,-20E and 10N,0E', () => {
            draft.addPoint({ lat: 0, lng: 0 });
            draft.addPoint({ lat: 0, lng: 170 });
            draft.addPoint({ lat: 0, lng: -20 });
            lastResult = draft.addPoint({ lat: 10, lng: 0 });
        });
        Then('the last tap is rejected', () => {
            expect(lastResult.ok).toBe(false);
        });
        And('the reason is that the shape wraps around the world', () => {
            expect(lastResult.reason).toBe('WOUND_ROUND_WORLD');
        });
    });

    Scenario('There is a limit on how detailed an area can be', ({ Given, When, Then, And }) => {
        let draft, lastResult;
        Given('a drawing with 24 points', () => {
            draft = createDraft();
            for (let i = 0; i < 24; i++) {
                draft.addPoint({ lat: 0, lng: i * 0.01 });
            }
        });
        When('the player taps another point', () => {
            lastResult = draft.addPoint({ lat: 0, lng: 1 });
        });
        Then('the tap is rejected', () => {
            expect(lastResult.ok).toBe(false);
        });
        And('the reason is that there are too many points', () => {
            expect(lastResult.reason).toBe('TOO_MANY');
        });
    });

    Scenario('Confirming produces a play area with its own scale', ({ Given, When, Then, And }) => {
        let draft, shape;
        Given('a drawing around the box from 53.3N,-2.5W to 53.6N,-2.1W', () => {
            draft = createDraft();
            draft.addPoint({ lat: 53.3, lng: -2.5 });
            draft.addPoint({ lat: 53.3, lng: -2.1 });
            draft.addPoint({ lat: 53.6, lng: -2.1 });
            draft.addPoint({ lat: 53.6, lng: -2.5 });
        });
        When('the player confirms the area', () => { shape = draft.close(); });
        Then("the play area's scale is under 50 km", () => {
            expect(shape.scaleKm).toBeLessThan(50);
        });
        And('a location drawn from it is inside it', () => {
            const point = randomPointInShape(shape);
            expect(point).not.toBeNull();
            expect(containsPoint(point, shape)).toBe(true);
        });
    });
});
