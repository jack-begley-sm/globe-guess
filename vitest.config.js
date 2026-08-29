// ============================================================
// FILE: vitest.config.js
// PURPOSE: Vitest configuration for the custom-maps test suite. jsdom
//          globally — see the item-6 (list 2) progress log entry:
//          `environmentMatchGlobs` (the previous node/jsdom split) does
//          not exist anywhere in vitest 4's type surface — it was
//          silently a no-op since item 1 of list 1, unnoticed until an
//          acceptance test finally needed `document`. jsdom provides
//          no less than plain node for pure-logic tests, so one
//          environment for everything is the robust fix, not a
//          per-file `@vitest-environment` directive sprinkled forever.
//
// DEPENDENCIES:
//   - none
//
// USED BY:
//   - npm test / npm run test:watch / npm run test:cov
// ============================================================
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['test/**/*.spec.js'],
        coverage: { include: ['js/**'], reporter: ['text', 'lcov'] }
    }
});
