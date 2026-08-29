// ============================================================
// FILE: js/streetview.js
// PURPOSE: Google Street View integration and random location generation.
//
// DEPENDENCIES:
//   - js/state.js               (writes currentLocation)
//   - js/geo/polygon-measure.js (randomPointInShape)
//   - js/geo/polygon.js         (containsPoint)
//   - js/config.js              (CUSTOM_MAP.MAX_SEARCH_FRACTION)
//
// USED BY:
//   - js/round.js       (initializes street view for each round)
//
// KEY FUNCTIONS:
//   - initStreetView(shape)         orchestrates location finding and SV loading
//   - preloadGoogleMaps()           loads Maps API on app start
//   - getRandomLocation(shape)      returns random location coords (no pano ID)
//   - setVsStreetView(pano, id)     sets SV to specific pano for VS mode
//   - resizeVisiblePanoramas()      forces all visible panoramas to recompute size
// ============================================================

import { state } from './state.js';
import { randomPointInShape } from './geo/polygon-measure.js';
import { containsPoint } from './geo/polygon.js';
import { CUSTOM_MAP } from './config.js';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let svService;
let panoramas = {}; // map of containerId -> StreetViewPanorama
let isLibraryLoaded = false;

// ─────────────────────────────────────────────────────────────
// API LOADING
// ─────────────────────────────────────────────────────────────
// Google's Maps bootstrap loader isn't designed to be injected twice. Doing so
// clobbers window.__googleMapsCallback and is a documented cause of the loader
// rendering a consent/privacy overlay. We append the <script> once and queue any
// callers that need the API until the (single) script's async callback fires.

let _mapsScriptInjected = false;
const _mapsCallbacks = [];

function drainMapsCallbacks() {
    _mapsScriptInjected = false;
    const pending = _mapsCallbacks.splice(0);
    pending.forEach(cb => {
        try { cb(); } catch (err) { console.error('Maps callback error:', err); }
    });
}

function injectGoogleMapsScript() {
    window.__googleMapsCallback = () => {
        isLibraryLoaded = true;
        svService = new google.maps.StreetViewService();
        console.log('Google Maps loaded');
        drainMapsCallbacks();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
        console.error('Google Maps failed to load');
        _mapsScriptInjected = false;
        const pending = _mapsCallbacks.splice(0);
        pending.forEach(cb => {
            try { cb(new Error('Google Maps failed to load')); } catch (err) { /* ignore */ }
        });
    };
    document.head.appendChild(script);
}

export function preloadGoogleMaps() {
    if (window.google && window.google.maps) return;

    if (!_mapsScriptInjected) {
        _mapsScriptInjected = true;
        injectGoogleMapsScript();
    }
}

function loadGoogleMaps(callback) {
    if (window.google && window.google.maps && window.google.maps.StreetViewService) {
        isLibraryLoaded = true;
        if (!svService) svService = new google.maps.StreetViewService();
        callback();
        return;
    }

    if (_mapsScriptInjected) {
        // A script is already mid-flight (e.g. from preloadGoogleMaps on app load).
        // Queue our caller instead of injecting a second script tag.
        _mapsCallbacks.push(callback);
        return;
    }

    _mapsScriptInjected = true;
    _mapsCallbacks.push(callback);
    injectGoogleMapsScript();
}

// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINTS
// ─────────────────────────────────────────────────────────────

export function initStreetView(shape, knownLat = null, knownLng = null) {
    const container = document.getElementById('street-view-container');
    if (!container) return Promise.reject('No street-view-container found');

    return new Promise((resolve, reject) => {
        const proceed = () => {
            if (knownLat !== null && knownLng !== null) {
                // Known good coords from preload — fresh pano lookup only
                findNearestOutdoor(
                    { lat: knownLat, lng: knownLng },
                    shape,
                    (data) => {
                        if (!data) {
                            // Preloaded coords found nothing — fall back to full search
                            tryRandomLocation(shape, 0, resolve, reject);
                            return;
                        }
                        const pos = { lat: data.location.latLng.lat(), lng: data.location.latLng.lng() };
                        if (!containsPoint(pos, shape)) {
                            // Found pano drifted outside the shape — resample.
                            tryRandomLocation(shape, 0, resolve, reject);
                            return;
                        }
                        state.currentLocation = pos;
                        loadPanorama(
                            data,
                            'street-view-container',
                            resolve,
                            () => {
                                // Panorama was a photosphere — retry full search
                                tryRandomLocation(shape, 0, resolve, reject);
                            }
                        );
                    },
                    reject
                );
            } else {
                tryRandomLocation(shape, 0, resolve, reject);
            }
        };

        if (!isLibraryLoaded) {
            loadGoogleMaps(proceed);
        } else {
            proceed();
        }
    });
}

// Used by VS mode and Stitch Up to load a known pano into a specific container.
// onReady (optional) fires once the panorama has actually rendered — or after a
// 4s fallback — so callers can defer things like starting a round timer until
// the player can actually see the panorama, rather than while it's still loading.
export function setVsStreetView(pano, containerId, onReady) {
    const container = document.getElementById(containerId);
    if (!container) {
        if (onReady) onReady();
        return;
    }

    if (!isLibraryLoaded) {
        loadGoogleMaps(() => setVsStreetView(pano, containerId, onReady));
        return;
    }

    const options = {
        addressControl: false,
        showRoadLabels: false,
        zoomControl: false,
        panControl: false,
        enableCloseButton: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        linksControl: true,
        clickToGo: true,
        pano: pano
    };

    let sv;
    if (panoramas[containerId]) {
        sv = panoramas[containerId];
        sv.setOptions(options);
        sv.setPano(pano);
    } else {
        sv = new google.maps.StreetViewPanorama(container, options);
        panoramas[containerId] = sv;
    }

    // Reused panorama instances don't recompute their internal size on their own
    // (this is what caused the "tiny box top-left" regression when continuing to
    // a new game in the same lobby — the container was hidden/shown again but the
    // existing StreetViewPanorama kept whatever size it last measured). Force a
    // resize once the container has settled into its real, final layout box.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            google.maps.event.trigger(sv, 'resize');
        });
    });

    if (onReady) {
        let resolved = false;
        const finish = () => {
            if (resolved) return;
            resolved = true;
            onReady();
        };
        google.maps.event.addListenerOnce(sv, 'pano_changed', () => setTimeout(finish, 500));
        setTimeout(finish, 4000);
    }
}

// Returns coords only — no pano ID to avoid stale IDs between rounds
export function getRandomLocation(shape) {
    return new Promise((resolve, reject) => {
        const proceed = () => findValidCoords(shape, 0, resolve, reject);
        if (!isLibraryLoaded) {
            loadGoogleMaps(proceed);
        } else {
            proceed();
        }
    });
}

// ─────────────────────────────────────────────────────────────
// LOCATION FINDING
// ─────────────────────────────────────────────────────────────

function tryRandomLocation(shape, attempt, resolve, reject) {
    if (attempt >= 20) {
        reject(new Error('Failed to find valid Street View after 20 attempts'));
        return;
    }

    const randomLoc = randomPointInShape(shape);
    if (!randomLoc) {
        // Sampling budget exhausted for this attempt (a thin shape) — try again.
        tryRandomLocation(shape, attempt + 1, resolve, reject);
        return;
    }

    findNearestOutdoor(randomLoc, shape, (data) => {
        if (!data) {
            tryRandomLocation(shape, attempt + 1, resolve, reject);
            return;
        }

        const pos = { lat: data.location.latLng.lat(), lng: data.location.latLng.lng() };
        if (!containsPoint(pos, shape)) {
            // Found pano drifted outside the shape — resample.
            tryRandomLocation(shape, attempt + 1, resolve, reject);
            return;
        }
        state.currentLocation = pos;

        loadPanorama(
            data,
            'street-view-container',
            resolve,
            () => {
                // Photosphere detected after render — retry with new location
                console.log('Retrying — photosphere detected after render');
                tryRandomLocation(shape, attempt + 1, resolve, reject);
            }
        );
    }, reject);
}

// Find valid coords for preloading (returns lat/lng only, no pano)
function findValidCoords(shape, attempt, resolve, reject) {
    if (attempt >= 20) {
        reject(new Error('Could not find valid Street View coords'));
        return;
    }

    const randomLoc = randomPointInShape(shape);
    if (!randomLoc) {
        findValidCoords(shape, attempt + 1, resolve, reject);
        return;
    }

    findNearestOutdoor(randomLoc, shape, (data) => {
        if (!data) {
            findValidCoords(shape, attempt + 1, resolve, reject);
            return;
        }
        const pos = { lat: data.location.latLng.lat(), lng: data.location.latLng.lng() };
        if (!containsPoint(pos, shape)) {
            // Found pano drifted outside the shape — resample.
            findValidCoords(shape, attempt + 1, resolve, reject);
            return;
        }
        resolve({ ...pos, pano: data.location.pano });
    }, reject);
}

export function isGoogleCarImagery(data) {
    if (!data || !data.tiles || !data.location) return false;
    
    // Check for standard Google Car dimensions
    const isStandardRes = (
        data.tiles.worldSize?.width >= 16384 &&
        data.tiles.worldSize?.height >= 8192
    );
    
    // Check for official copyright
    const isOfficial = data.copyright && data.copyright.includes('Google');
    
    // Official car imagery almost always has links to next/prev panos
    const hasLinks = data.links && data.links.length >= 2;

    return (isStandardRes || isOfficial) && hasLinks;
}

/**
 * The radii ladder, capped by the shape's own scale — a wide search on a
 * small custom area would happily return a pano far outside it. Not a
 * substitute for the containment re-check after this resolves (a found
 * pano can still drift outside the shape near a boundary at any radius);
 * this just avoids searching further than the shape could ever need to.
 */
function radiiFor(shape) {
    const allRadii = [1000, 5000, 10000, 25000, 50000, 100000, 200000, 500000];
    const capMeters = shape.scaleKm * 1000 * CUSTOM_MAP.MAX_SEARCH_FRACTION;
    return allRadii.filter((r) => r <= capMeters);
}

function findNearestOutdoor(latLng, shape, resolve, reject, attempt = 0) {
    const radii = radiiFor(shape);

    if (attempt >= radii.length) {
        resolve(null); // signal caller to try new random coordinate
        return;
    }

    svService.getPanorama({
        location: latLng,
        radius: radii[attempt],
        source: google.maps.StreetViewSource.OUTDOOR,
        preference: google.maps.StreetViewPreference.NEAREST
    }, (data, status) => {
        if (status !== google.maps.StreetViewStatus.OK) {
            findNearestOutdoor(latLng, shape, resolve, reject, attempt + 1);
            return;
        }

        if (isGoogleCarImagery(data)) {
            resolve(data);
        } else {
            findNearestOutdoor(latLng, shape, resolve, reject, attempt + 1);
        }
    });
}

// ─────────────────────────────────────────────────────────────
// PANORAMA LOADING WITH PHOTOSPHERE DETECTION
// ─────────────────────────────────────────────────────────────

function loadPanorama(data, containerId, resolve, onPhotosphere) {
    const container = document.getElementById(containerId);
    if (!container) {
        resolve();
        return;
    }

    const options = {
        addressControl: false,
        showRoadLabels: false,
        zoomControl: false,
        panControl: false,
        enableCloseButton: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        linksControl: true,
        clickToGo: true,
        pano: data.location.pano
    };

    let sv;
    if (panoramas[containerId]) {
        sv = panoramas[containerId];
        google.maps.event.clearInstanceListeners(sv);
        sv.setOptions(options);
        sv.setPano(data.location.pano);

        // See the matching comment in setVsStreetView — reused panoramas need an
        // explicit resize nudge once the container's final layout box is settled.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                google.maps.event.trigger(sv, 'resize');
            });
        });
    } else {
        sv = new google.maps.StreetViewPanorama(container, options);
        panoramas[containerId] = sv;
    }

    let resolved = false;

    const checkPanorama = () => {
        if (resolved) return;
        resolved = true;
        const links = sv.getLinks();
        if (links && links.length >= 2) {
            resolve();
        } else {
            console.log('Photosphere detected — retrying');
            onPhotosphere();
        }
    };

    google.maps.event.addListenerOnce(sv, 'pano_changed', () => {
        setTimeout(checkPanorama, 500);
    });

    setTimeout(() => {
        if (!resolved) {
            console.log('pano_changed never fired — forcing resolve');
            resolved = true;
            resolve();
        }
    }, 4000);
}

// ─────────────────────────────────────────────────────────────
// VIEWPORT RESIZE HANDLING (iOS Safari dynamic toolbar)
// ─────────────────────────────────────────────────────────────
// Mobile Safari resizes the *visual* viewport as its address bar/toolbar
// collapses or expands, without reliably firing a plain `resize` event that
// Street View's own internal sizing reacts to. A panorama built (or last
// measured) while the toolbar was showing can end up permanently short —
// leaving a gap at the bottom of the real screen that a player joining via a
// shared Safari link (rather than the installed app, which has no toolbar to
// begin with) is far more likely to hit. Re-measure on every visualViewport
// change so the panorama tracks the real visible area.
export function resizeVisiblePanoramas() {
    if (!(window.google && window.google.maps)) return;
    Object.entries(panoramas).forEach(([containerId, sv]) => {
        const el = document.getElementById(containerId);
        if (el && el.offsetParent !== null) {
            google.maps.event.trigger(sv, 'resize');
        }
    });
}

if (typeof window !== 'undefined') {
    const scheduleResize = () => requestAnimationFrame(resizeVisiblePanoramas);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleResize);
    }
    window.addEventListener('orientationchange', () => setTimeout(resizeVisiblePanoramas, 300));
}

export function lockStreetView(containerId) {
    const sv = panoramas[containerId];
    if (sv) {
        sv.setOptions({ clickToGo: false, linksControl: false });
    }
    const container = document.getElementById(containerId);
    if (container) container.style.pointerEvents = 'none';
}

export function unlockStreetView(containerId) {
    const sv = panoramas[containerId];
    if (sv) {
        sv.setOptions({ clickToGo: true, linksControl: true });
    }
    const container = document.getElementById(containerId);
    if (container) container.style.pointerEvents = '';
}
