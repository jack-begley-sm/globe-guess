// ============================================================
// FILE: js/su-results.js
// PURPOSE: Round reveal and final results for Stitch Up.
// ============================================================

import { suState } from './su-state.js';
import { nextSuRound, broadcastSuEvent } from './su-host.js';
import { saveSuAwards } from './awards.js';   // ← NEW
import { getUser } from './user.js';           // ← NEW

let revealMap = null;
let revealTimer = null;

export function initRoundReveal(result) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-su-reveal').classList.remove('hidden');

    const scorePanel = document.getElementById('su-score-panel');
    scorePanel.classList.remove('visible');

    initRevealMap(result);

    // Update UI with results
    const setter = suState.players.find(p => p.peerId === result.setterId);
    const guesser = suState.players.find(p => p.peerId === result.guesserId);

    const guesserName = (guesser?.name || result.guesserName || 'GUESSER').toUpperCase();
    document.getElementById('su-reveal-guesser-name').textContent = guesserName;
    document.getElementById('su-reveal-guesser-score').textContent = result.guesserScore;
    document.getElementById('su-reveal-guesser-details').textContent = result.skipped ? (result.reason || 'Skipped') : `${Math.round(result.distance).toLocaleString()} km`;
    document.getElementById('su-reveal-guesser-total').textContent = guesser ? guesser.guesserScores.reduce((a,b)=>a+b, 0) + guesser.setterScores.reduce((a,b)=>a+b, 0) : 0;

    const setterName = (setter?.name || result.setterName || 'SETTER').toUpperCase();
    document.getElementById('su-reveal-setter-name').textContent = setterName;
    document.getElementById('su-reveal-setter-score').textContent = result.setterScore;
    document.getElementById('su-reveal-setter-details').textContent = result.autoPlaced ? 'Auto-placed (0 bonus)' : 'Inverse score';
    document.getElementById('su-reveal-setter-total').textContent = setter ? setter.setterScores.reduce((a,b)=>a+b, 0) + setter.guesserScores.reduce((a,b)=>a+b, 0) : 0;

    renderRevealLeaderboard();

    setTimeout(() => scorePanel.classList.add('visible'), 500);

    const nextBtn = document.getElementById('btn-su-next-round');
    if (suState.isHost) {
        nextBtn.classList.remove('hidden');
        nextBtn.textContent = result.roundIndex < suState.totalRounds ? 'NEXT ROUND' : 'SEE FINAL RESULTS';
        nextBtn.onclick = () => {
            clearTimeout(revealTimer);
            if (result.roundIndex < suState.totalRounds) {
                nextSuRound();
            } else {
                broadcastSuEvent('gameResults', { results: suState.roundResults });
            }
        };

        // Auto-advance after 60s
        clearTimeout(revealTimer);
        revealTimer = setTimeout(() => {
            if (result.roundIndex < suState.totalRounds) {
                nextSuRound();
            } else {
                broadcastSuEvent('gameResults', { results: suState.roundResults });
            }
        }, 60000);
    } else {
        nextBtn.classList.add('hidden');
    }
}

function renderRevealLeaderboard() {
    const list = document.getElementById('su-reveal-leaderboard');
    if (!list) return;
    list.innerHTML = '';

    const sorted = [...suState.players].sort((a, b) => {
        const totalA = a.setterScores.reduce((s,v)=>s+v,0) + a.guesserScores.reduce((s,v)=>s+v,0);
        const totalB = b.setterScores.reduce((s,v)=>s+v,0) + b.guesserScores.reduce((s,v)=>s+v,0);
        return totalB - totalA;
    });

    sorted.forEach(player => {
        const total = player.setterScores.reduce((s,v)=>s+v,0) + player.guesserScores.reduce((s,v)=>s+v,0);
        const row = document.createElement('div');
        row.className = 'reveal-leaderboard-row';
        row.innerHTML = `
            <span class="reveal-leaderboard-name">${player.name}</span>
            <span class="reveal-leaderboard-score">${total.toLocaleString()}</span>
        `;
        list.appendChild(row);
    });
}

function initRevealMap(result) {
    if (revealMap) revealMap.remove();

    revealMap = L.map('reveal-map', {
        zoomControl: false,
        worldCopyJump: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(revealMap);

    const goldIcon = L.divIcon({
        className: 'su-pin-label',
        html: `<div style="background-color: var(--color-gold); width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div><span style="font-size: 10px; color: var(--color-gold);">ANSWER</span>`,
        iconSize: [80, 20],
        iconAnchor: [6, 6]
    });
    const guesserName = (suState.players.find(p => p.peerId === result.guesserId)?.name || result.guesserName || 'GUESS').toUpperCase();
    const tealIcon = L.divIcon({
        className: 'su-pin-label',
        html: `<div style="background-color: var(--color-teal); width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div><span style="font-size: 10px; color: var(--color-teal);">${guesserName}</span>`,
        iconSize: [120, 20],
        iconAnchor: [6, 6]
    });

    const ansMarker = L.marker([result.correctLatLng.lat, result.correctLatLng.lng], { icon: goldIcon }).addTo(revealMap);
    
    if (result.guessLatLng) {
        const guessMarker = L.marker([result.guessLatLng.lat, result.guessLatLng.lng], { icon: tealIcon }).addTo(revealMap);
        const polyline = L.polyline(
            [[result.correctLatLng.lat, result.correctLatLng.lng],
             [result.guessLatLng.lat, result.guessLatLng.lng]],
            { color: 'var(--color-teal)', weight: 2, dashArray: '5, 10' }
        ).addTo(revealMap);

        const mid = L.latLng(
            (result.correctLatLng.lat + result.guessLatLng.lat) / 2,
            (result.correctLatLng.lng + result.guessLatLng.lng) / 2
        );
        L.marker(mid, {
            icon: L.divIcon({
                className: 'distance-badge',
                html: `${Math.round(result.distance).toLocaleString()} km`,
                iconSize: [80, 20],
                iconAnchor: [40, 10]
            })
        }).addTo(revealMap);

        const bounds = L.latLngBounds([ansMarker.getLatLng(), guessMarker.getLatLng()]);
        revealMap.fitBounds(bounds, { padding: [100, 100] });
    } else {
        revealMap.setView([result.correctLatLng.lat, result.correctLatLng.lng], 4);
    }
}

export function showSuResults() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-su-results').classList.remove('hidden');

    renderSuLeaderboard();
    renderSuRoundSummary();
    renderSuAwards();

    const playAgainBtn = document.getElementById('btn-su-play-again');
    if (suState.isHost) {
        playAgainBtn.classList.remove('hidden');
        playAgainBtn.onclick = () => {
            // Reset state
            suState.currentRound = 0;
            suState.roundResults = [];
            suState.players.forEach(p => {
                p.setterScores = [];
                p.guesserScores = [];
            });
            broadcastSuEvent('startSetup', {});
        };
    } else {
        playAgainBtn.classList.add('hidden');
    }
}

function renderSuLeaderboard() {
    const list = document.getElementById('su-leaderboard');
    list.innerHTML = '';

    const sorted = [...suState.players].sort((a, b) => {
        const totalA = a.setterScores.reduce((s,v)=>s+v,0) + a.guesserScores.reduce((s,v)=>s+v,0);
        const totalB = b.setterScores.reduce((s,v)=>s+v,0) + b.guesserScores.reduce((s,v)=>s+v,0);
        return totalB - totalA;
    });

    sorted.forEach((player, index) => {
        const total = player.setterScores.reduce((s,v)=>s+v,0) + player.guesserScores.reduce((s,v)=>s+v,0);
        const best = Math.max(...player.setterScores, ...player.guesserScores, 0);
        
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.style.animationDelay = `${index * 100}ms`;
        
        let medal = '';
        if (index === 0) medal = '<i data-lucide="medal" style="color: var(--color-gold); width: 16px;"></i>';
        else if (index === 1) medal = '<i data-lucide="medal" style="color: silver; width: 16px;"></i>';
        else if (index === 2) medal = '<i data-lucide="medal" style="color: #cd7f32; width: 16px;"></i>';

        row.innerHTML = `
            <div class="leaderboard-rank">${medal || (index + 1)}</div>
            <div class="leaderboard-name">${player.name}</div>
            <div style="text-align: right;">
                <div class="leaderboard-score">${total.toLocaleString()}</div>
                <small style="font-size: 0.6rem; color: var(--text-muted);">BEST: ${best}</small>
            </div>
        `;
        list.appendChild(row);
        
        setTimeout(() => row.style.opacity = '1', 10);
    });

    if (window.lucide) window.lucide.createIcons();
}

function renderSuRoundSummary() {
    const container = document.getElementById('su-round-summary');
    container.innerHTML = '';

    suState.roundResults.forEach((result, index) => {
        const setter = suState.players.find(p => p.peerId === result.setterId);
        const guesser = suState.players.find(p => p.peerId === result.guesserId);
        const setterName = setter?.name || result.setterName || 'Unknown';
        const guesserName = guesser?.name || result.guesserName || 'Unknown';

        const row = document.createElement('div');
        row.className = 'round-summary-row';
        row.innerHTML = `
            <div class="round-summary-info">
                <div>ROUND ${result.roundIndex}</div>
                <div class="round-summary-names">${setterName} → ${guesserName}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-family: 'DM Mono', monospace;">${Math.round(result.distance).toLocaleString()} km</div>
                <small style="font-size: 0.6rem; color: var(--text-muted);">G: ${result.guesserScore} | S: ${result.setterScore}</small>
            </div>
        `;
        row.onclick = () => openSuRoundModal(index);
        container.appendChild(row);
    });
}

export function openSuRoundModal(index) {
    const result = suState.roundResults[index];
    const setter = suState.players.find(p => p.peerId === result.setterId);
    const guesser = suState.players.find(p => p.peerId === result.guesserId);
    const guesserName = guesser?.name || result.guesserName || 'Guesser';

    const modal = document.getElementById('modal-round-detail');
    modal.classList.remove('hidden');

    const detailMapContainer = document.getElementById('detail-map');
    detailMapContainer.innerHTML = '';
    const mapDiv = document.createElement('div');
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    detailMapContainer.appendChild(mapDiv);

    const map = L.map(mapDiv, { zoomControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

    const goldIcon = L.divIcon({
        className: 'su-pin-label',
        html: `<div style="background-color: var(--color-gold); width: 10px; height: 10px; border-radius: 50%; border: 1px solid white;"></div><span style="font-size: 8px; color: var(--color-gold);">ANSWER</span>`,
        iconSize: [80, 20],
        iconAnchor: [5, 5]
    });
    const tealIcon = L.divIcon({
        className: 'su-pin-label',
        html: `<div style="background-color: var(--color-teal); width: 10px; height: 10px; border-radius: 50%; border: 1px solid white;"></div><span style="font-size: 8px; color: var(--color-teal);">${guesserName}</span>`,
        iconSize: [80, 20],
        iconAnchor: [5, 5]
    });

    const ansMarker = L.marker([result.correctLatLng.lat, result.correctLatLng.lng], { icon: goldIcon }).addTo(map);
    
    const bounds = [ansMarker.getLatLng()];
    if (result.guessLatLng) {
        const guessMarker = L.marker([result.guessLatLng.lat, result.guessLatLng.lng], { icon: tealIcon }).addTo(map);
        L.polyline([ansMarker.getLatLng(), guessMarker.getLatLng()], { color: 'var(--color-teal)', weight: 2, dashArray: '5, 10' }).addTo(map);
        bounds.push(guessMarker.getLatLng());
    }

    if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    } else {
        map.setView(ansMarker.getLatLng(), 4);
    }

    document.getElementById('btn-close-modal').onclick = () => {
        modal.classList.add('hidden');
        map.remove();
    };
}

function renderSuAwards() {
    const awardsContainer = document.getElementById('su-awards');
    awardsContainer.innerHTML = '';

    const awards = calculateSuAwards();

    // ── Persist awards for the local player ────────────────────────────────
    saveSuAwards(awards, getUser());
    // ──────────────────────────────────────────────────────────────────────

    awards.forEach(award => {
        const card = document.createElement('div');
        card.className = 'award-card';
        card.innerHTML = `
            <div class="award-title">${award.icon} ${award.title}</div>
            <div class="award-winner">${award.winner}</div>
        `;
        awardsContainer.appendChild(card);
    });
}

function calculateSuAwards() {
    const players = suState.players;
    const results = suState.roundResults;

    if (!results.length) return [];

    const getPlayer = (id) => players.find(p => p.peerId === id);

    // 🎯 Master Stitcher — Setter who caused the most distance
    const setterDistance = {};
    results.forEach(r => {
        setterDistance[r.setterId] = (setterDistance[r.setterId] || 0) + r.distance;
    });
    const masterStitcherId = Object.keys(setterDistance).reduce((a, b) => setterDistance[a] > setterDistance[b] ? a : b);

    // 🗺️ Escape Artist — Guesser with best average score despite cruel locations
    const guesserAvg = {};
    players.forEach(p => {
        if (p.guesserScores.length) {
            guesserAvg[p.peerId] = p.guesserScores.reduce((a,b)=>a+b,0) / p.guesserScores.length;
        }
    });
    const escapeArtistId = Object.keys(guesserAvg).reduce((a, b) => guesserAvg[a] > guesserAvg[b] ? a : b);

    // ⚡ Hair Trigger — fastest Setter
    const fastSetter = results.filter(r => !r.autoPlaced).sort((a,b) => a.timeTaken - b.timeTaken)[0];

    // 🐢 Deep Thinker — slowest Setter
    const slowSetter = results.filter(r => !r.autoPlaced).sort((a,b) => b.timeTaken - a.timeTaken)[0];

    // 🎰 Lucky Escape — highest score on what should be cruel
    const luckyEscape = results.sort((a,b) => (b.guesserScore - b.distance/1000) - (a.guesserScore - a.distance/1000))[0];

    // 💀 Ruthless — highest avg distance
    const setterAvgDist = {};
    results.forEach(r => {
        setterAvgDist[r.setterId] = (setterAvgDist[r.setterId] || {sum:0, count:0});
        setterAvgDist[r.setterId].sum += r.distance;
        setterAvgDist[r.setterId].count++;
    });
    const ruthlessId = Object.keys(setterAvgDist).reduce((a, b) => (setterAvgDist[a].sum/setterAvgDist[a].count) > (setterAvgDist[b].sum/setterAvgDist[b].count) ? a : b);

    // 🤝 Too Kind — lowest avg distance
    const tooKindId = Object.keys(setterAvgDist).reduce((a, b) => (setterAvgDist[a].sum/setterAvgDist[a].count) < (setterAvgDist[b].sum/setterAvgDist[b].count) ? a : b);

    // 🏆 All-Rounder — highest combined total
    const totals = players.map(p => ({
        id: p.peerId,
        total: p.setterScores.reduce((a,b)=>a+b,0) + p.guesserScores.reduce((a,b)=>a+b,0)
    }));
    const allRounderId = totals.sort((a,b) => b.total - a.total)[0].id;

    const getWinnerName = (id) => {
        const p = getPlayer(id);
        if (p) return p.name;
        const res = results.find(r => r.setterId === id || r.guesserId === id);
        if (res) return (res.setterId === id) ? res.setterName : res.guesserName;
        return 'N/A';
    };

    return [
        { title: 'Master Stitcher', icon: '🎯', winner: getWinnerName(masterStitcherId) },
        { title: 'Escape Artist',   icon: '🗺️',  winner: getWinnerName(escapeArtistId) },
        { title: 'Hair Trigger',    icon: '⚡', winner: getWinnerName(fastSetter?.setterId) },
        { title: 'Deep Thinker',    icon: '🐢', winner: getWinnerName(slowSetter?.setterId) },
        { title: 'Lucky Escape',    icon: '🎰', winner: getWinnerName(luckyEscape?.guesserId) },
        { title: 'Ruthless',        icon: '💀', winner: getWinnerName(ruthlessId) },
        { title: 'Too Kind',        icon: '🤝', winner: getWinnerName(tooKindId) },
        { title: 'All-Rounder',     icon: '🏆', winner: getWinnerName(allRounderId) },
    ];
}
