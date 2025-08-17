import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  use: {
    // screenshots, traces, etc as you like
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // CI tip: set workers to 1 if your app uses a shared profile/port
  workers: 1,
  globalSetup: 'tests/setup/global-setup.js',
  globalTeardown: 'tests/setup/global-teardown.js',
  // Exclude manual smoke tests from default runs; use yarn test:smoke to run them
  // Adjust the pattern so only the unseeded smoke file is excluded here
  // Note: paths are resolved from project root
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  // Custom project-level testIgnore
  // Playwright supports testIgnore at top level as of v1.30+
  // If older, we can filter via CLI. Here we exclude the unseeded smoke by path.
  testIgnore: [
    'tests/e2e/smoke.spec.js',
    'tests/e2e/unseeded/smoke.spec.js'
  ]
});
