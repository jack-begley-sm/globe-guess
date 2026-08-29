// ============================================================
// FILE: test/acceptance/custom-solo-game.spec.js
// PURPOSE: S09 exit-criteria acceptance spec — a full solo Custom game
//          plays end to end, staying inside the drawn area throughout,
//          scoring against its scale. See
//          .docs/custom-maps/05-conceptualization/S09-solo-game.md.
//
// DEPENDENCIES:
//   - features/custom-solo-game.feature
//   - js/round.js (startGame, initRoundEvents)
//   - js/geo/shapes.js (makeCustomShape)
//   - js/geo/polygon.js (containsPoint)
//   - js/scoring.js (calculateScore, for the direct-scoring scenarios)
//   - test/support/fakes/google-maps.js, test/support/fakes/leaflet.js
//
// USED BY:
//   - npm test
// ============================================================
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGoogleMapsFake, makePanoData } from '../support/fakes/google-maps.js';
import { installLeafletFakeCapturingMap } from '../support/fakes/leaflet.js';
import { makeCustomShape } from '../../js/geo/shapes.js';
import { containsPoint } from '../../js/geo/polygon.js';
import { calculateScore } from '../../js/scoring.js';

function loadIndexBody() {
    const html = readFileSync('index.html', 'utf-8');
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    document.body.innerHTML = match[1];
}

/** A custom triangle near Manchester whose scale comes out under 50km —
 *  matches the "small drawn area" shape used elsewhere this session. */
function manchesterAreaShape() {
    return makeCustomShape([
        { lat: 53.35, lng: -2.35 },
        { lat: 53.55, lng: -2.35 },
        { lat: 53.45, lng: -2.10 },
    ]);
}

const GUESS_POINT = { lat: 53.45, lng: -2.25 }; // inside manchesterAreaShape()

/** Fresh DOM + fresh fakes + fresh modules for one scenario. The
 *  Google Maps fake always answers with a pano at GUESS_POINT, so the
 *  location search never fails and every location is inside the shape
 *  by construction. */
async function freshGame() {
    const { google, calls } = createGoogleMapsFake(() => ({
        status: 'OK',
        data: makePanoData({ lat: GUESS_POINT.lat, lng: GUESS_POINT.lng }),
    }));
    globalThis.google = google;
    const { L, getLastMap } = installLeafletFakeCapturingMap();
    loadIndexBody();
    vi.resetModules();
    const round = await import('../../js/round.js');
    const results = await import('../../js/results.js');
    const state = (await import('../../js/state.js')).state;
    return { calls, round, results, state, L, getLastMap };
}

async function flush() {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
}

/** Two clicks: the widget starts collapsed every round (resetMap
 *  re-collapses it), so the first click only expands it — the second
 *  is the real guess. */
function placeGuessOn(map, L, point) {
    map.fire('click', { latlng: L.latLng(point.lat, point.lng) });
    map.fire('click', { latlng: L.latLng(point.lat, point.lng) });
}

/** A guess exactly distKm from HOME (0,0), via the equatorial haversine
 *  identity (dLat=0 makes distance = R * dLng-in-radians exactly) — the
 *  same trick used in list 1's region-scoring.spec.js, needed because a
 *  hand-picked degree offset (e.g. "0.036") is only approximately 4km. */
function guessAtDistanceKm(distKm) {
    const R = 6371;
    const dLngDeg = (distKm / R) * (180 / Math.PI);
    return { lat: 0, lng: dLngDeg };
}
const HOME = { lat: 0, lng: 0 };

const feature = await loadFeature('features/custom-solo-game.feature');

describeFeature(feature, ({ Scenario }) => {
    Scenario('A whole game stays inside the chosen area', ({ Given, And, When, Then }) => {
        let ctx, shape;
        Given('the player has drawn an area around Greater Manchester', async () => {
            ctx = await freshGame();
            shape = manchesterAreaShape();
            ctx.state.shape = shape;
            ctx.state.region = 'CUSTOM';
            ctx.state.timeLimit = 90;
            ctx.state.speedBonusPct = 0;
        });
        And('has chosen 3 rounds', () => { ctx.state.totalRounds = 3; });
        When('the player plays all 3 rounds', async () => {
            ctx.round.initRoundEvents();
            ctx.round.startGame();
            // getLastMap() tracks whichever map was created MOST recently —
            // after round 1 ends, showResultOnMap() creates its own
            // read-only 'result-mini-map', which would overwrite this
            // reference. Capture the actual guess map once, right after
            // initMap() creates it, and reuse that.
            const guessMap = ctx.getLastMap();
            for (let round = 1; round <= 3; round++) {
                await flush();
                placeGuessOn(guessMap, ctx.L, GUESS_POINT);
                document.getElementById('btn-submit-guess').click();
                document.getElementById('btn-next-round').click();
            }
        });
        Then('every location was inside the area', () => {
            expect(ctx.state.scores.length).toBe(3);
            for (const s of ctx.state.scores) {
                expect(containsPoint(s.location, shape)).toBe(true);
            }
        });
        And('every guess was inside the area', () => {
            for (const s of ctx.state.scores) {
                expect(containsPoint(s.guess, shape)).toBe(true);
            }
        });
        And('the game ends on the results screen', () => {
            expect(document.getElementById('screen-results').classList.contains('hidden')).toBe(false);
        });
    });

    Scenario("Scores use the custom area's scale", ({ Given, When, Then }) => {
        let score;
        Given('the player has drawn an area whose scale is 40 km', () => {});
        When('the player guesses 4 km from the location', () => {
            const result = calculateScore(guessAtDistanceKm(4), HOME, 0, 0, false, 0, 40);
            score = result.totalScore;
        });
        Then('they score 3025 points', () => {
            // Recomputed from the formula, not copied from the doc:
            // r = 4/40 = 0.1 -> 5000*(1 - 0.1/0.45)^2.
            const expected = Math.round(5000 * Math.pow(1 - (4 / 40) / 0.45, 2));
            expect(expected).toBe(3025);
            expect(score).toBe(expected);
        });
    });

    Scenario('A guess more than 45% across the custom area scores nothing', ({ Given, When, Then }) => {
        let score;
        Given('the player has drawn an area whose scale is 40 km', () => {});
        When('the player guesses 20 km from the location', () => {
            const result = calculateScore(guessAtDistanceKm(20), HOME, 0, 0, false, 0, 40);
            score = result.totalScore;
        });
        Then('they score 0 points', () => {
            expect(score).toBe(0); // r = 20/40 = 0.5 >= 0.45 cutoff
        });
    });

    Scenario('Running out of time scores nothing', ({ Given, When, Then, And }) => {
        let ctx;
        Given('a custom game is in progress with a 30 second limit', async () => {
            vi.useFakeTimers();
            ctx = await freshGame();
            ctx.state.shape = manchesterAreaShape();
            ctx.state.region = 'CUSTOM';
            ctx.state.totalRounds = 2;
            ctx.state.timeLimit = 30;
            ctx.state.speedBonusPct = 0;
            ctx.round.initRoundEvents();
            ctx.round.startGame();
            await vi.advanceTimersByTimeAsync(600); // let the location search + pano load settle
        });
        When('the player lets the timer run out without guessing', async () => {
            await vi.advanceTimersByTimeAsync(30000); // the round's own 1s ticks to 0
        });
        Then('they score 0 points', () => {
            expect(ctx.state.scores[0].totalScore).toBe(0);
            expect(ctx.state.scores[0].guess).toBeFalsy();
        });
        And('the game moves to the next round', async () => {
            await vi.advanceTimersByTimeAsync(4000); // the round-result auto-advance
            expect(ctx.state.currentRound).toBe(2);
            vi.useRealTimers();
        });
    });

    Scenario('The speed bonus still applies', ({ Given, When, Then, And }) => {
        let baseScore, speedScore;
        Given('a custom game with a 20 percent speed bonus and a 60 second limit', () => {});
        When('the player guesses 4 km from the location after 15 seconds', () => {
            const result = calculateScore(guessAtDistanceKm(4), HOME, 15, 60, true, 20, 40);
            baseScore = result.baseScore;
            speedScore = result.speedScore;
        });
        Then('their base score is 3025', () => {
            expect(baseScore).toBe(3025);
        });
        And('their speed bonus is 454', () => {
            // Recomputed: 3025 * 0.20 * (1 - 15/60) = 3025 * 0.20 * 0.75.
            const expected = Math.round(3025 * 0.2 * 0.75);
            expect(expected).toBe(454);
            expect(speedScore).toBe(expected);
        });
    });

    Scenario('The results screen explains the area', ({ Given, Then }) => {
        let ctx, shape;
        Given('the player has finished a custom game', async () => {
            ctx = await freshGame();
            shape = manchesterAreaShape();
            ctx.state.shape = shape;
            ctx.state.region = 'CUSTOM';
            ctx.state.scores = [{ distanceKm: 5, totalScore: 4000, location: GUESS_POINT, guess: GUESS_POINT }];
            ctx.results.renderResults();
        });
        Then("the results show the area's size and the distance beyond which a guess scores nothing", () => {
            const summary = document.getElementById('results-area-summary').textContent;
            const scale = Math.round(shape.scaleKm);
            const cutoff = Math.round(shape.scaleKm * 0.45);
            expect(summary).toBe(`Area: ${scale} km across — anything over ${cutoff} km scored zero`);
        });
    });

    Scenario('Playing again keeps the same area', ({ Given, When, Then }) => {
        let ctx, shape;
        Given('the player has finished a custom game', async () => {
            ctx = await freshGame();
            shape = manchesterAreaShape();
            ctx.state.shape = shape;
            ctx.state.region = 'CUSTOM';
            ctx.results.initResults();
        });
        When('the player chooses play again', () => {
            document.getElementById('btn-play-again').click();
        });
        Then('the same area is used', () => {
            expect(ctx.state.shape).toBe(shape);
            expect(ctx.state.region).toBe('CUSTOM');
        });
    });
});
