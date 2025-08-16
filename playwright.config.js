import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    // Remove baseURL since we're not using a web server
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  
  // Remove webServer configuration - Electron apps don't use web servers
  
  globalSetup: './tests/setup/global-setup.js',
  globalTeardown: './tests/setup/global-teardown.js',
  
  // Test timeout
  timeout: 30000,
  
  // Expect timeout
  expect: {
    timeout: 10000,
  },
});
