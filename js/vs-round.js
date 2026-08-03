
import { vsState } from './vs-state.js';
import { getRandomLocation, setVsStreetView, lockStreetView, unlockStreetView } from './streetview.js';
import { calculateScore } from './scoring.js';
import { MAP_SETTINGS } from './config.js';
import { showVsResults } from './vs-results.js';
import { broadcastEvent, sendVsGuess as guestSendGuess } from './vs-network.js';
 
let timerInterval;
let autoAdvanceTimeout;
let vsMap = null;
let vsMarker = null;
let revealMap = null;
let isMapLocked = false;
let nextVsLocationPromise = null;
 
 
export function startVsRound() {
    vsState.gameStarted = true;
    vsState.gameOver = false;
    vsState.players.forEach(p => {
        p.hasSubmitted = false;
        p.lastTimeTaken = 0;
    });
 
    // show loading screen now; game screen revealed in initRoundUI once Street View is ready
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
    document.getElementById('waiting-title').textContent = 'Loading round...';
    document.getElementById('waiting-subtitle').textContent =
        `Round ${vsState.currentRound} of ${vsState.totalRounds}`;
 
    initVsMap();
    resetVsMap();
 
    if (vsState.isHost) {
        setupHostRound();
        // Preload next location in background if not last round
        if (vsState.currentRound < vsState.totalRounds) {
            nextVsLocationPromise = getRandomLocation(vsState.region);
        }
    }
}
 
async function setupHostRound() {
    try {
        // Use preloaded if available
        const locationData = nextVsLocationPromise
            ? await nextVsLocationPromise
            : await getRandomLocation(vsState.region);
 
        nextVsLocationPromise = null; // consume it

        // Keep the pano id alongside lat/lng (not just { lat, lng }) — a guest who
        // fully drops and rejoins mid-round (see resumeInProgressRound) needs it to
        // rebuild the same Street View, not just know where it should point.
        vsState.currentLocation = locationData;

        broadcastEvent('startGame', { 
            location: locationData, 
            round: vsState.currentRound, 
            totalRounds: vsState.totalRounds 
        });
        
        initRoundUI(locationData);
    } catch (err) {
        console.error('Failed to get random location:', err);
    }
}
 
function initRoundUI(locationData) {
    document.getElementById('vs-current-round').textContent = vsState.currentRound;
    document.getElementById('vs-total-rounds').textContent = vsState.totalRounds;
    document.getElementById('vs-round-reveal-overlay').classList.add('hidden');
    document.getElementById('vs-round-leaderboard').classList.remove('visible');
    document.getElementById('vs-waiting-message').classList.add('hidden');
    document.getElementById('btn-vs-submit-guess').classList.remove('hidden');
    document.getElementById('btn-vs-submit-guess').disabled = true;
    updatePlayerStatusList();
 
    // Unhide the game screen BEFORE constructing Street View so the container has
    // real dimensions. Building a StreetViewPanorama inside a display:none container
    // breaks Google's sizing math and commonly settles on a pitched-up (sky-facing)
    // POV with no resize correction afterward.
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-vs-game').classList.remove('hidden');

    // The guess map is only ever constructed once (see initVsMap's `if (vsMap)
    // return`), on the very first round. If that happened while this screen was
    // still hidden (e.g. host, who reaches here after an async location fetch),
    // Leaflet sizes itself against a zero-size container and stays tiny. Guests
    // reach this point synchronously (location arrives in the event payload) so
    // they rarely hit this, which is why it was host-only.
    if (vsMap) {
        requestAnimationFrame(() => vsMap.invalidateSize());
    }

    // Let the browser lay out the container (with real dimensions) before we build
    // the panorama on its non-zero-sized element. Timer starts only once the
    // panorama actually reports ready (or after a fallback timeout) so loading
    // time doesn't silently eat into the round's time limit.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setVsStreetView(locationData.pano, 'vs-street-view-container', startTimer);
        });
    });
}

// Called on a guest who fully dropped (not the silent background-reconnect path
// in vs-guest.js) and rejoined via a fresh join — previously they'd land back on
// the "waiting for host to start" screen with no way to see the in-progress round,
// leaving the host stuck waiting on their guess until the timer ran out. Pulls
// them straight into the live round instead, unless they'd already submitted
// before dropping (host-side hasSubmitted survives a disconnect).
export function resumeInProgressRound(gameState) {
    const gameScreen = document.getElementById('screen-vs-game');
    if (gameScreen && !gameScreen.classList.contains('hidden')) return; // already viewing it live

    const localPlayer = vsState.players.find(p => p.peerId === vsState.localPlayer.peerId);
    if (localPlayer && localPlayer.hasSubmitted) return; // already answered this round before dropping

    vsState.gameStarted = true;
    vsState.gameOver = false;
    vsState.currentRound = gameState.currentRound;
    vsState.totalRounds = gameState.totalRounds;
    vsState.region = gameState.region;
    vsState.currentLocation = gameState.currentLocation;

    initVsMap();
    resetVsMap();

    document.getElementById('vs-current-round').textContent = vsState.currentRound;
    document.getElementById('vs-total-rounds').textContent = vsState.totalRounds;
    document.getElementById('vs-round-reveal-overlay').classList.add('hidden');
    document.getElementById('vs-round-leaderboard').classList.remove('visible');
    document.getElementById('vs-waiting-message').classList.add('hidden');
    document.getElementById('btn-vs-submit-guess').classList.remove('hidden');
    document.getElementById('btn-vs-submit-guess').disabled = true;
    updatePlayerStatusList();

    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('screen-vs-game').classList.remove('hidden');

    if (vsMap) {
        requestAnimationFrame(() => vsMap.invalidateSize());
    }

    const timeLimit = gameState.timeLimit || vsState.timeLimit;
    const elapsedSeconds = (Date.now() - (gameState.timerStart || Date.now())) / 1000;
    const remaining = Math.max(0, Math.round(timeLimit - elapsedSeconds));

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setVsStreetView(gameState.currentLocation?.pano, 'vs-street-view-container', () => startTimer(remaining));
        });
    });
}

function startTimer(initialTimeLeft) {
    let timeLeft = initialTimeLeft !== undefined ? initialTimeLeft : vsState.timeLimit;
    const timerDisplay = document.getElementById('vs-display-timer');
    const progressBar = document.getElementById('vs-timer-progress-bar');

    timerDisplay.textContent = timeLeft;
    progressBar.style.width = `${(timeLeft / vsState.timeLimit) * 100}%`;
    progressBar.classList.remove('danger');

    // A rejoining guest resumes with less than the full time left (see
    // resumeInProgressRound) — timerStart is only reset here when we're not
    // resuming, so the remaining-time math there isn't clobbered by this call.
    if (initialTimeLeft === undefined) {
        vsState.timerStart = Date.now();
    }

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        const pct = (timeLeft / vsState.timeLimit) * 100;
        progressBar.style.width = `${pct}%`;
        
        if (timeLeft <= 30) {
            progressBar.classList.add('danger');
        }
 
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (vsState.isHost) {
                onTimerExpired();
            }
        }
    }, 1000);
}
 
function onTimerExpired() {
    // If host hasn't submitted
    const hostPlayer = vsState.players.find(p => p.peerId === vsState.localPlayer.peerId);
    if (!hostPlayer.hasSubmitted) {
        submitVsGuess(true); // Forced submit
    }
    
    // For any player who hasn't guessed, auto-submit null is handled on host when all/timer ends
    onAllGuessesReceived();
}
 
export function handleVsEvent(type, payload) {
    switch (type) {
        case 'startGame':
            vsState.currentRound = payload.round;
            vsState.totalRounds = payload.totalRounds;
            vsState.currentLocation = payload.location;
            startVsRound();
            initRoundUI(payload.location);
            break;
        case 'playerSubmitted':
            handlePlayerSubmitted(payload.peerId);
            break;
        case 'roundReveal':
            // LEADERBOARD FIX 1/3: guests never stored round results, so awards/km/summary were blank
            if (!vsState.isHost) {
                vsState.roundResults.push(payload);
            }
            showRoundReveal(payload);
            break;
        case 'nextRound':
            vsState.currentRound++;
            startVsRound();
            break;
        case 'showResults':
            // LEADERBOARD FIX 3/3: use host's authoritative results rather than piecemeal guest copy
            if (payload && payload.roundResults) {
                vsState.roundResults = payload.roundResults;
            }
            showVsResults();
            break;
        case 'playAgain':
            vsState.reset();
            if (vsState.isHost) {
                document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
                document.getElementById('screen-vs-setup').classList.remove('hidden');
            } else {
                document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
                document.getElementById('screen-multiplayer-waiting').classList.remove('hidden');
            }
            break;
    }
}
 
function handlePlayerSubmitted(peerId) {
    const player = vsState.players.find(p => p.peerId === peerId);
    if (player) {
        player.hasSubmitted = true;
        updatePlayerStatusList();
    }
}
 
export function updatePlayerStatusList() {
    const container = document.getElementById('vs-game-player-status');
    if (!container) return;
    
    container.innerHTML = '';
    vsState.players.forEach(player => {
        if (!player.connected) return;
        
        const tag = document.createElement('div');
        const submitted = player.hasSubmitted;
        
        tag.className = `player-status-tag ${submitted ? 'submitted' : 'waiting'}`;
        tag.innerHTML = `
            <span>${player.name}</span>
            <i data-lucide="${submitted ? 'check-circle' : 'loader-2'}"></i>
        `;
        container.appendChild(tag);
    });
    
    if (window.lucide) window.lucide.createIcons();
    
    container.querySelectorAll('.lucide-loader-2').forEach(icon => {
        icon.classList.add('animate-spin');
    });
}
 
export function initVsMap() {
    if (vsMap) return;
 
    vsMap = L.map('vs-guess-map', {
        attributionControl: false,
        zoomControl: false
    }).setView([20, 0], MAP_SETTINGS.INITIAL_ZOOM);
 
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(vsMap);
 
    vsMap.on('click', (e) => {
        if (isMapLocked) return;
        
        const widget = document.getElementById('vs-guess-map-widget');
        if (widget.classList.contains('collapsed')) {
            widget.classList.remove('collapsed');
            widget.classList.add('expanded');
            setTimeout(() => vsMap.invalidateSize(), 300);
        } else {
            placeVsMarker(e.latlng);
        }
    });
 
    const widget = document.getElementById('vs-guess-map-widget');
    widget.addEventListener('click', (e) => {
        if (widget.classList.contains('collapsed')) {
            widget.classList.remove('collapsed');
            widget.classList.add('expanded');
            setTimeout(() => vsMap.invalidateSize(), 300);
        }
    });
 
    document.getElementById('btn-vs-submit-guess').addEventListener('click', () => submitVsGuess());
}
 
function placeVsMarker(latlng) {
    // Panning the map more than one world-width gives longitudes outside
    // -180..180 (e.g. 380 instead of 20). Wrap here so every consumer of
    // currentGuessLatLng — scoring, network payload, the reveal map — gets a
    // normalized value instead of one that renders in a duplicate world copy.
    latlng = latlng.wrap();

    if (vsMarker) {
        vsMarker.setLatLng(latlng);
    } else {
        vsMarker = L.marker(latlng).addTo(vsMap);
    }
    vsState.currentGuessLatLng = { lat: latlng.lat, lng: latlng.lng };
    document.getElementById('btn-vs-submit-guess').disabled = false;
}
 
function resetVsMap() {
    isMapLocked = false;

    unlockStreetView('vs-street-view-container');

    if (vsMarker) {
        vsMap.removeLayer(vsMarker);
        vsMarker = null;
    }
    vsState.currentGuessLatLng = null;
    document.getElementById('btn-vs-submit-guess').disabled = true;
    
    const widget = document.getElementById('vs-guess-map-widget');
    widget.classList.add('collapsed');
    widget.classList.remove('expanded');
    setTimeout(() => vsMap.invalidateSize(), 300);
}
 
export function submitVsGuess(isForced = false) {
    isMapLocked = true;

    // Timer keeps running after submit so the player can still see time
    // remaining while waiting on others; onTimerExpired() already checks
    // hasSubmitted before forcing anything, so nothing needs to be cancelled here.
    lockStreetView('vs-street-view-container');

    const timeTaken = (Date.now() - vsState.timerStart) / 1000;
    const latLng = isForced ? null : vsState.currentGuessLatLng;
    
    const widget = document.getElementById('vs-guess-map-widget');
    widget.classList.add('collapsed');
    widget.classList.remove('expanded');
    
    document.getElementById('btn-vs-submit-guess').classList.add('hidden');
    document.getElementById('vs-waiting-message').classList.remove('hidden');
 
    if (vsState.isHost) {
        const hostPlayer = vsState.players.find(p => p.peerId === vsState.localPlayer.peerId);
        hostPlayer.guesses[vsState.currentRound - 1] = latLng;
        hostPlayer.lastTimeTaken = timeTaken;
        hostPlayer.hasSubmitted = true;
        
        broadcastEvent('playerSubmitted', { peerId: vsState.localPlayer.peerId });
        updatePlayerStatusList();
        
        checkAllGuessesReceived();
    } else {
        guestSendGuess(latLng, timeTaken, vsState.currentRound);
        const localPlayer = vsState.players.find(p => p.peerId === vsState.localPlayer.peerId);
        if (localPlayer) localPlayer.hasSubmitted = true;
        updatePlayerStatusList();
    }
}
 
export function checkAllGuessesReceived() {
    const activePlayers = vsState.players.filter(p => p.connected);
    const guessesInRound = activePlayers.filter(p => p.hasSubmitted);
    
    if (guessesInRound.length === activePlayers.length) {
        onAllGuessesReceived();
    }
}
 
export function onAllGuessesReceived() {
    if (!vsState.isHost) return;
 
    const roundResults = {
        correctLocation: vsState.currentLocation,
        guesses: {}
    };
 
    let bestDistance = Infinity;
    let closestPlayerId = null;
 
    vsState.players.forEach(player => {
        const guess = player.guesses[vsState.currentRound - 1] || null;
        const result = calculateScore(
            guess,
            vsState.currentLocation,
            player.lastTimeTaken || 0,
            180,
            false,
            0
        );
        
        player.scores[vsState.currentRound - 1] = result.totalScore;
        roundResults.guesses[player.peerId] = {
            name: player.name,
            latLng: guess,
            score: result.totalScore,
            distance: result.distanceKm,
            timeTaken: player.lastTimeTaken || 0
        };
 
        if (guess && result.distanceKm < bestDistance) {
            bestDistance = result.distanceKm;
            closestPlayerId = player.peerId;
        }
    });
 
    // Always set closestPlayerId so we can highlight the best guess
    roundResults.closestPlayerId = closestPlayerId;
 
    if (vsState.gameMode === 'coop') {
        // In Co-op, everyone gets the same score for the round (the best one)
        const bestScore = closestPlayerId ? roundResults.guesses[closestPlayerId].score : 0;
        vsState.players.forEach(player => {
            player.scores[vsState.currentRound - 1] = bestScore;
        });
        roundResults.bestScore = bestScore;
    }
 
    vsState.roundResults.push(roundResults);
    
    broadcastEvent('roundReveal', roundResults);
    showRoundReveal(roundResults);
}
 
export function showRoundReveal(results) {
    try {
        clearInterval(timerInterval);
 
        // Update local state with results (especially for guests who missed playersUpdate)
        Object.entries(results.guesses).forEach(([peerId, data]) => {
            let player = vsState.players.find(p => p.peerId === peerId);
            if (!player) {
                // Fallback: Add missing player to state
                player = {
                    name: data.name,
                    peerId: peerId,
                    connected: true,
                    scores: [],
                    guesses: []
                };
                vsState.players.push(player);
            }
            player.scores[vsState.currentRound - 1] = data.score;
        });
 
        document.getElementById('vs-round-reveal-overlay').classList.remove('hidden');
        
        if (revealMap) {
            try {
                revealMap.remove();
            } catch (e) {
                console.warn('Error removing reveal map:', e);
            }
        }
        revealMap = L.map('vs-reveal-map', {
            attributionControl: false
        }).setView([0, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(revealMap);
 
        const markers = [];
        const answerLatLng = [results.correctLocation.lat, results.correctLocation.lng];
        
        const answerMarker = L.marker(answerLatLng, {
            icon: L.divIcon({
                className: 'custom-marker',
                html: '<div class="marker-pin answer" style="background:white;width:12px;height:12px;border-radius:50%;border:2px solid black"></div><label style="background:white;color:black;padding:2px 5px;border-radius:4px;font-size:10px;font-weight:bold;position:absolute;top:-20px;left:-20px;white-space:nowrap">ANSWER</label>'
            })
        }).addTo(revealMap);
        markers.push(answerMarker);
 
        Object.entries(results.guesses).forEach(([peerId, data]) => {
            if (!data.latLng) return;
            
            const isClosest = peerId === results.closestPlayerId;
            const color = isClosest ? 'var(--color-gold, #ffd700)' : 'var(--color-teal)';
            
            const guessLatLng = [data.latLng.lat, data.latLng.lng];
            const guessMarker = L.marker(guessLatLng, {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: `<div class="marker-pin guess" style="background:${color};width:10px;height:10px;border-radius:50%;${isClosest ? 'box-shadow: 0 0 10px gold;' : ''}"></div><label style="background:${color};color:${isClosest ? 'black' : 'white'};padding:2px 4px;border-radius:4px;font-size:10px;position:absolute;top:-20px;left:-20px;white-space:nowrap;${isClosest ? 'font-weight:bold;' : ''}">${data.name}${isClosest ? ' 🏆' : ''}</label>`
                })
            }).addTo(revealMap);
            markers.push(guessMarker);
 
            L.polyline([guessLatLng, answerLatLng], {
                color: color,
                weight: isClosest ? 3 : 2,
                dashArray: isClosest ? null : '5, 5',
                opacity: isClosest ? 1 : 0.6
            }).addTo(revealMap);
        });
 
        // Render the leaderboard before fitting bounds so its rendered height is
        // known below — it's a fixed-position overlay sitting on top of the map
        // (not part of its layout flow), so a marker near the bottom of a naive
        // fitBounds result can end up completely hidden underneath it.
        renderRoundLeaderboard(results);

        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            const panelEl = document.getElementById('vs-round-leaderboard');
            const panelHeight = panelEl ? panelEl.getBoundingClientRect().height : 0;
            revealMap.fitBounds(group.getBounds(), {
                paddingTopLeft: [50, 50],
                paddingBottomRight: [50, panelHeight + 50]
            });
        }
        
        if (vsState.isHost) {
            const nextBtn = document.getElementById('btn-vs-next-round');
            nextBtn.classList.remove('hidden');
            if (vsState.currentRound < vsState.totalRounds) {
                nextBtn.textContent = 'NEXT ROUND';
            } else {
                nextBtn.textContent = 'FINAL RESULTS';
            }
            
            nextBtn.onclick = advanceRound;
            
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = setTimeout(advanceRound, 60000);
        }
    } catch (err) {
        console.error('Error in showRoundReveal:', err);
    }
}
 
function renderRoundLeaderboard(results) {
    try {
        const panel = document.getElementById('vs-round-leaderboard');
        if (!panel) return;
        panel.innerHTML = '';
        
        if (!results || !results.guesses) {
            console.warn('renderRoundLeaderboard: No guesses data');
            return;
        }
 
        // Sort all players present in this round's results by distance
        const playersThisRound = Object.entries(results.guesses).map(([peerId, data]) => {
            const player = vsState.players.find(p => p.peerId === peerId) || {};
            return {
                ...player,
                peerId,
                name: data.name || player.name || 'Unknown',
                roundData: data,
                scores: player.scores || []
            };
        }).sort((a, b) => {
            const distA = a.roundData ? a.roundData.distance : Infinity;
            const distB = b.roundData ? b.roundData.distance : Infinity;
            return distA - distB;
        });
 
        if (vsState.gameMode === 'coop') {
            const teamTotalScore = vsState.players.length > 0 
                ? (vsState.players[0].scores || []).reduce((a, b) => a + (b || 0), 0)
                : 0;
 
            const title = document.createElement('div');
            title.className = 'leaderboard-title';
            title.style.textAlign = 'center';
            title.style.marginBottom = '10px';
            title.innerHTML = `
                <div style="font-size: 12px; opacity: 0.8; text-transform: uppercase;">Team Total Score</div>
                <div style="font-size: 24px; color: var(--color-gold); font-weight: bold;">
                    ${teamTotalScore.toLocaleString()}
                </div>
            `;
            panel.appendChild(title);
 
            playersThisRound.forEach((player, index) => {
                const isClosest = player.peerId === results.closestPlayerId;
                const row = document.createElement('div');
                row.className = 'leaderboard-row';
                if (isClosest) row.classList.add('gold');
                
                const roundScore = player.roundData ? player.roundData.score : 0;
                const totalScore = player.scores.reduce((sum, s) => sum + (s || 0), 0);
 
                row.innerHTML = `
                <div class="row-rank-and-name">
                    <div class="row-rank">${index + 1}</div>
                    <div class="row-name">${player.name}${isClosest ? ' 🏆' : ''}</div>
                </div>
                    <div class="row-score">
                        <div style="font-size: 16px">${player.roundData && player.roundData.distance !== Infinity ? Math.round(player.roundData.distance).toLocaleString() + ' km' : 'No guess'}</div>
                        <div style="font-size: 11px; opacity:0.7">+${roundScore.toLocaleString()} pts (${totalScore.toLocaleString()} total)</div>
                    </div>
                `;
                panel.appendChild(row);
            });
        } else {
            playersThisRound.forEach((player, index) => {
                const roundData = player.roundData;
                const isClosest = player.peerId === results.closestPlayerId;
                const roundScore = roundData ? roundData.score : 0;
                const totalScore = player.scores.reduce((sum, s) => sum + (s || 0), 0);
                
                const row = document.createElement('div');
                row.className = 'leaderboard-row';
                if (isClosest) row.classList.add('gold');
                
                row.innerHTML = `
                <div class="row-rank-and-name">
                    <div class="row-rank">${index + 1}</div>
                    <div class="row-name">${player.name}${isClosest ? ' 🏆' : ''}</div>
                </div>
                    <div class="row-score">
                        <div style="font-size: 16px">${roundData && roundData.distance !== Infinity ? Math.round(roundData.distance).toLocaleString() + ' km' : 'No guess'}</div>
                        <div style="font-size: 11px; opacity:0.7">+${roundScore.toLocaleString()} pts (${totalScore.toLocaleString()} total)</div>
                    </div>
                `;
                panel.appendChild(row);
            });
        }
 
        // Add a slight delay to ensure parent transition doesn't interfere with child reveal
        setTimeout(() => {
            panel.classList.add('visible');
        }, 50);
    } catch (err) {
        console.error('Error in renderRoundLeaderboard:', err);
    }
}
 
function advanceRound() {
    clearTimeout(autoAdvanceTimeout);
    if (vsState.currentRound < vsState.totalRounds) {
        broadcastEvent('nextRound');
        vsState.currentRound++;
        startVsRound();
    } else {
        broadcastEvent('showResults', { roundResults: vsState.roundResults }); // LEADERBOARD FIX 2/3: send full results so guests have a complete copy
        showVsResults();
    }
}