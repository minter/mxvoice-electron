import { _electron as electron, test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { TEST_CONFIG } from '../config/test-environment.js';

test.describe('Mx. Voice App Smoke Tests', () => {
  let app;
  let page;

  test.beforeAll(async () => {
    // Launch your app in dev mode: pass your main entry and any flags your app expects.
    // Ensure isolated userData is clean
    const userDataDir = TEST_CONFIG.testAppDirs.userDataDirectory;
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.mkdirSync(userDataDir, { recursive: true });
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));

    app = await electron.launch({
      args: ['.'], // assumes "main" in package.json points at your entry file
      // If you need a specific Electron binary, set executablePath
      // executablePath: require('electron') as unknown as string
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // make the app deterministic in tests:
        AUTO_UPDATE: '0',
        DISABLE_HARDWARE_ACCELERATION: '1',
        APP_TEST_MODE: '1',
        E2E_USER_DATA_DIR: userDataDir,
        HOME: fakeHome,
        APPDATA: fakeHome
      }
    });
    page = await app.firstWindow();
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('boots and renders main window', async () => {
    await page.waitForLoadState('domcontentloaded');
    
    // Take a screenshot to see what we have
    await page.screenshot({ path: 'test-results/main-window.png' });
    
    // Log the page title
    const title = await page.title();
    console.log(`📱 Page title: ${title}`);
    
    // Check if we can see any content
    const bodyText = await page.textContent('body');
    if (bodyText) {
      console.log(`📄 Body content length: ${bodyText.length} characters`);
      console.log(`📄 Body content preview: ${bodyText.substring(0, 500)}...`);
    }
    
    // Just check that the page has some content
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
