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

  test('shows the main window and title', async () => {
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

  test('can find basic page elements', async () => {
    // Wait a bit for the page to fully load
    await page.waitForTimeout(2000);
    
    // Take another screenshot
    await page.screenshot({ path: 'test-results/basic-elements.png' });
    
    // Try to find any elements on the page
    const anyElement = await page.locator('*').first();
    if (await anyElement.count() > 0) {
      console.log('✅ Found elements on the page');
      
      // Log what elements we found
      const elements = await page.locator('*').all();
      console.log(`📊 Found ${elements.length} total elements`);
      
      // Try to find some common elements
      const buttons = await page.locator('button').all();
      console.log(`🔘 Found ${buttons.length} buttons`);
      
      const inputs = await page.locator('input').all();
      console.log(`📝 Found ${inputs.length} inputs`);
      
      const links = await page.locator('a').all();
      console.log(`🔗 Found ${links.length} links`);
      
    } else {
      console.log('⚠️ No elements found on the page');
    }
    
    // Basic assertion - page should have content
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('can interact with the page', async () => {
    // Wait for page to be ready
    await page.waitForTimeout(2000);
    
    // Try to click somewhere on the page
    await page.click('body');
    
    // Try to find and interact with any button
    const buttons = page.locator('button');
    if (await buttons.count() > 0) {
      console.log('🔘 Found buttons, trying to interact');
      
      // Click the first button
      await buttons.first().click();
      console.log('✅ Clicked first button');
    }
    
    // Try to find and interact with any input
    const inputs = page.locator('input');
    if (await inputs.count() > 0) {
      console.log('📝 Found inputs, trying to interact');
      
      // Fill the first input
      await inputs.first().fill('test input');
      console.log('✅ Filled first input');
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/interaction-test.png' });
  });
});
