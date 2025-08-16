import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

test.describe('First run flow', () => {
  let app;
  let page;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const userDataDir = path.join(__dirname, '../fixtures/test-user-data');
  // For first run, database_directory defaults to userData root (not userData/data)
  const dbDir = userDataDir;
  const musicDir = path.join(userDataDir, 'mp3');

  test.beforeAll(async () => {
    // Clean isolated userData
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.mkdirSync(userDataDir, { recursive: true });

    // Isolate HOME/APPDATA to avoid legacy migration paths
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));

    app = await electron.launch({
      args: ['.'],
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
    await page.waitForSelector('#firstRunModal.show', { timeout: 15000 });
    const firstRunModal = page.locator('#firstRunModal');
    await expect(firstRunModal).toBeVisible();

    // 2) Close the modal via the "Got It!" button
    await firstRunModal.getByRole('button', { name: 'Got It!' }).click();
    await expect(firstRunModal).toBeHidden();

    // 3) Click into the search bar
    const searchInput = page.locator('#omni_search');
    await searchInput.click();

    // 4) Hit Enter to search (empty query → should return seeded song)
    await searchInput.press('Enter');

    // 5) Verify exactly one result and it is the CSz Rock Bumper
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    const firstRow = rows.first();
    await expect(firstRow).toContainText('Rock Bumper');
    await expect(firstRow).toContainText('Patrick Short');

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
  });
});


