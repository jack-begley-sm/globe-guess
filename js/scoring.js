// ============================================================
// FILE: js/scoring.js
// PURPOSE: Scoring logic based on distance and speed, relative to a
//          play area's own scale (js/geo/shapes.js's scaleKm).
//
// DEPENDENCIES:
//   - js/config.js      (MAX_SCORE, SCORING)
//
// USED BY:
//   - js/round.js       (calculates score for each round — not yet
//     migrated to pass scaleKm; throws until item 20)
//
// KEY FUNCTIONS:
//   - calculateScore(guess, actual, time, limit, bonusEnabled, bonusPct, scaleKm)
//   - distanceKm(lat1, lng1, lat2, lng2) haversine formula
//   - scoreFromDistance(d, scaleKm) MAX_SCORE at d=0, 0 at 45% of scaleKm
// ============================================================

import { MAX_SCORE, SCORING } from './config.js';

export function calculateScore(guessLatLng, actualLatLng, timeTaken, timeLimit, speedBonusEnabled, speedBonusPct, scaleKm) {
    if (!(scaleKm > 0)) {
        // Validated before the null-guess branch below, so an un-migrated
        // call site throws even on a timeout round instead of silently
        // scoring wrong. See S03-relative-scorer.md's "Watch out for".
        throw new Error(`calculateScore: scaleKm must be a positive number, got ${scaleKm}`);
    }
    if (!guessLatLng) {
        return { distanceKm: Infinity, baseScore: 0, speedScore: 0, totalScore: 0 };
    }

    const dist = distanceKm(
        guessLatLng.lat, guessLatLng.lng,
        actualLatLng.lat, actualLatLng.lng
    );

    const baseScore = scoreFromDistance(dist, scaleKm);
    let speedScore = 0;

    if (speedBonusEnabled && baseScore > 0 && timeLimit > 0) {
        const timeFactor = Math.max(0, 1 - (timeTaken / timeLimit));
        speedScore = Math.round(baseScore * (speedBonusPct / 100) * timeFactor);
    }

    return {
        distanceKm: Math.round(dist * 100) / 100,
        baseScore: Math.round(baseScore),
        speedScore: Math.round(speedScore),
        totalScore: Math.round(baseScore + speedScore)
    };
}

export function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Score relative to the play area's own scale — see 01-scoring-model.md.
 * `r = d / scaleKm` is the proportion of the way across the area; score
 * is 0 from `r = CUTOFF_RATIO` onward, MAX_SCORE at `r = 0`.
 * @param {number} d - great-circle distance, km
 * @param {number} scaleKm - the play area's diameter, km; must be > 0
 * @returns {number}
 */
export function scoreFromDistance(d, scaleKm) {
    if (!(scaleKm > 0)) {
        throw new Error(`scoreFromDistance: scaleKm must be a positive number, got ${scaleKm}`);
    }

    const r = d / scaleKm;
    if (r >= SCORING.CUTOFF_RATIO) return 0;
    return MAX_SCORE * Math.pow(1 - r / SCORING.CUTOFF_RATIO, SCORING.CURVE_EXPONENT);
}
