// ============================================================
// FILE: js/vs-results.js
// PURPOSE: Final results screen. Calculates awards, renders leaderboard.
// ============================================================

import { vsState } from './vs-state.js';
import { broadcastEvent } from './vs-host.js';
import { quitGame } from './vs-guest.js';

let detailMap = null;

export function showVsResults() {
    vsState.gameOver = true;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-vs-results').classList.remove('hidden');

    renderFinalLeaderboard();
    renderAwards();
    renderRoundSummary();

    if (vsState.isHost) {
        const playAgainBtn = document.getElementById('btn-vs-play-again');
        playAgainBtn.classList.remove('hidden');
        playAgainBtn.onclick = () => {
            vsState.reset();
            broadcastEvent('playAgain');
            document.getElementById('screen-vs-results').classList.add('hidden');
            document.getElementById('screen-vs-setup').classList.remove('hidden');
        };
    }

    document.getElementById('btn-vs-quit').onclick = () => {
        if (!vsState.isHost) {
            quitGame();
        }
        window.location.href = './';
    };

    // Close modal event
    const closeModalBtn = document.getElementById('btn-close-modal');
    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            document.getElementById('modal-round-detail').classList.add('hidden');
        };
    }
}

function renderFinalLeaderboard() {
    const container = document.getElementById('vs-final-leaderboard');
    container.innerHTML = '<h3>LEADERBOARD</h3>';

    const sortedPlayers = [...vsState.players].sort((a, b) => {
        const totalA = (a.scores || []).reduce((sum, s) => sum + s, 0);
        const totalB = (b.scores || []).reduce((sum, s) => sum + s, 0);
        return totalB - totalA;
    });

    sortedPlayers.forEach((player, index) => {
        const totalScore = (player.scores || []).reduce((sum, s) => sum + s, 0);
        const totalDist = vsState.roundResults.reduce((sum, r) => {
             const g = r.guesses[player.peerId];
             return sum + (g ? g.distance : 0);
        }, 0);

        const row = document.createElement('div');
        row.className = 'leaderboard-row animate-reveal';
        row.style.animationDelay = `${index * 300}ms`;
        
        if (!player.connected) row.style.opacity = '0.5';

        if (index === 0) row.classList.add('gold');
        else if (index === 1) row.classList.add('silver');
        else if (index === 2) row.classList.add('bronze');

        let rankHtml = index + 1;
        if (index === 0) rankHtml = '<i data-lucide="medal"></i>';
        else if (index === 1) rankHtml = '<i data-lucide="medal" style="opacity: 0.8"></i>';
        else if (index === 2) rankHtml = '<i data-lucide="medal" style="opacity: 0.6"></i>';

        row.innerHTML = `
            <div class="row-rank">${rankHtml}</div>
            <div class="row-name">${player.name}${player.connected ? '' : ' (Left)'}</div>
            <div class="row-score">
                <div>${totalScore.toLocaleString()} pts</div>
                <div style="font-size: 10px; opacity: 0.7">${Math.round(totalDist).toLocaleString()} km</div>
            </div>
        `;
        container.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();
}

function renderAwards() {
    const container = document.getElementById('vs-awards-container');
    container.innerHTML = '';

    const awards = calculateAwards(vsState.players, vsState.roundResults);
    awards.forEach(award => {
        const card = document.createElement('div');
        card.className = 'award-card animate-reveal';
        card.innerHTML = `
            <div class="award-icon">${award.icon}</div>
            <div class="award-info">
                <div class="award-title">${award.title}</div>
                <div class="award-desc">${award.desc}</div>
                <div class="award-winner">${award.winner}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function calculateAwards(players, roundResults) {
    if (!roundResults.length) return [];

    let sharpshooter = { val: Infinity, name: 'N/A' };
    let lostAtSea = { val: 0, name: 'N/A' };
    
    const stats = players.map(p => ({
        name: p.name,
        peerId: p.peerId,
        totalTime: 0,
        count: 0,
        distances: []
    }));

    roundResults.forEach(round => {
        Object.entries(round.guesses).forEach(([peerId, data]) => {
            const s = stats.find(stat => stat.peerId === peerId);
            if (s && data.latLng) {
                if (data.distance < sharpshooter.val) {
                    sharpshooter = { val: data.distance, name: s.name };
                }
                if (data.distance > lostAtSea.val) {
                    lostAtSea = { val: data.distance, name: s.name };
                }
                s.totalTime += data.timeTaken;
                s.count++;
                s.distances.push(data.distance);
            }
        });
    });

    let speedDemon = { val: Infinity, name: 'N/A' };
    let takingTime = { val: 0, name: 'N/A' };
    let globetrotter = { val: Infinity, name: 'N/A' };

    stats.forEach(s => {
        if (s.count > 0) {
            const avgTime = s.totalTime / s.count;
            if (avgTime < speedDemon.val) speedDemon = { val: avgTime, name: s.name };
            if (avgTime > takingTime.val) takingTime = { val: avgTime, name: s.name };

            if (s.count > 1) {
                const avgDist = s.distances.reduce((a, b) => a + b, 0) / s.count;
                const variance = s.distances.reduce((a, b) => a + Math.pow(b - avgDist, 2), 0) / s.count;
                if (variance < globetrotter.val) globetrotter = { val: variance, name: s.name };
            } else if (s.count === 1) {
                if (globetrotter.val === Infinity) globetrotter = { val: 0, name: s.name };
            }
        }
    });

    return [
        { icon: '🎯', title: 'Sharpshooter', desc: 'Closest single guess of the game', winner: sharpshooter.name },
        { icon: '⚡', title: 'Speed Demon', desc: 'Fastest submission average', winner: speedDemon.name },
        { icon: '💀', title: 'Lost at Sea', desc: 'Furthest single guess of the game', winner: lostAtSea.name },
        { icon: '🌍', title: 'Globetrotter', desc: 'Most consistent distances', winner: globetrotter.name },
        { icon: '🐢', title: 'Taking Their Time', desc: 'Slowest submission average', winner: takingTime.name }
    ];
}

function renderRoundSummary() {
    const container = document.getElementById('vs-round-summary');
    container.innerHTML = '<h3>ROUND SUMMARY</h3>';

    vsState.roundResults.forEach((round, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row results-list-item';
        row.innerHTML = `
            <div class="row-rank">${index + 1}</div>
            <div class="row-name">Round ${index + 1}</div>
            <div class="row-score">View Map <i data-lucide="chevron-right"></i></div>
        `;
        row.onclick = () => openRoundModal(index);
        container.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();
}

function openRoundModal(roundIndex) {
    const round = vsState.roundResults[roundIndex];
    if (!round) return;

    const modal = document.getElementById('modal-round-detail');
    modal.classList.remove('hidden');

    setTimeout(() => {
        if (detailMap) detailMap.remove();
        detailMap = L.map('detail-map').setView([0, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(detailMap);

        const markers = [];
        const answerLatLng = [round.correctLocation.lat, round.correctLocation.lng];
        
        const answerMarker = L.marker(answerLatLng, {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<div class="marker-pin answer" style="background:white;width:12px;height:12px;border-radius:50%;border:2px solid black"></div><label style="background:white;color:black;padding:2px 5px;border-radius:4px;font-size:10px;font-weight:bold;position:absolute;top:-20px;left:-20px;white-space:nowrap">ANSWER</label>'
            })
        }).addTo(detailMap);
        markers.push(answerMarker);

        Object.entries(round.guesses).forEach(([peerId, data]) => {
            if (!data.latLng) return;
            const guessLatLng = [data.latLng.lat, data.latLng.lng];
            const guessMarker = L.marker(guessLatLng, {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: `<div class="marker-pin guess" style="background:var(--color-teal);width:10px;height:10px;border-radius:50%"></div><label style="background:var(--color-teal);color:white;padding:2px 4px;border-radius:4px;font-size:10px;position:absolute;top:-20px;left:-20px;white-space:nowrap">${data.name}</label>`
                })
            }).addTo(detailMap);
            markers.push(guessMarker);
            L.polyline([guessLatLng, answerLatLng], { color: 'var(--color-teal)', weight: 2, dashArray: '5, 5', opacity: 0.6 }).addTo(detailMap);
        });

        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            detailMap.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    }, 200);
}
