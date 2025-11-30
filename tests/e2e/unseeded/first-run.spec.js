import { _electron as electron, test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../../config/test-environment.js';
import electronPath from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

test.describe('First run flow', () => {
  let app;
  let page;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const userDataDir = path.join(__dirname, '../../fixtures/test-user-data');
  // For first run, database_directory defaults to userData root (not userData/data)
  const dbDir = userDataDir;
  const musicDir = path.join(userDataDir, 'mp3');
  const hotkeysDir = path.join(userDataDir, 'hotkeys');
  const configPath = path.join(userDataDir, 'config.json');
  // Isolate HOME/APPDATA to avoid legacy migration paths
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));

  test.beforeAll(async () => {
    // Clean isolated userData
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.mkdirSync(userDataDir, { recursive: true });

    app = await electron.launch({
      executablePath: electronPath,
      args: ['.', '--profile=Default User'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_TEST_MODE: '1',
        DISABLE_HARDWARE_ACCELERATION: '1',
        AUTO_UPDATE: '0',
        E2E_USER_DATA_DIR: userDataDir,
        HOME: fakeHome,
        APPDATA: fakeHome,
      },
    });

    page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('creates DB, copies sample song, and shows first-run modal', async () => {
    // 1) First-run modal appears
    const firstRunModal = page.locator('#firstRunModal');
    await expect(firstRunModal).toBeVisible({ timeout: 10000 });
    await expect(firstRunModal).toBeVisible();

    // 2) Close the modal via the "Got It!" button
    const gotItButton = firstRunModal.getByRole('button', { name: 'Got It!' });
    await gotItButton.click();
    
    // On Windows, try multiple approaches to ensure modal is dismissed
    if (TEST_CONFIG.platform.isWindows) {
      // Wait for modal animation to complete
      await page.waitForTimeout(TEST_CONFIG.platform.modalAnimationTime);
      
      // Try pressing Escape as a fallback
      if (await firstRunModal.isVisible()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
      
      // Try clicking outside the modal
      if (await firstRunModal.isVisible()) {
        await page.mouse.click(100, 100); // Click outside modal
        await page.waitForTimeout(500);
      }
    }
    
    // Wait for modal to be hidden with extended timeout
    await expect(firstRunModal).toBeHidden({ timeout: TEST_CONFIG.platform.defaultTimeout });

    // 3) Click into the search bar
    const searchInput = page.locator('#omni_search');
    await searchInput.click();

    // 4) Hit Enter to search (empty query → should return seeded song)
    await searchInput.press('Enter');

    // 5) Verify exactly one result and it is the CSz Rock Bumper
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: TEST_CONFIG.platform.defaultTimeout });
    const firstRow = rows.first();
    await expect(firstRow).toContainText('Rock Bumper');
    await expect(firstRow).toContainText('Patrick Short');
    await expect(firstRow).toContainText('Uncategorized');

    // Pre-play UI state
    await expect(page.locator('#stop_button')).toBeDisabled();

    // 6) Double-click the result to start playback
    await firstRow.dblclick();

    // Verify playing UI state (pause button visible, stop enabled, now playing text shown)
    await expect(page.locator('#pause_button')).toBeVisible();
    await expect(page.locator('#stop_button')).not.toBeDisabled();
    await expect(page.locator('#song_now_playing')).toBeVisible();
    await expect(page.locator('#song_now_playing')).toContainText('Rock Bumper');

    // 7) Wait a moment and verify the timer is progressing
    const startTime = await page.locator('#timer').textContent();
    const startRemaining = await page.locator('#duration').textContent();
    await page.waitForTimeout(1200);
    const afterTime = await page.locator('#timer').textContent();
    const afterRemaining = await page.locator('#duration').textContent();
    expect(startTime).not.toEqual(afterTime);
    expect(startRemaining).not.toEqual(afterRemaining);

    // 8) Click Stop to stop playback and verify UI resets
    await page.locator('#stop_button').click();
    await expect(page.locator('#play_button')).toBeVisible();
    await expect(page.locator('#pause_button')).toHaveClass(/d-none/);
    await expect(page.locator('#stop_button')).toBeDisabled();
    await expect(page.locator('#song_now_playing')).toBeHidden();

    // Artifact checks
    expect(fs.existsSync(path.join(dbDir, 'mxvoice.db'))).toBeTruthy();
    expect(fs.existsSync(path.join(musicDir, 'PatrickShort-CSzRockBumper.mp3'))).toBeTruthy();
    expect(fs.existsSync(hotkeysDir)).toBeTruthy();
    expect(fs.existsSync(configPath)).toBeTruthy();
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(cfg.first_run_completed).toBe(true);
    expect(cfg.database_directory).toBe(dbDir);
    expect(cfg.music_directory).toBe(musicDir);
    expect(cfg.hotkey_directory).toBe(hotkeysDir);
  });


});


