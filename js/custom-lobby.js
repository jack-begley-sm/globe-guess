// ============================================================
// FILE: js/custom-lobby.js
// PURPOSE: Generic Custom-area draw-screen engine — wires the drawing
//          buttons and maps rejection reasons to English hints, but
//          decides nothing about what a confirmed area means. Any mode
//          (Classic today; VS/Co-op/Stitch Up once S10/S11 land) opens
//          it by calling openCustomDraw() and owns its own reaction to
//          the result via the onConfirm callback it supplies. See
//          .docs/custom-maps/05-conceptualization/S06-draw-screen.md.
//
// DEPENDENCIES:
//   - js/custom-draft.js (createDraft)
//   - js/custom-map.js (initCustomMap)
//
// USED BY:
//   - main.js (calls initCustomDraw() at startup)
//   - js/lobby.js (calls openCustomDraw() from Classic's region grid)
//
// KEY FUNCTIONS:
//   - initCustomDraw()               wires the draw screen's own buttons
//   - openCustomDraw(originScreenId, onConfirm)   opens the draw screen
//     from the caller's current screen; onConfirm(shape) runs on confirm
//   - resetClassicLobbyRegionUI()    restores the plain region-grid view,
//     for when Classic is entered without going through Custom
// ============================================================
import { createDraft } from './custom-draft.js';
import { initCustomMap } from './custom-map.js';

const REASON_TEXT = {
    TOO_FEW: 'Add at least 3 points to make an area.',
    TOO_MANY: "That's as detailed as an area can get.",
    SELF_CROSSING: 'That point would make the area cross itself.',
    WOUND_ROUND_WORLD: 'That point would wrap the area all the way round the world.',
    TOO_SMALL: 'This area is too small to guarantee a street.',
};

let draft = null;
let mapAdapter = null;
let returnScreenId = null;
let onConfirmCallback = null;

export function initCustomDraw() {
    document.getElementById('btn-custom-undo')?.addEventListener('click', () => {
        draft.undo();
        mapAdapter.redraw();
        updateHint(null);
    });

    document.getElementById('btn-custom-clear')?.addEventListener('click', () => {
        draft.clear();
        mapAdapter.redraw();
        updateHint(null);
    });

    document.getElementById('btn-custom-confirm')?.addEventListener('click', confirmArea);
    document.getElementById('btn-custom-back')?.addEventListener('click', backToOrigin);
}

/**
 * Opens the draw screen from the caller's own current screen
 * (`originScreenId`) — "back" and a rejected confirm both return there.
 * `onConfirm(shape)` is however the caller wants to react to a
 * confirmed area (Classic: set state.shape/region and show the area
 * summary); this module only draws, it doesn't decide what a shape means.
 */
export function openCustomDraw(originScreenId, onConfirm) {
    // Re-entering Custom (e.g. after "back") must not call L.map() on a
    // container that already has a live map bound to it — Leaflet throws
    // "Map container is already initialized." Destroy the old one first;
    // same pattern js/su-guesser.js already uses for its own rebuilt-
    // every-turn map.
    if (mapAdapter) {
        mapAdapter.map.remove();
        mapAdapter = null;
    }

    draft = createDraft();
    returnScreenId = originScreenId;
    onConfirmCallback = onConfirm;
    document.getElementById(originScreenId).classList.add('hidden');
    document.getElementById('screen-custom-draw').classList.remove('hidden');
    mapAdapter = initCustomMap('custom-map', draft, { onAddPointResult: handleAddPointResult });
    updateHint(null);
}

function handleAddPointResult(result) {
    updateHint(result.ok ? null : result.reason);
}

function updateHint(reason) {
    const hint = document.getElementById('custom-draw-hint');
    if (reason) {
        hint.textContent = REASON_TEXT[reason] || 'That tap was rejected.';
        hint.classList.remove('hidden');
    } else {
        hint.classList.add('hidden');
    }
    document.getElementById('btn-custom-confirm').disabled = !draft.status().canClose;
}

function confirmArea() {
    // status()/close() are now the source of truth for every rejection
    // reason, so this should never actually throw — but it's the one
    // place an unhandled throw would otherwise escape a click listener
    // silently (no navigation, no message, button stays enabled), so
    // catching it and surfacing something is cheap insurance against
    // the next geometry edge case nobody's thought of yet.
    let shape;
    try {
        shape = draft.close();
    } catch (err) {
        console.error('confirmArea: draft.close() threw unexpectedly', err);
        updateHint('SELF_CROSSING');
        return;
    }

    document.getElementById('screen-custom-draw').classList.add('hidden');
    document.getElementById(returnScreenId).classList.remove('hidden');
    onConfirmCallback(shape);
}

function backToOrigin() {
    if (mapAdapter) mapAdapter.map.remove();
    draft = null;
    mapAdapter = null;
    document.getElementById('screen-custom-draw').classList.add('hidden');
    document.getElementById(returnScreenId).classList.remove('hidden');
}

/** Called when Classic is entered directly (not via Custom), so a
 *  previously-confirmed custom area's summary doesn't linger. */
export function resetClassicLobbyRegionUI() {
    document.getElementById('section-region').classList.remove('hidden');
    document.getElementById('custom-area-summary').classList.add('hidden');
}

/**
 * Sends the player back to the draw screen with their already-drawn
 * area intact (js/streetview.js's NoStreetViewInArea case) — the
 * draft from the confirm that got them here is still alive in this
 * module, so redrawing it is enough; nothing needs re-fetching. A
 * no-op if reached without a live draft (round started some other way
 * than through Custom in this page load — the caller should not have
 * called this in the first place).
 */
export function returnToDrawScreenWithMessage(message) {
    if (!draft || !mapAdapter) return;

    document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    document.getElementById('screen-custom-draw').classList.remove('hidden');
    mapAdapter.redraw();

    const hint = document.getElementById('custom-draw-hint');
    hint.textContent = message;
    hint.classList.remove('hidden');
    document.getElementById('btn-custom-confirm').disabled = !draft.status().canClose;
}
