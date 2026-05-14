// ============================================================
// FILE: js/streetview.js
// PURPOSE: Google Street View integration and random location generation.
//
// DEPENDENCIES:
//   - js/config.js      (REGIONS)
//   - js/state.js       (writes currentLocation)
//
// USED BY:
//   - js/round.js       (initializes street view for each round)
//
// KEY FUNCTIONS:
//   - initStreetView(region)         orchestrates location finding and SV loading
//   - preloadGoogleMaps()            loads Maps API on app start
//   - getRandomLocation(regionName)  returns random location coords (no pano ID)
//   - setVsStreetView(pano, id)      sets SV to specific pano for VS mode
// ============================================================

import { REGIONS } from './config.js';
import { state } from './state.js';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let svService;
let panoramas = {}; // map of containerId -> StreetViewPanorama
let isLibraryLoaded = false;

// ─────────────────────────────────────────────────────────────
// API LOADING
// ─────────────────────────────────────────────────────────────

export function preloadGoogleMaps() {
    if (window.google && window.google.maps) return;

    window.__googleMapsCallback = () => {
        isLibraryLoaded = true;
        svService = new google.maps.StreetViewService();
        console.log('Google Maps preloaded and ready');
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

function loadGoogleMaps(callback) {
    if (window.google && window.google.maps && window.google.maps.StreetViewService) {
        isLibraryLoaded = true;
        if (!svService) svService = new google.maps.StreetViewService();
        callback();
        return;
    }

    window.__googleMapsCallback = () => {
        isLibraryLoaded = true;
        svService = new google.maps.StreetViewService();
        callback();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => console.error('Google Maps failed to load');
    document.head.appendChild(script);
}

// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINTS
// ─────────────────────────────────────────────────────────────

export function initStreetView(regionName, knownLat = null, knownLng = null) {
    const container = document.getElementById('street-view-container');
    if (!container) return Promise.reject('No street-view-container found');

    return new Promise((resolve, reject) => {
        const proceed = () => {
            if (knownLat !== null && knownLng !== null) {
                // Known good coords from preload — fresh pano lookup only
                findNearestOutdoor(
                    { lat: knownLat, lng: knownLng },
                    (data) => {
                        if (!data) {
                            // Preloaded coords found nothing — fall back to full search
                            const region = REGIONS[regionName] || REGIONS.WORLD;
                            tryRandomLocation(region, 0, resolve, reject);
                            return;
                        }
                        const pos = data.location.latLng;
                        state.currentLocation = {
                            lat: pos.lat(),
                            lng: pos.lng()
                        };
                        loadPanorama(
                            data,
                            'street-view-container',
                            resolve,
                            () => {
                                // Panorama was a photosphere — retry full search
                                const region = REGIONS[regionName] || REGIONS.WORLD;
                                tryRandomLocation(region, 0, resolve, reject);
                            }
                        );
                    },
                    reject
                );
            } else {
                const region = REGIONS[regionName] || REGIONS.WORLD;
                tryRandomLocation(region, 0, resolve, reject);
            }
        };

        if (!isLibraryLoaded) {
            loadGoogleMaps(proceed);
        } else {
            proceed();
        }
    });
}

// Used by VS mode and Stitch Up to load a known pano into a specific container
export function setVsStreetView(pano, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!isLibraryLoaded) {
        loadGoogleMaps(() => setVsStreetView(pano, containerId));
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

    if (panoramas[containerId]) {
        const sv = panoramas[containerId];
        sv.setOptions(options);
        sv.setPano(pano);
    } else {
        panoramas[containerId] = new google.maps.StreetViewPanorama(container, options);
    }
}

// Returns coords only — no pano ID to avoid stale IDs between rounds
export function getRandomLocation(regionName) {
    const region = REGIONS[regionName] || REGIONS.WORLD;
    return new Promise((resolve, reject) => {
        const proceed = () => findValidCoords(region, 0, resolve, reject);
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

function tryRandomLocation(region, attempt, resolve, reject) {
    if (attempt >= 20) {
        reject(new Error('Failed to find valid Street View after 20 attempts'));
        return;
    }

    const randomLoc = generateRandomLatLng(region);

    findNearestOutdoor(randomLoc, (data) => {
        if (!data) {
            tryRandomLocation(region, attempt + 1, resolve, reject);
            return;
        }

        const pos = data.location.latLng;
        state.currentLocation = { lat: pos.lat(), lng: pos.lng() };

        loadPanorama(
            data,
            'street-view-container',
            resolve,
            () => {
                // Photosphere detected after render — retry with new location
                console.log('Retrying — photosphere detected after render');
                tryRandomLocation(region, attempt + 1, resolve, reject);
            }
        );
    }, reject);
}

// Find valid coords for preloading (returns lat/lng only, no pano)
function findValidCoords(region, attempt, resolve, reject) {
    if (attempt >= 20) {
        reject(new Error('Could not find valid Street View coords'));
        return;
    }

    const randomLoc = generateRandomLatLng(region);

    findNearestOutdoor(randomLoc, (data) => {
        if (!data) {
            findValidCoords(region, attempt + 1, resolve, reject);
            return;
        }
        const pos = data.location.latLng;
        resolve({
            lat: pos.lat(),
            lng: pos.lng(),
            pano: data.location.pano
        });
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

function findNearestOutdoor(latLng, resolve, reject, attempt = 0) {
    const radii = [1000, 5000, 10000, 25000, 50000, 100000, 200000, 500000];

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
            findNearestOutdoor(latLng, resolve, reject, attempt + 1);
            return;
        }

        if (isGoogleCarImagery(data)) {
            resolve(data);
        } else {
            findNearestOutdoor(latLng, resolve, reject, attempt + 1);
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
// HELPERS
// ─────────────────────────────────────────────────────────────

function generateRandomLatLng(region) {
    const lat = Math.random() * (region.lat[1] - region.lat[0]) + region.lat[0];
    const lng = Math.random() * (region.lng[1] - region.lng[0]) + region.lng[0];
    return { lat, lng };
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
