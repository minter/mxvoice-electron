// This smoke test is retained for manual runs via `yarn test:smoke`.
// It is intentionally excluded from CI's default suite by moving it under `tests/e2e/unseeded/`.
import { _electron as electron, test, expect } from '@playwright/test';
import electronPath from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

test.describe('Mx. Voice App Smoke Tests (manual)', () => {
  let app;
  let page;

  test.beforeAll(async () => {
    // Minimal, ad-hoc userDataDir for a pure boot check
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const userDataDir = path.join(__dirname, '../../fixtures/test-user-data-smoke');
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.mkdirSync(userDataDir, { recursive: true });
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));

    app = await electron.launch({
      executablePath: electronPath,
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
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
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
