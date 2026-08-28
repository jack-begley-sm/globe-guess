// ============================================================
// FILE: vitest.config.js
// PURPOSE: Vitest configuration for the custom-maps test suite —
//          node environment by default, jsdom for acceptance specs.
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
        environment: 'node',
        include: ['test/**/*.spec.js'],
        environmentMatchGlobs: [['test/acceptance/**', 'jsdom']],
        coverage: { include: ['js/**'], reporter: ['text', 'lcov'] }
    }
});
