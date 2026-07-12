// Config for the manual smoke suite (`npm run test:smoke`).
// The base config's testIgnore excludes smoke.spec.js even when named
// explicitly on the CLI, so smoke runs need their own config.
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';

export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: 'tests/e2e/smoke.spec.js',
});
