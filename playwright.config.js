import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    // screenshots, traces, etc as you like
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // CI tip: set workers to 1 if your app uses a shared profile/port
  workers: 1,
});
