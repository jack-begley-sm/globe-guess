// ============================================================
// FILE: js/geo/shapes.js
// PURPOSE: Builds and memoises Shape objects (ring + bbox + scaleKm)
//          for the built-in regions and player-drawn custom areas. See
//          .docs/custom-maps/02-geometry-contracts.md for the Shape spec.
//
// DEPENDENCIES:
//   - js/geo/polygon.js (unrollRing, ringBbox)
//   - js/geo/polygon-validate.js (ringIsSimple)
//   - js/geo/polygon-measure.js (diameterKm)
//   - js/config.js (REGIONS, REGION_RINGS, REGION_LABELS, CUSTOM_MAP)
//
// USED BY:
//   - js/lobby.js, js/vs-*.js, js/su-*.js (planned) — region/custom selection
//
// KEY FUNCTIONS:
//   - getShape(regionId)     memoised built-in Shape, same object every call
//   - makeCustomShape(ring)  builds a Shape for a drawn ring; throws if invalid
// ============================================================
import { unrollRing, ringBbox } from './polygon.js';
import { ringIsSimple } from './polygon-validate.js';
import { diameterKm } from './polygon-measure.js';
import { REGIONS, REGION_RINGS, REGION_LABELS, CUSTOM_MAP } from '../config.js';

const cache = new Map();

/**
 * Built-in region Shape, computed on first call and memoised — repeat
 * calls for the same `regionId` return the identical object.
 * REGION_RINGS is used as-is (not unrolled — see its definition in
 * config.js for why WORLD specifically depends on that).
 * @param {string} regionId - a key of REGIONS, e.g. 'WORLD'
 * @returns {import('./polygon.js').Shape}
 */
export function getShape(regionId) {
    if (cache.has(regionId)) return cache.get(regionId);
    if (!REGIONS[regionId]) {
        throw new Error(`getShape: unknown region '${regionId}'`);
    }

    const ring = REGION_RINGS[regionId];
    const shape = {
        id: regionId,
        label: REGION_LABELS[regionId],
        ring,
        bbox: ringBbox(ring),
        scaleKm: diameterKm(ring, CUSTOM_MAP.DENSIFY_STEP_DEG),
    };
    cache.set(regionId, shape);
    return shape;
}

/**
 * Builds a Shape for a player-drawn ring. Unrolls it first, then
 * rejects a ring that could never be a legal play area: fewer than 3
 * vertices, an unrolled span of 360 degrees or more, or a self-crossing
 * boundary. (These are also enforced live at draw time in
 * custom-draft.js — this is the last-line guard for the Shape boundary.)
 * @param {import('./polygon.js').Ring} ring - as drawn, not yet unrolled
 * @returns {import('./polygon.js').Shape}
 */
export function makeCustomShape(ring) {
    if (ring.length < 3) {
        throw new Error('makeCustomShape: ring needs at least 3 vertices');
    }

    const unrolled = unrollRing(ring);
    const bbox = ringBbox(unrolled);
    if (bbox.east - bbox.west >= 360) {
        throw new Error('makeCustomShape: ring spans 360 degrees or more');
    }
    if (!ringIsSimple(unrolled)) {
        throw new Error('makeCustomShape: ring is self-crossing');
    }

    return {
        id: 'CUSTOM',
        label: 'Custom',
        ring: unrolled,
        bbox,
        scaleKm: diameterKm(unrolled, CUSTOM_MAP.DENSIFY_STEP_DEG),
    };
}
