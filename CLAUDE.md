# GeoQuester — Project Brain

## Stack
Vite + vanilla JS. No frameworks. No TypeScript. No backend.
Capacitor wraps the Vite build for Android.

## LLM-Readability Rules
1. Every file has a header comment (see format below)
2. Header lists: purpose, dependencies, used-by, key functions
3. No file exceeds 150 lines — split if needed
4. All game state lives only in js/state.js
5. All constants and magic numbers live in js/config.js
6. CSS split by concern — never one big file

## Header Comment Format
### JS Format:
```javascript
// ============================================================
// FILE: js/example.js
// PURPOSE: One sentence describing what this file does.
//
// DEPENDENCIES:
//   - js/state.js       (what it reads/writes from state)
//   - js/config.js      (what constants it uses)
//
// USED BY:
//   - js/round.js       (how it is used)
//
// KEY FUNCTIONS:
//   - functionName(params)   one line description
// ============================================================
```

### CSS Format:
```css
/* ============================================================
   FILE: css/example.css
   PURPOSE: One sentence describing what this file does.

   RELATED:
   - css/layout.css     (why it relates)
   - js/round.js        (which JS file drives class changes)
   ============================================================ */
```

## File Map
- index.html: Single page shell
- main.js: Entry point
- CLAUDE.md: Project documentation
- css/base.css: Global styles and resets
- css/layout.css: Main screen layouts
- css/components.css: UI components (buttons, cards)
- css/game.css: Game-specific UI (timer, overlays)
- css/map.css: Guess map styles
- js/config.js: Constants and magic numbers
- js/state.js: Single source of truth for state
- js/lobby.js: Lobby screen handling
- js/streetview.js: Google Street View integration
- js/map.js: Leaflet guess map handling
- js/scoring.js: Scoring logic
- js/round.js: Round and game flow orchestration
- js/results.js: Results screen rendering
- js/multiplayer.js: Multiplayer stub

## Current Status
- [x] Project structure initialized
- [x] CLAUDE.md created
- [ ] Lobby config screen
- [ ] Street View loading
- [ ] Guess map
- [ ] Scoring
- [ ] Round flow
- [ ] Results screen
- [ ] Multiplayer (not started)
