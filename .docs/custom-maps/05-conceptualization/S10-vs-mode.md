# S10 — VS / Co-op

## Goal
The host picks a custom area before the lobby exists, every guest plays in it,
and everyone is scored against the same scale.

## Depends on
S09.

## Files touched
`js/vs-lobby.js`, `js/vs-host.js`, `js/vs-guest.js`, `js/vs-round.js`,
`js/vs-state.js`, `js/user.js` (session), `index.html` (Custom tile in
`#vs-region-grid`), `test/support/fakes/peer.js` (new),
`features/custom-vs-game.feature` (new) + spec.

## Ordering constraint

The brief is specific: the area is chosen **before the lobby**. So in
`handleSetupNext` (`js/vs-lobby.js:85`), when the selected region is `CUSTOM`:

```
name + rounds validated
   → screen-custom-draw
   → on confirm: generate room code, initHost(), build share URL
   → screen-multiplayer-share → screen-multiplayer-lobby
```

Room creation moves *after* the draw. No guest can ever connect to a room whose
play area is undefined, which removes a whole class of race condition rather than
handling it. Note the existing re-host branch at `js/vs-lobby.js:110` ("Play Again" keeps the
room code) — that path must keep the existing shape, not force a redraw.

## Wire format

The ring goes in the existing `gameState` payload of `broadcastPlayers`
(`js/vs-host.js:132`, payload at `:140`), alongside `region`:

```js
gameState: {
    ...,
    region: vsState.region,           // 'CUSTOM'
    ring: vsState.shape.ring          // [{lat, lng}] — unrolled, ≤24 vertices
}
```

Guests rebuild locally with `makeCustomShape(ring)` rather than receiving
`scaleKm`. Recomputing is ~2 KB of arithmetic and guarantees host and guest agree
on the scale by construction — if they disagree, it is a code-version mismatch
that a transmitted number would have hidden.

At 24 vertices the ring is roughly 700 bytes of JSON. `broadcastPlayers` fires on
every join and disconnect, so this is not free, but it is far below anything
PeerJS cares about. Do not add it to per-round messages as well — once per
`playersUpdate` is enough, and round messages already carry the location.

## Acceptance scenarios

```gherkin
Feature: A custom area in a VS game

  Scenario: The host draws the area before the room is created
    Given the host has chosen VS mode with a custom area
    When the host confirms the area
    Then the room code is created
    And the share screen is shown

  Scenario: A guest joining receives the area
    Given a host has created a VS room with a custom area
    When a guest joins the room
    Then the guest's play area matches the host's
    And the guest's scale matches the host's

  Scenario: A guest joining mid-game receives the area
    Given a VS game with a custom area is in progress
    When a guest joins the room
    Then the guest's play area matches the host's

  Scenario: All players are scored against the same scale
    Given a VS game in a custom area whose scale is 200 km
    When one player guesses 10 km away and another guesses 60 km away
    Then the first scores 3951 points
    And the second scores 556 points

  Scenario: A guest in the lobby already knows the area
    Given a host has created a VS room with a custom area
    And a guest has joined but the game has not started
    Then the guest's play area matches the host's

  Scenario: Guests cannot guess outside the area
    Given a VS game with a custom area is in progress
    When a guest taps outside the play area
    Then no pin is placed

  Scenario: Refreshing mid-game keeps the area
    Given a guest is playing a VS game in a custom area
    When the guest refreshes the page
    Then the guest rejoins with the same play area

  Scenario: Playing again keeps the area
    Given a VS game in a custom area has finished
    When the host chooses play again
    Then the same area is used
    And the room code is unchanged
```

Those two numbers: scale 200 km → cutoff 90 km. A 10 km miss is r = 0.05 →
`5000 × (1 − 0.05/0.45)² = 3951`; a 60 km miss is r = 0.3 → `556`. A 100 km miss
would be past the cutoff and score 0 — worth adding as a third player if you want
the cutoff exercised in a multiplayer round.

## Inner loop
1. PeerJS fake: `new Peer(code)` registers; `connect(code)` returns a linked pair.
2. `vsState.shape`; survives `reset()` (which currently clears scores and results
   but not region — check it does not clear the shape either).
3. Host: `CUSTOM` branch in `handleSetupNext`, room creation deferred.
4. Host: ring in `gameState`.
5. Guest: `js/vs-guest.js:125` — on **every** `playersUpdate`, if
   `payload.gameState.ring` is present, rebuild the shape. Today the guest only
   ever reads the region inside `resumeInProgressRound` (`js/vs-round.js:126`),
   which fires only when `gameState.inProgress` — so a guest sitting in the lobby
   before kickoff has no play area at all. That is invisible today because the
   guest never needs the region before a round starts; with a custom area it
   becomes a bug the moment they open the guess map. Handle the ring at the
   `playersUpdate` level, above the `inProgress` check, and also keep it in
   `resumeInProgressRound` for the rejoin path. Assert host and guest `scaleKm`
   agree to within 0.001 km.
6. `js/vs-round.js:410` — pass `vsState.shape.scaleKm`.
7. `js/vs-round.js:40/50` — `getRandomLocation(vsState.shape)`.
8. Session (`saveSession` in `js/user.js`) stores the ring so the restore path in
   `main.js:252` rebuilds the shape. Ring is small enough for localStorage.
9. `resumeInProgressRound` (`js/vs-round.js:115`) sets the shape **before**
   `initVsMap()` at line 129, or the first tap is guarded against an undefined
   area.
10. VS has its own guess map — S08's `js/map-overlay.js` must be wired into
   `initVsMap`/`placeVsMarker` here if S08 did not already do it.

## Exit criteria
- [ ] All scenarios green against the PeerJS fake.
- [ ] Host and guest `scaleKm` identical, asserted.
- [ ] Two real devices (or two browser profiles): host draws, guest joins by link,
      both see the same outline, scores agree.
- [ ] Refresh-mid-game on the guest restores the area.
- [ ] Co-op mode checked as well as VS — it shares this code path.

## Watch out for
`joinGame`/`joinSuGame` destroy any existing peer on call, and `main.js` already
carries re-entrancy guards for that. The Custom branch adds a new async gap
(drawing) between "host clicks Next" and "room exists" — make sure the Next
button is disabled for the duration, or a double-tap creates two rooms.
