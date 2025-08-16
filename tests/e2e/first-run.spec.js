import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

test.describe('First run flow', () => {
  let app;
  let page;

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
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
    await app.close();
  });

  test('creates DB, copies sample song, and shows first-run modal', async () => {
    await page.waitForSelector('#firstRunModal.show', { timeout: 15000 });
    await expect(page.locator('#firstRunModal')).toBeVisible();

    expect(fs.existsSync(path.join(dbDir, 'mxvoice.db'))).toBeTruthy();
    expect(fs.existsSync(path.join(musicDir, 'PatrickShort-CSzRockBumper.mp3'))).toBeTruthy();
  });
});


