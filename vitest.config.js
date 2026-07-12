import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    testTimeout: 10000,
    // Needed for node-sqlite3-wasm WASM initialization
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/main/modules/**/*.js', 'src/renderer/modules/**/*.js'],
      exclude: ['**/README.md'],
      thresholds: {
        // Initial floor based on the first whole-source report. Raise these as
        // previously E2E-only modules gain focused unit coverage.
        lines: 32,
        functions: 31,
        statements: 32,
        branches: 26,
      },
      reportOnFailure: true,
    },
  },
});
