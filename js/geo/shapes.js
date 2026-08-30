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
    if (!Object.hasOwn(REGIONS, regionId)) {
        throw new Error(`getShape: unknown region '${regionId}'`);
    }

    const ring = REGION_RINGS[regionId];
    const shape = Object.freeze({
        id: regionId,
        label: REGION_LABELS[regionId],
        ring: Object.freeze(ring.map((p) => Object.freeze({ ...p }))),
        bbox: Object.freeze(ringBbox(ring)),
        scaleKm: diameterKm(ring, CUSTOM_MAP.DENSIFY_STEP_DEG),
    });
    cache.set(regionId, shape);
    return shape;
}

/**
 * Builds a Shape for a player-drawn ring. Unrolls it first, then
 * rejects a ring that could never be a legal play area: not an array,
 * a point with a non-finite lat/lng, fewer than 3 vertices, more than
 * CUSTOM_MAP.MAX_VERTICES, an unrolled span of 360 degrees or more, or
 * a self-crossing boundary. (These are also enforced live at draw time
 * in custom-draft.js — this is the last-line guard for the Shape
 * boundary, not a full re-check. `js/vs-guest.js` and `js/vs-round.js`
 * also call this on rings that arrived over PeerJS from a host, so the
 * vertex cap and finite-number checks matter here too, not just for
 * locally-drawn rings — a hand-modified or buggy host could otherwise
 * send a ring that freezes ringIsSimple's O(n^2) loops.)
 * @param {import('./polygon.js').Ring} ring - as drawn, not yet unrolled
 * @returns {import('./polygon.js').Shape}
 */
export function makeCustomShape(ring) {
    if (!Array.isArray(ring)) {
        throw new Error('makeCustomShape: ring must be an array');
    }
    if (ring.length < 3) {
        throw new Error('makeCustomShape: ring needs at least 3 vertices');
    }
    if (ring.length > CUSTOM_MAP.MAX_VERTICES) {
        throw new Error(`makeCustomShape: ring exceeds ${CUSTOM_MAP.MAX_VERTICES} vertices`);
    }
    if (ring.some((p) => !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng))) {
        throw new Error('makeCustomShape: ring contains a non-finite lat/lng');
    }

    const unrolled = unrollRing(ring);
    const bbox = ringBbox(unrolled);
    if (bbox.east - bbox.west >= 360) {
        throw new Error('makeCustomShape: ring spans 360 degrees or more');
    }
    if (!ringIsSimple(unrolled)) {
        throw new Error('makeCustomShape: ring is self-crossing');
    }

    return Object.freeze({
        id: 'CUSTOM',
        label: 'Custom',
        ring: Object.freeze(unrolled.map((p) => Object.freeze({ ...p }))),
        bbox: Object.freeze(bbox),
        scaleKm: diameterKm(unrolled, CUSTOM_MAP.DENSIFY_STEP_DEG),
    });
}
