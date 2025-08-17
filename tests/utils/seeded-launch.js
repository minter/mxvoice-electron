import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { TEST_CONFIG } from '../config/test-environment.js';
import electronPath from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function launchSeededApp(electron, suffix = '') {
  // Create a unique per-suite root and per-suite userDataDir
  const suiteId = `${suffix || 'suite'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const suiteRoot = path.join(__dirname, `../fixtures/suites/${suiteId}`);
  const userDataDir = path.join(suiteRoot, 'user-data');

  // Clean and create isolated userData and subdirectories inside it
  if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const suiteDbDir = path.join(userDataDir, 'db');
  const suiteMusicDir = path.join(userDataDir, 'music');
  const suiteHotkeysDir = path.join(userDataDir, 'hotkeys');
  fs.mkdirSync(suiteDbDir, { recursive: true });
  fs.mkdirSync(suiteMusicDir, { recursive: true });
  fs.mkdirSync(suiteHotkeysDir, { recursive: true });

  // Seed per-suite DB by copying the canonical seeded DB
  try {
    const seededDb = path.join(TEST_CONFIG.testAppDirs.databaseDirectory, 'mxvoice.db');
    const targetDb = path.join(suiteDbDir, 'mxvoice.db');
    if (fs.existsSync(seededDb)) {
      fs.copyFileSync(seededDb, targetDb);
    }
  } catch {}

  // Seed per-suite music dir by copying only schema-defined seed songs
  try {
    const testSongsSourceDir = TEST_CONFIG.testSongsDir;
    for (const song of TEST_CONFIG.schema.songs) {
      const src = path.join(testSongsSourceDir, song.filename);
      const dest = path.join(suiteMusicDir, song.filename);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  } catch {}

  // Write config to point to the per-suite DB and music dirs
  const config = {
    database_directory: suiteDbDir,
    music_directory: suiteMusicDir,
    hotkey_directory: suiteHotkeysDir,
    first_run_completed: true,
    browser_width: 1200,
    browser_height: 800,
  };
  fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config, null, 2));

  // Diagnostics: output isolated paths and file listings
  try {
    const listDir = (dir) => {
      try {
        return fs.readdirSync(dir, { withFileTypes: true })
          .map((d) => (d.isDirectory() ? `${d.name}/` : d.name))
          .sort();
      } catch {
        return [];
      }
    };
    console.log('🧪 Using isolated suite root:', suiteRoot);
    console.log('   - userDataDir:', userDataDir, 'files:', listDir(userDataDir));
    console.log('   - db dir:', suiteDbDir, 'files:', listDir(suiteDbDir));
    console.log('   - music dir:', suiteMusicDir, 'files:', listDir(suiteMusicDir));
    console.log('   - hotkeys dir:', suiteHotkeysDir, 'files:', listDir(suiteHotkeysDir));
    try {
      const cfgStr = fs.readFileSync(path.join(userDataDir, 'config.json'), 'utf-8');
      console.log('   - config.json:', cfgStr);
    } catch {}
  } catch {}

  // Isolate HOME/APPDATA
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));

  const app = await electron.launch({
    executablePath: electronPath,
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

  return { app, page, userDataDir, suiteRoot, suiteDbDir, suiteMusicDir, suiteHotkeysDir };
}

export async function closeApp(app) {
  if (app) await app.close();
}

export async function performEmptySearch(page) {
  const searchInput = page.locator('#omni_search');
  await searchInput.click();
  await searchInput.press('Enter');
}


