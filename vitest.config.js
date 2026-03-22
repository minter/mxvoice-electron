import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    testTimeout: 10000,
    // Needed for node-sqlite3-wasm WASM initialization
    pool: 'forks',
  },
});
