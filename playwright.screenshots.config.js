// Config for the documentation screenshots (`npm run screenshots`).
// Not a test suite: it stages the app with a demo library and writes PNGs.
// See tests/docs-screenshots/README.md.
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';

export default defineConfig({
  ...baseConfig,
  testDir: 'tests/docs-screenshots',
  testIgnore: [],
  testMatch: '**/*.spec.js',
  // One app, staged step by step
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  use: { ...baseConfig.use, trace: 'off', video: 'off', screenshot: 'off' },
});
