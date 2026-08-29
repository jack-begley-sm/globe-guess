// ============================================================
// FILE: test/support/fakes/google-maps.js
// PURPOSE: Scripted fake of the global `google.maps` Street View API,
//          sufficient to test js/streetview.js without a real network
//          call. A `handler(request, callIndex)` function decides each
//          getPanorama response, so tests can script "found at this
//          radius" or "never found" without needing to predict exact
//          sampled coordinates. See
//          .docs/custom-maps/05-conceptualization/S07-constrained-sampling.md.
//
// DEPENDENCIES:
//   - none
//
// USED BY:
//   - test/unit/streetview-sampling.spec.js
// ============================================================

/**
 * A well-formed getPanorama() result data object. `carImagery: false`
 * or `linkCount < 2` produces a result that is found but rejected —
 * the former by `isGoogleCarImagery`, the latter as a photosphere.
 */
export function makePanoData({ pano = 'FAKE_PANO', lat = 0, lng = 0, linkCount = 2, carImagery = true } = {}) {
    return {
        location: {
            pano,
            latLng: { lat: () => lat, lng: () => lng },
        },
        tiles: carImagery
            ? { worldSize: { width: 16384, height: 8192 } }
            : { worldSize: { width: 512, height: 256 } },
        copyright: carImagery ? '© Google' : '© Contributor',
        links: Array.from({ length: linkCount }, (_, i) => ({ heading: i * 10 })),
    };
}

/**
 * @param {(request: { location: object, radius: number }, callIndex: number) => ({ status: 'OK', data: object } | { status: 'ZERO_RESULTS' })} handler
 * @returns {{ google: object, calls: object[] }}
 */
export function createGoogleMapsFake(handler) {
    let callIndex = 0;
    const calls = [];
    // Real getLinks() looks links up server-side by pano ID; the fake
    // needs the same indirection so a StreetViewPanorama constructed
    // later with just a pano ID can still report the right link count.
    const linksByPano = {};

    class StreetViewService {
        getPanorama(request, callback) {
            calls.push({ location: request.location, radius: request.radius });
            const result = handler(request, callIndex++);
            if (result && result.status === 'OK') {
                linksByPano[result.data.location.pano] = result.data.links;
                callback(result.data, 'OK');
            } else {
                callback(null, 'ZERO_RESULTS');
            }
        }
    }

    class StreetViewPanorama {
        constructor(container, options) {
            this.container = container;
            this.options = { ...options };
            this._listeners = {};
            // Real Street View fires pano_changed once a pano set via the
            // constructor finishes loading, same as an explicit setPano().
            if (this.options.pano) {
                queueMicrotask(() => event.trigger(this, 'pano_changed'));
            }
        }
        setOptions(o) { Object.assign(this.options, o); }
        setPano(pano) {
            this.options.pano = pano;
            queueMicrotask(() => event.trigger(this, 'pano_changed'));
        }
        getLinks() {
            return linksByPano[this.options.pano] || [];
        }
    }

    const event = {
        addListenerOnce(target, evt, cb) {
            (target._listeners[evt] ??= []).push(cb);
        },
        clearInstanceListeners(target) {
            target._listeners = {};
        },
        trigger(target, evt) {
            (target._listeners[evt] || []).forEach((cb) => cb());
        },
    };

    const google = {
        maps: {
            StreetViewService,
            StreetViewPanorama,
            StreetViewStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS' },
            StreetViewSource: { OUTDOOR: 'OUTDOOR', DEFAULT: 'DEFAULT' },
            StreetViewPreference: { NEAREST: 'NEAREST', BEST: 'BEST' },
            event,
        },
    };

    return { google, calls };
}
