// ============================================================
// FILE: js/awards.js
// PURPOSE: Persist awards earned across all game sessions and
//          render the awards panel on the landing screen.
//
// DEPENDENCIES:
//   - js/user.js    (getUser — to identify the local player)
//
// USED BY:
//   - js/results.js     (calls saveSoloAwards)
//   - js/vs-results.js  (calls saveVsAwards)
//   - js/su-results.js  (calls saveSuAwards)
//   - index.html        (loaded as a module; self-initialises the
//                        trophy button and panel listeners)
//
// STORAGE:
//   localStorage key: 'globe_guess_awards'
//   Shape: { [awardKey]: { count, firstEarned, lastEarned } }
//
// KEY EXPORTS:
//   - saveSoloAwards(awards)            called after solo results
//   - saveVsAwards(awards, localName)   called after VS results
//   - saveSuAwards(awards, localName)   called after SU results
//   - openAwardsPanel()                 can be called externally
// ============================================================

const STORAGE_KEY = 'globe_guess_awards';

// ── Award catalogue ────────────────────────────────────────────────────────────
// Single source of truth for every award that can be persisted.
// `key` must be stable — it is the localStorage key fragment.

export const AWARD_DEFS = [
    // Solo / Classic Mode
    { key: 'solo_sharpshooter', icon: '🎯', title: 'Sharpshooter', mode: 'SOLO', desc: 'A single guess within 50 km' },
    { key: 'solo_globetrotter', icon: '🌍', title: 'Globetrotter', mode: 'SOLO', desc: 'Every guess within 500 km' },
    { key: 'solo_on_fire',      icon: '🔥', title: 'On Fire',      mode: 'SOLO', desc: '3+ consecutive guesses within 300 km' },
    { key: 'solo_lost_at_sea',  icon: '💀', title: 'Lost at Sea',  mode: 'SOLO', desc: 'A single guess more than 5,000 km off' },
    { key: 'solo_high_scorer',  icon: '🏆', title: 'High Scorer',  mode: 'SOLO', desc: 'Averaged over 4,000 pts per round' },
    { key: 'solo_consistent',   icon: '🎰', title: 'Consistent',   mode: 'SOLO', desc: 'No guess more than double your average distance' },
    // VS Mode
    { key: 'vs_sharpshooter',       icon: '🎯', title: 'Sharpshooter',       mode: 'VS',        desc: 'Closest single guess in a VS game' },
    { key: 'vs_speed_demon',        icon: '⚡', title: 'Speed Demon',         mode: 'VS',        desc: 'Fastest average submission in a VS game' },
    { key: 'vs_lost_at_sea',        icon: '💀', title: 'Lost at Sea',         mode: 'VS',        desc: 'Furthest single guess in a VS game' },
    { key: 'vs_globetrotter',       icon: '🌍', title: 'Globetrotter',        mode: 'VS',        desc: 'Most consistent distances in a VS game' },
    { key: 'vs_taking_their_time',  icon: '🐢', title: 'Taking Their Time',   mode: 'VS',        desc: 'Slowest average submission in a VS game' },
    // Stitch Up Mode
    { key: 'su_master_stitcher',    icon: '🎯', title: 'Master Stitcher',     mode: 'STITCH UP', desc: 'Caused the most total distance as Setter' },
    { key: 'su_escape_artist',      icon: '🗺️',  title: 'Escape Artist',       mode: 'STITCH UP', desc: 'Best average Guesser score in the game' },
    { key: 'su_hair_trigger',       icon: '⚡', title: 'Hair Trigger',         mode: 'STITCH UP', desc: 'Fastest Setter placement in the game' },
    { key: 'su_deep_thinker',       icon: '🐢', title: 'Deep Thinker',         mode: 'STITCH UP', desc: 'Slowest Setter placement in the game' },
    { key: 'su_lucky_escape',       icon: '🎰', title: 'Lucky Escape',         mode: 'STITCH UP', desc: 'Scored highest on the cruellest location' },
    { key: 'su_ruthless',           icon: '💀', title: 'Ruthless',             mode: 'STITCH UP', desc: 'Highest average distance caused as Setter' },
    { key: 'su_too_kind',           icon: '🤝', title: 'Too Kind',             mode: 'STITCH UP', desc: 'Lowest average distance caused as Setter' },
    { key: 'su_all_rounder',        icon: '🏆', title: 'All-Rounder',          mode: 'STITCH UP', desc: 'Highest combined total score' },
];

// Maps the `title` string from each calculateAwards() → storage key
const SOLO_TITLE_TO_KEY = {
    'Sharpshooter': 'solo_sharpshooter',
    'Globetrotter': 'solo_globetrotter',
    'On Fire':      'solo_on_fire',
    'Lost at Sea':  'solo_lost_at_sea',
    'High Scorer':  'solo_high_scorer',
    'Consistent':   'solo_consistent',
};

const VS_TITLE_TO_KEY = {
    'Sharpshooter':      'vs_sharpshooter',
    'Speed Demon':       'vs_speed_demon',
    'Lost at Sea':       'vs_lost_at_sea',
    'Globetrotter':      'vs_globetrotter',
    'Taking Their Time': 'vs_taking_their_time',
};

const SU_TITLE_TO_KEY = {
    'Master Stitcher':   'su_master_stitcher',
    'Escape Artist':     'su_escape_artist',
    'Hair Trigger':      'su_hair_trigger',
    'Deep Thinker':      'su_deep_thinker',
    'Lucky Escape':      'su_lucky_escape',
    'Ruthless':          'su_ruthless',
    'Too Kind':          'su_too_kind',
    'All-Rounder':       'su_all_rounder',
};

// ── Storage helpers ────────────────────────────────────────────────────────────

function saveAward(key) {
    const awards = getAwards();
    const now    = Date.now();
    if (awards[key]) {
        awards[key].count++;
        awards[key].lastEarned = now;
    } else {
        awards[key] = { count: 1, firstEarned: now, lastEarned: now };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(awards));
}

export function getAwards() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
}

// ── Public save helpers ────────────────────────────────────────────────────────

/**
 * Solo awards are always earned by the local player — no winner name
 * comparison needed. Any award with winner !== 'N/A' is persisted.
 *
 * @param {{ title: string, winner: string }[]} awards
 */
export function saveSoloAwards(awards) {
    awards.forEach(({ title, winner }) => {
        const key = SOLO_TITLE_TO_KEY[title];
        if (key && winner !== 'N/A') {
            saveAward(key);
        }
    });
}

/**
 * @param {{ title: string, winner: string }[]} awards
 * @param {string} localName - from getUser()
 */
export function saveVsAwards(awards, localName) {
    if (!localName) return;
    awards.forEach(({ title, winner }) => {
        const key = VS_TITLE_TO_KEY[title];
        if (key && winner === localName && winner !== 'N/A') {
            saveAward(key);
        }
    });
}

/**
 * @param {{ title: string, winner: string }[]} awards
 * @param {string} localName - from getUser()
 */
export function saveSuAwards(awards, localName) {
    if (!localName) return;
    awards.forEach(({ title, winner }) => {
        const key = SU_TITLE_TO_KEY[title];
        if (key && winner === localName && winner !== 'N/A') {
            saveAward(key);
        }
    });
}

// ── Panel UI ───────────────────────────────────────────────────────────────────

export function openAwardsPanel() {
    _renderPanel();
    document.getElementById('awards-panel').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

export function closeAwardsPanel() {
    document.getElementById('awards-panel').classList.add('hidden');
}

function _renderPanel() {
    const awards      = getAwards();
    const earnedCount = Object.keys(awards).length;
    const totalWins   = Object.values(awards).reduce((s, a) => s + a.count, 0);

    const statsEl = document.getElementById('awards-stats');
    if (statsEl) {
        statsEl.textContent =
            `${earnedCount} / ${AWARD_DEFS.length} unlocked  ·  ${totalWins} total won`;
    }

    const list = document.getElementById('awards-list');
    if (!list) return;
    list.innerHTML = '';

    // SOLO comes first — most accessible mode
    const modes = ['SOLO', 'VS', 'STITCH UP'];
    modes.forEach(mode => {
        const defs = AWARD_DEFS.filter(d => d.mode === mode);

        const header = document.createElement('div');
        header.className = 'awards-section-header';
        header.textContent = mode + ' MODE';
        list.appendChild(header);

        defs.forEach(def => {
            const data   = awards[def.key];
            const earned = !!data;

            const row = document.createElement('div');
            row.className = 'awards-row' + (earned ? ' awards-row--earned' : ' awards-row--locked');

            row.innerHTML = `
                <div class="awards-row__icon">${earned ? def.icon : '🔒'}</div>
                <div class="awards-row__body">
                    <div class="awards-row__title">${def.title}</div>
                    <div class="awards-row__desc">${def.desc}</div>
                    ${earned ? `<div class="awards-row__date">Last won ${_fmtDate(data.lastEarned)}</div>` : ''}
                </div>
                ${earned ? `<div class="awards-row__count">×${data.count}</div>` : ''}
            `;
            list.appendChild(row);
        });
    });
}

function _fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

// ── Initialise ─────────────────────────────────────────────────────────────────

export function initAwards() {
    const openBtn = document.getElementById('btn-awards');
    if (openBtn) openBtn.addEventListener('click', openAwardsPanel);

    const closeBtn = document.getElementById('btn-awards-close');
    if (closeBtn) closeBtn.addEventListener('click', closeAwardsPanel);

    const overlay = document.getElementById('awards-overlay');
    if (overlay) overlay.addEventListener('click', closeAwardsPanel);
}
