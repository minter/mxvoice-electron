import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { TEST_CONFIG } from '../config/test-environment.js';

test.describe('Seeded database flow', () => {
  let app;
  let page;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const userDataDir = path.join(__dirname, '../fixtures/test-user-data');
  const dbDir = TEST_CONFIG.testAppDirs.databaseDirectory;
  const musicDir = TEST_CONFIG.testSongsDir;

  test.beforeAll(async () => {
    // Clean isolated userData
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.mkdirSync(userDataDir, { recursive: true });

    // Write app config so it points to the predefined DB and songs dir
    const config = {
      database_directory: dbDir,
      music_directory: musicDir,
      hotkey_directory: TEST_CONFIG.testAppDirs.hotkeyDirectory,
      first_run_completed: true,
      browser_width: 1200,
      browser_height: 800,
    };
    fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config, null, 2));

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
    if (app) await app.close();
  });

  test('search returns all seeded songs', async () => {
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(TEST_CONFIG.schema.songs.length, { timeout: 5000 });

    // Verify each seeded title appears
    for (const song of TEST_CONFIG.schema.songs) {
      await expect(page.locator('#search_results')).toContainText(song.title);
    }
  });
});


