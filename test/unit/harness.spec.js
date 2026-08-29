// ============================================================
// FILE: test/unit/harness.spec.js
// PURPOSE: Trivial passing test proving the Vitest harness runs.
//          Item 1 of .docs/custom-maps/06-list-of-items.md.
//
// DEPENDENCIES:
//   - none
//
// USED BY:
//   - npm test
// ============================================================
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
    it('runs', () => {
        expect(1 + 1).toBe(2);
    });
});
