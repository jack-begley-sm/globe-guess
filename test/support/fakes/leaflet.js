// ============================================================
// FILE: test/support/fakes/leaflet.js
// PURPOSE: Minimal fake of the global Leaflet `L` API, sufficient to
//          unit-test map adapters (js/custom-map.js, and later
//          js/map-overlay.js) in jsdom without loading real Leaflet or
//          hitting a tile server. Extend as later items need more of
//          the API — do not pre-build the whole surface now.
//
// DEPENDENCIES:
//   - none
//
// USED BY:
//   - test/unit/custom-map.spec.js
// ============================================================

function makeLayer(kind, args) {
    return {
        kind,
        args,
        _map: null,
        addTo(map) {
            this._map = map;
            map._layers.push(this);
            return this;
        },
        remove() {
            if (this._map) {
                const i = this._map._layers.indexOf(this);
                if (i >= 0) this._map._layers.splice(i, 1);
                this._map = null;
            }
            return this;
        },
        setLatLngs(latlngs) {
            this.args[0] = latlngs;
            return this;
        },
    };
}

function makeLatLng(lat, lng) {
    return {
        lat,
        lng,
        wrap() {
            let l = lng;
            while (l > 180) l -= 360;
            while (l < -180) l += 360;
            return makeLatLng(lat, l);
        },
    };
}

function makeMap(container, opts) {
    const handlers = {};
    return {
        container,
        opts,
        _layers: [],
        _view: null,
        setView(center, zoom) {
            this._view = { center, zoom };
            return this;
        },
        on(event, fn) {
            (handlers[event] ??= []).push(fn);
            return this;
        },
        /** Test-only: simulates a Leaflet event, e.g. fire('click', { latlng: makeLatLng(1, 2) }). */
        fire(event, payload) {
            (handlers[event] || []).forEach((fn) => fn(payload));
        },
        removeLayer(layer) {
            layer.remove();
            return this;
        },
        invalidateSize() { return this; },
        fitBounds() { return this; },
    };
}

/** Returns a fresh fake `L`. Does not install it globally — see installLeafletFake. */
export function createLeafletFake() {
    return {
        map: (container, opts) => makeMap(container, opts),
        tileLayer: (...args) => makeLayer('tileLayer', args),
        polygon: (...args) => makeLayer('polygon', args),
        circleMarker: (...args) => makeLayer('circleMarker', args),
        marker: (...args) => makeLayer('marker', args),
        latLng: makeLatLng,
    };
}

/**
 * Installs a fake L that also remembers the last map it created — the
 * usual need in a test is to reach the map instance some production
 * code created internally (e.g. js/custom-map.js), which nothing
 * exports directly. Returns { L, getLastMap() }.
 */
export function installLeafletFakeCapturingMap() {
    const fake = installLeafletFake();
    let lastMap = null;
    const originalMap = fake.map;
    fake.map = (...args) => {
        lastMap = originalMap(...args);
        return lastMap;
    };
    return { L: fake, getLastMap: () => lastMap };
}

/** Sets globalThis.L to a fresh fake and returns it — call in beforeEach. */
export function installLeafletFake() {
    const fake = createLeafletFake();
    globalThis.L = fake;
    return fake;
}
