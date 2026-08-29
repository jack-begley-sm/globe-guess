// ============================================================
// FILE: js/custom-lobby.js
// PURPOSE: Wires the Custom-mode draw screen's buttons, maps drawing
//          rejection reasons to English hint text, and hands the
//          confirmed area into the Classic lobby's game options. See
//          .docs/custom-maps/05-conceptualization/S06-draw-screen.md.
//
// DEPENDENCIES:
//   - js/custom-draft.js (createDraft)
//   - js/custom-map.js (initCustomMap)
//   - js/state.js (writes state.shape / state.region on confirm)
//
// USED BY:
//   - main.js (calls initCustomDraw() at startup, and shows the draw
//     screen when the landing tile is clicked)
//
// KEY FUNCTIONS:
//   - initCustomDraw()   wires every button on screen-custom-draw
//   - resetClassicLobbyRegionUI()   restores the plain region-grid view,
//     for when Classic is entered without going through Custom
// ============================================================
import { createDraft } from './custom-draft.js';
import { initCustomMap } from './custom-map.js';
import { state } from './state.js';

const REASON_TEXT = {
    TOO_FEW: 'Add at least 3 points to make an area.',
    TOO_MANY: "That's as detailed as an area can get.",
    SELF_CROSSING: 'That point would make the area cross itself.',
    WOUND_ROUND_WORLD: 'That point would wrap the area all the way round the world.',
    TOO_SMALL: 'This area is too small to guarantee a street.',
};

let draft = null;
let mapAdapter = null;

export function initCustomDraw() {
    const customTile = document.getElementById('btn-mode-custom');
    if (customTile) customTile.addEventListener('click', openDrawScreen);

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
    document.getElementById('btn-custom-back')?.addEventListener('click', backToHome);
}

function openDrawScreen() {
    draft = createDraft();
    document.getElementById('screen-landing').classList.add('hidden');
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
    const shape = draft.close();
    state.shape = shape;
    state.region = 'CUSTOM';

    document.getElementById('screen-custom-draw').classList.add('hidden');
    document.getElementById('screen-lobby').classList.remove('hidden');
    document.getElementById('section-region').classList.add('hidden');

    const summary = document.getElementById('custom-area-summary');
    summary.textContent = `Custom area: about ${Math.round(shape.scaleKm)} km across`;
    summary.classList.remove('hidden');
}

function backToHome() {
    draft = null;
    mapAdapter = null;
    document.getElementById('screen-custom-draw').classList.add('hidden');
    document.getElementById('screen-landing').classList.remove('hidden');
}

/** Called when Classic is entered directly (not via Custom), so a
 *  previously-confirmed custom area's summary doesn't linger. */
export function resetClassicLobbyRegionUI() {
    document.getElementById('section-region').classList.remove('hidden');
    document.getElementById('custom-area-summary').classList.add('hidden');
}
