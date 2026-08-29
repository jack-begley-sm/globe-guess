// ============================================================
// FILE: js/custom-draft.js
// PURPOSE: The rules of drawing a custom play area — how many points,
//          when it can be closed, what makes it invalid. No map, no
//          DOM, no js/state.js. See
//          .docs/custom-maps/05-conceptualization/S05-draft-model.md.
//
// DEPENDENCIES:
//   - js/geo/polygon.js (unrollRing)
//   - js/geo/polygon-validate.js (pathIsSimple)
//   - js/geo/polygon-measure.js (areaKm2)
//   - js/geo/shapes.js (makeCustomShape)
//   - js/config.js (CUSTOM_MAP)
//
// USED BY:
//   - js/custom-map.js (planned, S06) — Leaflet adapter forwards taps here
//
// KEY FUNCTIONS:
//   - createDraft()   returns a Draft: addPoint/undo/clear/points/status/close
// ============================================================
import { unrollRing } from './geo/polygon.js';
import { pathIsSimple } from './geo/polygon-validate.js';
import { areaKm2 } from './geo/polygon-measure.js';
import { makeCustomShape } from './geo/shapes.js';
import { CUSTOM_MAP } from './config.js';

/**
 * @typedef {{ lat: number, lng: number }} LatLng
 * @typedef {{ ok: boolean, reason?: string }} AddPointResult
 */

/**
 * @returns {{
 *   addPoint: (p: LatLng) => AddPointResult,
 *   undo: () => void,
 *   clear: () => void,
 *   points: LatLng[]
 * }}
 */
export function createDraft() {
    let points = [];

    function addPoint(latLng) {
        if (points.length >= CUSTOM_MAP.MAX_VERTICES) {
            return { ok: false, reason: 'TOO_MANY' };
        }

        const candidate = { lat: latLng.lat, lng: latLng.lng };
        const unrolledPath = unrollRing([...points, candidate]);

        const lngs = unrolledPath.map((p) => p.lng);
        const span = Math.max(...lngs) - Math.min(...lngs);
        if (span >= 360) {
            return { ok: false, reason: 'WOUND_ROUND_WORLD' };
        }

        if (!pathIsSimple(unrolledPath)) {
            return { ok: false, reason: 'SELF_CROSSING' };
        }

        points.push(candidate);
        return { ok: true };
    }

    function undo() {
        points.pop();
    }

    function clear() {
        points = [];
    }

    /**
     * @returns {{ canClose: boolean, reason?: string, vertexCount: number }}
     */
    function status() {
        const vertexCount = points.length;

        if (vertexCount < CUSTOM_MAP.MIN_VERTICES) {
            return { canClose: false, reason: 'TOO_FEW', vertexCount };
        }

        const unrolled = unrollRing(points);
        if (areaKm2(unrolled) < CUSTOM_MAP.MIN_AREA_KM2) {
            return { canClose: false, reason: 'TOO_SMALL', vertexCount };
        }

        return { canClose: true, vertexCount };
    }

    /** @returns {import('./geo/polygon.js').Shape} */
    function close() {
        if (!status().canClose) {
            throw new Error('Draft.close: cannot close, canClose is false');
        }
        return makeCustomShape(points);
    }

    return {
        addPoint,
        undo,
        clear,
        status,
        close,
        get points() {
            return points.map((p) => ({ lat: p.lat, lng: p.lng }));
        },
    };
}
