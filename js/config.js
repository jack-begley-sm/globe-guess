// ============================================================
// FILE: js/config.js
// PURPOSE: All constants and magic numbers for the application.
//
// DEPENDENCIES:
//   - None
//
// USED BY:
//   - js/state.js
//   - js/lobby.js
//   - js/streetview.js
//   - js/scoring.js
//
// KEY FUNCTIONS:
//   - None (Exports constants)
// ============================================================

export const VERSION = '1.6';

export const REGIONS = {
    WORLD:    { lat: [-60, 70],   lng: [-180, 180], radius: 200000 },
    UK:       { lat: [49.9, 58.7], lng: [-8.2, 1.8], radius: 30000 },
    EUROPE:   { lat: [35, 71],    lng: [-25, 45],   radius: 75000 },
    AMERICAS: { lat: [-55, 72],   lng: [-168, -34], radius: 150000 },
    AFRICA:   { lat: [-35, 37],   lng: [-18, 52],   radius: 150000 },
    ASIA:     { lat: [5, 55],     lng: [25, 145],   radius: 150000 },
    OCEANIA:  { lat: [-47, -10],  lng: [110, 180],  radius: 100000 },
};

export const MAX_SCORE = 5000;

export const SCORING = {
    CUTOFF_RATIO: 0.45,   // proportion of the play area's diameter beyond which score is 0
    CURVE_EXPONENT: 2     // p in MAX_SCORE * (1 - r/CUTOFF_RATIO)^p; tuned at item 24
};
export const DEFAULT_ROUNDS = 5;
export const DEFAULT_TIME_LIMIT = 90;
export const DEFAULT_SPEED_BONUS_PCT = 20;

export const MAP_SETTINGS = {
    INITIAL_ZOOM: 2,
    MAX_GUESS_DISTANCE: 2000 // km for zero score
};

export const CUSTOM_MAP = {
    SAMPLE_ATTEMPTS: 60,   // rejection-sampling budget for randomPointInShape
    DENSIFY_STEP_DEG: 2    // ~220km; boundary sampling step for diameterKm
};

/** Raw (non-unrolled) 4-corner bbox ring for a REGIONS entry. Deliberately
 *  not unrolled here: WORLD's 360-degree lng span would collapse to a
 *  degenerate ring, and no other built-in region crosses the antimeridian
 *  so unrolling would be a no-op for them anyway. See js/geo/shapes.js. */
function bboxToRing(region) {
    const [south, north] = region.lat;
    const [west, east] = region.lng;
    return [
        { lat: south, lng: west }, { lat: south, lng: east },
        { lat: north, lng: east }, { lat: north, lng: west },
    ];
}

export const REGION_RINGS = Object.fromEntries(
    Object.entries(REGIONS).map(([id, region]) => [id, bboxToRing(region)])
);

export const REGION_LABELS = {
    WORLD: 'World', UK: 'UK', EUROPE: 'Europe', AMERICAS: 'Americas',
    AFRICA: 'Africa', ASIA: 'Asia', OCEANIA: 'Oceania'
};
