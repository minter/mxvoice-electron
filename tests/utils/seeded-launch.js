import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { TEST_CONFIG } from '../config/test-environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function launchSeededApp(electron, suffix = '') {
  const userDataDir = path.join(__dirname, `../fixtures/test-user-data${suffix ? '-' + suffix : ''}`);

  // Clean isolated userData
  if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  // Write config to point to seeded DB and songs dir
  const config = {
    database_directory: TEST_CONFIG.testAppDirs.databaseDirectory,
    music_directory: TEST_CONFIG.testSongsDir,
    hotkey_directory: TEST_CONFIG.testAppDirs.hotkeyDirectory,
    first_run_completed: true,
    browser_width: 1200,
    browser_height: 800,
  };
  fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config, null, 2));

  // Isolate HOME/APPDATA
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));

  const app = await electron.launch({
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

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  return { app, page, userDataDir };
}

export async function closeApp(app) {
  if (app) await app.close();
}

export async function performEmptySearch(page) {
  const searchInput = page.locator('#omni_search');
  await searchInput.click();
  await searchInput.press('Enter');
}


