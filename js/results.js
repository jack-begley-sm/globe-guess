// ============================================================
// FILE: js/results.js
// PURPOSE: Handles the final scoreboard and game reset.
//
// DEPENDENCIES:
//   - js/state.js       (reads scores)
//   - js/map.js         (shows detail map in modal)
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
    const resultsList = document.getElementById('results-list');
    
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
            
            // Render small map in thumb
            setTimeout(() => {
                showResultOnMap(s.location, `thumb-${i}`, s.guess);
            }, 0);
        });
    }
}

function showDetailModal(roundData) {
    const modal = document.getElementById('modal-round-detail');
    if (modal) {
        modal.classList.remove('hidden');
        
        // Slight delay to ensure modal is visible before rendering map
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
