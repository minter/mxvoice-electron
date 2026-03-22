import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  // CI runners are slower — give tests more room
  timeout: isCI ? 60_000 : 40_000,
  expect: {
    timeout: isCI ? 15_000 : 5_000,
  },
  // Retry flaky tests once on CI to distinguish real failures from timing issues
  retries: isCI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: isCI ? 10_000 : 5_000,
  },
  // Each test suite gets an isolated user-data directory, so parallel is safe.
  // CI: serialize to avoid resource contention on constrained runners.
  // Local: use PWWORKERS env var to override (e.g. PWWORKERS=1 npm test for serial).
  workers: isCI ? 1 : (parseInt(process.env.PWWORKERS, 10) || 4),
  globalSetup: 'tests/setup/global-setup.js',
  globalTeardown: 'tests/setup/global-teardown.js',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  testIgnore: [
    'tests/e2e/smoke.spec.js',
    'tests/e2e/unseeded/smoke.spec.js'
  ]
});
