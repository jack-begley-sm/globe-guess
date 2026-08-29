// ============================================================
// FILE: test/unit/state-shape.spec.js
// PURPOSE: Unit tests for the `shape` field added to state.js,
//          vs-state.js and su-state.js (item 19) — defaults and the
//          decided reset() behaviour. Lobby DOM wiring itself is
//          covered by acceptance scenarios only, per
//          .docs/custom-maps/03-test-strategy.md.
//
// DEPENDENCIES:
//   - js/state.js, js/vs-state.js, js/su-state.js
//   - js/geo/shapes.js
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { state, resetState } from '../../js/state.js';
import { vsState } from '../../js/vs-state.js';
import { suState } from '../../js/su-state.js';
import { getShape } from '../../js/geo/shapes.js';

describe('state.shape', () => {
    it('defaults to the WORLD shape', () => {
        expect(state.shape).toBe(getShape('WORLD'));
    });

    it('resetState() resets shape back to WORLD, following region', () => {
        state.region = 'UK';
        state.shape = getShape('UK');
        resetState();
        expect(state.region).toBe('WORLD');
        expect(state.shape).toBe(getShape('WORLD'));
    });
});

describe('vsState.shape', () => {
    it('defaults to the WORLD shape', () => {
        expect(vsState.shape).toBe(getShape('WORLD'));
    });

    it('reset() deliberately leaves region/shape untouched ("Play Again" keeps the region)', () => {
        vsState.region = 'EUROPE';
        vsState.shape = getShape('EUROPE');
        vsState.reset();
        expect(vsState.region).toBe('EUROPE');
        expect(vsState.shape).toBe(getShape('EUROPE'));
    });
});

describe('suState.shape', () => {
    it('defaults to the WORLD shape', () => {
        expect(suState.shape).toBe(getShape('WORLD'));
    });
});
