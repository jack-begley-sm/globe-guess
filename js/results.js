// ============================================================
// FILE: js/results.js
// PURPOSE: Handles the final scoreboard and game reset.
//
// DEPENDENCIES:
//   - js/state.js       (reads scores)
//   - js/map.js         (shows detail map in modal)
//   - js/awards.js      (persists solo awards)
//   - js/user.js        (reads player name)
//
// USED BY:
//   - js/round.js       (calls renderResults)
//   - main.js           (initializes results events)
//
// KEY FUNCTIONS:
//   - renderResults()    populates the final scoreboard
//   - resetGame()        returns to landing screen and resets state
// ============================================================

import { state, resetState } from './state.js';
import { showResultOnMap } from './map.js';
import { saveSoloAwards } from './awards.js';
import { getUser } from './user.js';

export function initResults() {
    const playAgainBtn = document.getElementById('btn-play-again');
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => {
            resetGame();
        });
    }

    const shareBtn = document.getElementById('btn-share');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            alert('Sharing coming soon');
        });
    }

    // Modal close
    const closeModalBtn = document.getElementById('btn-close-modal');
    const modal = document.getElementById('modal-round-detail');
    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }
}

export function renderResults() {
    const totalScoreEl = document.getElementById('final-total-score');
    const resultsList  = document.getElementById('results-list');

    const totalScore = state.scores.reduce((sum, s) => sum + s.totalScore, 0);
    if (totalScoreEl) totalScoreEl.textContent = totalScore.toLocaleString();

    if (resultsList) {
        resultsList.innerHTML = '';

        state.scores.forEach((s, i) => {
            const row = document.createElement('div');
            row.className = 'round-row';
            row.innerHTML = `
                <div class="round-num">${i + 1}</div>
                <div class="round-info">
                    <div class="round-dist">${s.distanceKm} km</div>
                    <div class="round-score">${s.totalScore.toLocaleString()} pts</div>
                </div>
                <div class="round-thumb" id="thumb-${i}"></div>
            `;

            row.addEventListener('click', () => {
                showDetailModal(s);
            });

            resultsList.appendChild(row);

            setTimeout(() => {
                showResultOnMap(s.location, `thumb-${i}`, s.guess);
            }, 0);
        });
    }

    // Awards — calculate, render, and persist in one pass
    renderSoloAwards();
}

// ── Solo award logic ───────────────────────────────────────────────────────────
//
// AUDIT (item 23, S04-regions-migrate.md): Sharpshooter, Globetrotter, On
// Fire and Lost at Sea below threshold on a RAW km distance, calibrated by
// eye to the old fixed 2000km-cutoff World game. Now that scoring is
// relative to the play area (js/geo/shapes.js's scaleKm), these four no
// longer mean the same thing in every region: 50km is a near-perfect guess
// relative to WORLD's ~20015km scale but a fairly mediocre one relative to
// UK's ~1171km scale, so "Sharpshooter" is too easy to earn in UK and too
// hard in WORLD, and symmetrically for "Lost at Sea" at the 5000km end.
// High Scorer and Consistent are unaffected — they key off score (already
// relative) and the player's own average, not a fixed km figure.
// NOT fixed here: the right replacement thresholds (e.g. some fraction of
// state.shape.scaleKm) are a "how does it feel" decision, the same kind
// item 24's manual playtest exists to make — picking numbers now would be
// a guess. Revisit after that playtest.

function calculateSoloAwards() {
    const scores = state.scores;
    if (!scores.length) return [];

    // The player always wins any award they earn in solo mode.
    // Use their stored name if available, otherwise a generic label.
    const name      = getUser() || 'You';
    const distances = scores.map(s => s.distanceKm);
    const totals    = scores.map(s => s.totalScore);
    const avgDist   = distances.reduce((a, b) => a + b, 0) / distances.length;
    const avgScore  = totals.reduce((a, b) => a + b, 0) / totals.length;

    // 🎯 Sharpshooter — any single guess ≤ 50 km
    const bestDist    = Math.min(...distances);
    const sharpshooter = bestDist <= 50 ? name : 'N/A';

    // 🌍 Globetrotter — every guess ≤ 500 km
    const globetrotter = distances.every(d => d <= 500) ? name : 'N/A';

    // 🔥 On Fire — 3+ consecutive guesses ≤ 300 km
    let maxStreak = 0;
    let streak    = 0;
    distances.forEach(d => {
        if (d <= 300) {
            streak++;
            if (streak > maxStreak) maxStreak = streak;
        } else {
            streak = 0;
        }
    });
    const onFire = maxStreak >= 3 ? name : 'N/A';

    // 💀 Lost at Sea — any single guess ≥ 5,000 km
    const worstDist  = Math.max(...distances);
    const lostAtSea  = worstDist >= 5000 ? name : 'N/A';

    // 🏆 High Scorer — average score ≥ 4,000 pts per round
    const highScorer = avgScore >= 4000 ? name : 'N/A';

    // 🎰 Consistent — no guess more than 2× the average distance
    // Requires at least 2 rounds to be meaningful
    const consistent = (distances.length > 1 && distances.every(d => d <= avgDist * 2))
        ? name
        : 'N/A';

    return [
        { icon: '🎯', title: 'Sharpshooter', desc: 'A guess within 50 km',                     winner: sharpshooter },
        { icon: '🌍', title: 'Globetrotter', desc: 'Every guess within 500 km',                 winner: globetrotter },
        { icon: '🔥', title: 'On Fire',      desc: '3+ consecutive guesses within 300 km',      winner: onFire },
        { icon: '💀', title: 'Lost at Sea',  desc: 'A guess more than 5,000 km off',            winner: lostAtSea },
        { icon: '🏆', title: 'High Scorer',  desc: 'Averaged over 4,000 pts per round',         winner: highScorer },
        { icon: '🎰', title: 'Consistent',   desc: 'No guess more than double your average dist', winner: consistent },
    ];
}

function renderSoloAwards() {
    const container = document.getElementById('solo-awards');
    if (!container) return;
    container.innerHTML = '';

    const awards = calculateSoloAwards();

    // Persist any earned awards before rendering
    saveSoloAwards(awards);

    // Only show awards the player actually earned this game
    const earned = awards.filter(a => a.winner !== 'N/A');
    if (!earned.length) {
        // Nothing earned — hide the section entirely so it doesn't
        // feel like a failure screen
        container.closest('.solo-awards-section')?.classList.add('hidden');
        return;
    }

    container.closest('.solo-awards-section')?.classList.remove('hidden');

    earned.forEach(award => {
        const card = document.createElement('div');
        card.className = 'award-card';
        card.innerHTML = `
            <div class="award-icon">${award.icon}</div>
            <div class="award-info">
                <div class="award-title">${award.title}</div>
                <div class="award-desc">${award.desc}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ── Detail modal + reset ───────────────────────────────────────────────────────

function showDetailModal(roundData) {
    const modal = document.getElementById('modal-round-detail');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            showResultOnMap(roundData.location, 'detail-map', roundData.guess);
        }, 100);
    }
}

function resetGame() {
    resetState();
    document.getElementById('screen-results').classList.add('hidden');
    document.getElementById('screen-landing').classList.remove('hidden');
}
