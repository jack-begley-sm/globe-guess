// ============================================================
// FILE: test/unit/streetview-sampling.spec.js
// PURPOSE: Unit tests for js/streetview.js's shape-based location
//          finding, against the Google Maps fake — no real network
//          call. See
//          .docs/custom-maps/05-conceptualization/S07-constrained-sampling.md.
//
// DEPENDENCIES:
//   - js/streetview.js
//   - js/geo/shapes.js (getShape)
//   - test/support/fakes/google-maps.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGoogleMapsFake, makePanoData } from '../support/fakes/google-maps.js';
import { getShape } from '../../js/geo/shapes.js';
import { CUSTOM_MAP } from '../../js/config.js';

let getRandomLocation, initStreetView;

/** streetview.js keeps module-level svService/isLibraryLoaded state, so
 *  each test needs a fresh module import bound to its own fake. */
async function freshStreetView(handler) {
    const { google, calls } = createGoogleMapsFake(handler);
    globalThis.google = google;
    vi.resetModules();
    const mod = await import('../../js/streetview.js');
    getRandomLocation = mod.getRandomLocation;
    initStreetView = mod.initStreetView;
    return calls;
}

beforeEach(() => {
    document.body.innerHTML = '<div id="street-view-container"></div>';
});

describe('getRandomLocation(shape)', () => {
    it('resolves with coords from a pano found on the first attempt', async () => {
        await freshStreetView(() => ({ status: 'OK', data: makePanoData({ lat: 51, lng: 0 }) }));
        const loc = await getRandomLocation(getShape('UK'));
        expect(loc).toEqual({ lat: 51, lng: 0, pano: 'FAKE_PANO' });
    });

    it('answers a scripted pano at an exact radius — the fake logs the requested radius', async () => {
        const calls = await freshStreetView((request, i) => {
            // Found only once the ladder reaches 25000m.
            if (request.radius >= 25000) return { status: 'OK', data: makePanoData({ lat: 51, lng: 0 }) };
            return { status: 'ZERO_RESULTS' };
        });
        await getRandomLocation(getShape('UK'));
        expect(calls.some((c) => c.radius === 25000)).toBe(true);
        expect(calls.every((c) => typeof c.radius === 'number')).toBe(true);
    });

    it('makes no real network call — everything routes through the fake', async () => {
        const calls = await freshStreetView(() => ({ status: 'OK', data: makePanoData({ lat: 51, lng: 0 }) }));
        await getRandomLocation(getShape('UK'));
        expect(calls.length).toBeGreaterThan(0); // proves the fake, not a real fetch, was hit
    });

    it('rejects after 20 failed attempts', async () => {
        await freshStreetView(() => ({ status: 'ZERO_RESULTS' }));
        await expect(getRandomLocation(getShape('UK'))).rejects.toThrow();
    });

    it('never requests a radius beyond the shape-scaled cap', async () => {
        const calls = await freshStreetView(() => ({ status: 'ZERO_RESULTS' }));
        await expect(getRandomLocation(getShape('UK'))).rejects.toThrow();
        const capMeters = getShape('UK').scaleKm * 1000 * CUSTOM_MAP.MAX_SEARCH_FRACTION;
        expect(calls.length).toBeGreaterThan(0);
        expect(calls.every((c) => c.radius <= capMeters)).toBe(true);
        expect(calls.some((c) => c.radius === 500000)).toBe(false); // UK's cap excludes the top rung
    });

    it('resamples when a found pano has drifted outside the shape (containment backstop)', async () => {
        let callCount = 0;
        const calls = await freshStreetView(() => {
            callCount++;
            if (callCount === 1) {
                // First found pano is genuinely outside the UK shape.
                return { status: 'OK', data: makePanoData({ pano: 'OUTSIDE', lat: 0, lng: 0 }) };
            }
            return { status: 'OK', data: makePanoData({ pano: 'INSIDE', lat: 51, lng: 0 }) };
        });
        const loc = await getRandomLocation(getShape('UK'));
        expect(loc).toEqual({ lat: 51, lng: 0, pano: 'INSIDE' });
        expect(calls.length).toBeGreaterThan(1);
    });
});

describe('initStreetView(shape, lat, lng)', () => {
    it('loads a panorama for known preloaded coordinates', async () => {
        await freshStreetView(() => ({ status: 'OK', data: makePanoData({ lat: 51, lng: 0 }) }));
        await expect(initStreetView(getShape('UK'), 51, 0)).resolves.toBeUndefined();
    });

    it('falls back to a full search when the preloaded coords find nothing', async () => {
        let attempt = 0;
        const calls = await freshStreetView(() => {
            attempt++;
            // First call (from the known-coords lookup) fails; subsequent
            // random-search calls succeed immediately.
            if (attempt <= 8) return { status: 'ZERO_RESULTS' };
            return { status: 'OK', data: makePanoData({ lat: 51, lng: 0 }) };
        });
        await expect(initStreetView(getShape('UK'), 51, 0)).resolves.toBeUndefined();
        expect(calls.length).toBeGreaterThan(8);
    });
});
