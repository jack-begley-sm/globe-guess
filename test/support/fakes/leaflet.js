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

function makeMap(container, opts, onRemove) {
    const handlers = {};
    return {
        container,
        opts,
        _layers: [],
        _view: null,
        _removed: false,
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
        fitBounds(bounds) { this._fitBounds = bounds; return this; },
        setMaxBounds(bounds) { this._maxBounds = bounds; return this; },
        /** Matches real Leaflet: frees the container so a later L.map()
         *  call on it doesn't throw. Production code (js/custom-lobby.js,
         *  js/su-guesser.js) relies on this before rebuilding a map. */
        remove() {
            this._removed = true;
            onRemove?.();
            return this;
        },
    };
}

let _idCounter = 0;

/** Resolves a container argument to the real DOM element, when given a
 *  string id — matches real Leaflet, which accepts either. Falls back
 *  to the raw value outside a DOM environment or for a bare string with
 *  no matching element (some tests use nonsense ids on purpose). */
function resolveContainerElement(container) {
    if (typeof container === 'string' && typeof document !== 'undefined') {
        return document.getElementById(container) || null;
    }
    return typeof container === 'object' ? container : null;
}

/** Returns a fresh fake `L`. Does not install it globally — see installLeafletFake. */
export function createLeafletFake() {
    // Real Leaflet marks a container with `_leaflet_id` and throws "Map
    // container is already initialized." on a second L.map() call unless
    // that's cleared first — a real constraint production code has to
    // respect. Two different places in this codebase clear it two
    // different ways: js/custom-lobby.js and js/su-guesser.js call the
    // proper map.remove(); js/result-map.js instead does what real
    // Leaflet's own DOM cleanup does by hand (wipe the container's
    // innerHTML, null out `_leaflet_id` directly) without ever holding a
    // reference to the old map object. Setting `_leaflet_id` on the real
    // DOM element (not a private Set here) is what makes both of those
    // legitimate patterns work against the fake, instead of only
    // whichever one this file happened to be written to expect.
    function map(container, opts) {
        const el = resolveContainerElement(container);
        if (el && el._leaflet_id) {
            throw new Error('Map container is already initialized.');
        }
        if (el) el._leaflet_id = ++_idCounter;
        return makeMap(container, opts, () => { if (el) el._leaflet_id = null; });
    }

    return {
        map,
        DomUtil: { get: (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null) },
        tileLayer: (...args) => makeLayer('tileLayer', args),
        polygon: (...args) => makeLayer('polygon', args),
        circleMarker: (...args) => makeLayer('circleMarker', args),
        marker: (...args) => makeLayer('marker', args),
        polyline: (...args) => makeLayer('polyline', args),
        divIcon: (opts) => ({ kind: 'divIcon', opts }),
        // A real function, not an arrow one — production code calls this
        // with `new`, which arrow functions can't support.
        featureGroup: function (layers) {
            this.kind = 'featureGroup';
            this.layers = layers;
            this.getBounds = () => ({});
        },
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
