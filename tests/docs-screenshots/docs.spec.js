/**
 * Documentation screenshots (`npm run screenshots`).
 *
 * Stages the app with the demo library and writes the PNGs the website uses.
 * Each `test` is one image (or a small group); they share one app and run in
 * order. See README.md in this folder for where the files go.
 */
import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import electronPath from 'electron';
import { launchSeededApp, waitForAppReady } from '../utils/seeded-launch.js';
import { crashApp, relaunchApp } from '../utils/relaunch.js';
import { seedShows } from '../utils/seed-shows.js';
import { shownDialog, waitForShowMenuReady } from '../utils/show-e2e.js';
import { openTabActions, tabActionsMenu } from '../utils/tab-actions.js';
import { PLAYING_SONG, demoShows, otherProfileShows, seedDemoLibrary } from './demo-library.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// With MXVOICE_WEBSITE_DIR set, images go straight into a checkout of the
// website; otherwise into ./screenshots (gitignored), laid out the same way.
const WEBSITE = process.env.MXVOICE_WEBSITE_DIR ? path.resolve(process.env.MXVOICE_WEBSITE_DIR) : null;
const OUT = WEBSITE
  ? { docs: path.join(WEBSITE, 'public/docs'), illustrations: path.join(WEBSITE, 'src/assets/img/illustrations') }
  : { docs: path.join(REPO_ROOT, 'screenshots/docs'), illustrations: path.join(REPO_ROOT, 'screenshots/illustrations') };

const PROFILE = 'Default User';
const OTHER_PROFILE = 'Sam';
// Shown in the Preferences shot in place of the suite's fixture paths
const DISPLAY_PATHS = {
  '#preferences-song-directory': '/Users/you/Music/Mx. Voice',
  '#preferences-database-directory': '/Users/you/Library/Application Support/Mx. Voice',
  '#preferences-hotkey-directory': '/Users/you/Documents/Mx. Voice'
};

const file = (group, name) => path.join(OUT[group], `${name}.png`);

test.describe('Documentation screenshots', () => {
  let app;
  let page;
  let userDataDir;

  /** Light theme, and no animation or caret mid-flight in a capture. */
  async function prepare() {
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'light'; });
    await page.addStyleTag({ content: '*, *::before, *::after { caret-color: transparent !important; }' });
  }

  /** No focus ring and no hover tooltip in a capture. */
  async function settle() {
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.mouse.move(2, 2);
    await expect(page.locator('.tooltip')).toHaveCount(0);
  }

  /** A PNG of one element, with `pad` CSS pixels of its surroundings. */
  async function shoot(locator, target, { pad = 0 } = {}) {
    await expect(locator).toBeVisible();
    await settle();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!pad) {
      await locator.screenshot({ path: target, animations: 'disabled' });
      return;
    }
    const box = await locator.boundingBox();
    await page.screenshot({
      path: target,
      animations: 'disabled',
      clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 }
    });
  }

  /** The rectangle covering several elements, as a page clip. */
  async function shootUnion(locators, target, { pad = 0, keepPointer = false } = {}) {
    const boxes = [];
    for (const locator of locators) {
      await expect(locator).toBeVisible();
      boxes.push(await locator.boundingBox());
    }
    if (!keepPointer) await settle();
    const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
    const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
    const right = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
    const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await page.screenshot({ path: target, animations: 'disabled', clip: { x, y, width: right - x, height: bottom - y } });
  }

  async function shootWindow(target) {
    await settle();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await page.screenshot({ path: target, animations: 'disabled' });
  }

  /** Click a menu item from main, found by its path of labels under any top-level menu. */
  async function clickMenu(...labels) {
    await expect(async () => {
      const result = await app.evaluate(({ Menu, BrowserWindow }, wanted) => {
        const walk = (items, depth) => {
          for (const item of items ?? []) {
            if (item.label === wanted[depth]) {
              if (depth === wanted.length - 1) return item;
              const found = walk(item.submenu?.items, depth + 1);
              if (found) return found;
            }
            // The first label may sit under any top-level menu (Preferences moves by platform)
            if (depth === 0) {
              const found = walk(item.submenu?.items, 0);
              if (found) return found;
            }
          }
          return null;
        };
        const item = walk(Menu.getApplicationMenu()?.items, 0);
        if (!item) return `Menu item not found: ${wanted.join(' > ')}`;
        if (item.enabled === false) return `Menu item disabled: ${wanted.join(' > ')}`;
        const win = BrowserWindow.getAllWindows()[0];
        item.click({}, win, win.webContents);
        return 'ok';
      }, labels);
      expect(result).toBe('ok');
    }).toPass({ timeout: 10000 });
  }

  async function search(term = '') {
    const input = page.locator('#omni_search');
    await input.fill(term);
    await input.press('Enter');
    await expect(page.locator('#search_results tbody tr').first()).toBeVisible();
  }

  const modal = (id) => page.locator(`#${id}.show`);

  async function closeModal(id) {
    const dialog = page.locator(`#${id}`);
    // From the page: a dialog that keeps re-rendering never counts as stable for a real click
    await dialog.evaluate((el) => el.querySelector('.btn-close, [data-bs-dismiss="modal"]')?.click());
    await expect(dialog).toBeHidden();
  }

  const scrollSearchToTop = () =>
    page.evaluate(() => {
      let node = document.querySelector('#search_results');
      while (node && node !== document.body) {
        node.scrollTop = 0;
        node = node.parentElement;
      }
    });

  /** Play a hotkey for a moment so it carries a played count, then cut it. */
  async function playHotkey(key, times = 1) {
    for (let i = 0; i < times; i++) {
      await page.keyboard.press(key);
      await expect(page.locator('#pause_button')).toBeVisible();
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  }

  test.beforeAll(async () => {
    ({ app, page, userDataDir } = await launchSeededApp(electron, 'docs-screenshots', {
      // Twice the pixels on any display, so the images are sharp on the site
      extraArgs: ['--force-device-scale-factor=2'],
      beforeLaunch: (dir) => {
        seedDemoLibrary(dir);
        seedShows(dir, PROFILE, demoShows());
      }
    }));
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
    await prepare();
    await search();
  });

  test.afterAll(async () => {
    await app?.close().catch(() => {});
  });

  test.afterEach(async () => {
    // Leave nothing open for the next shot
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => {
      document.querySelectorAll('.modal.show .btn-close').forEach((button) => button.click());
    }).catch(() => {});
  });

  test('panels with played counts', async () => {
    await playHotkey('F1');
    await playHotkey('F4', 2);
    await playHotkey('F7');
    await playHotkey('F10', 3);
    // A holding tank play
    await page.locator('#holding_tank_1 li').nth(1).dblclick();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');

    await shoot(page.locator('#hotkeys-column'), file('docs', 'hotkeys-panel'));
    await shoot(page.locator('#hotkeys-column'), file('illustrations', 'interface-hotkeys'));
    await shoot(page.locator('#holding-tank-column'), file('docs', 'holding-tank'));
    await shoot(page.locator('#search-column'), file('docs', 'search-panel'));
    await shoot(page.locator('#search-column'), file('illustrations', 'interface-search-box'));
    await shoot(page.locator('#search-column .card-header'), file('docs', 'show-header'), { pad: 0 });
  });

  test('tab actions menu', async () => {
    const menu = await openTabActions(page, 'hotkeys');
    await shootUnion([page.locator('#hotkey_tabs'), menu], file('docs', 'tab-actions-menu'), { pad: 12, keepPointer: true });
    await page.keyboard.press('Escape');
    await expect(tabActionsMenu(page)).toBeHidden();
  });

  test('song context menu', async () => {
    // In the holding tank: a menu opened at the window's right edge is cut off
    const song = page.locator('#holding_tank_1 li').nth(1);
    await song.click({ button: 'right', position: { x: 60, y: 20 } });
    const menu = page.locator('#mxv-context-menu');
    await expect(menu).toBeVisible();
    await shootUnion([song, menu], file('docs', 'song-context-menu'), { pad: 12, keepPointer: true });
    await page.keyboard.press('Escape');
  });

  test('transport, waveform and the whole window', async () => {
    await search('');
    const row = page.locator(`#search_results tbody tr[songid="${PLAYING_SONG.id}"]`);
    await row.dblclick();
    await expect(page.locator('#pause_button')).toBeVisible();
    await page.waitForTimeout(6000);
    await scrollSearchToTop();
    await shoot(page.locator('#player-panel'), file('docs', 'playback-controls'));
    await shoot(page.locator('#player-panel'), file('illustrations', 'interface-playbox'));
    await shootWindow(file('illustrations', 'mxvoice-light'));

    await page.locator('#waveform_button').click();
    await expect(page.locator('#waveform-container')).toBeVisible();
    await page.waitForTimeout(1500);
    await shootUnion([page.locator('#waveform-container'), page.locator('#player-panel')], file('docs', 'waveform'));

    await page.locator('#waveform_button').click();
    await page.keyboard.press('Escape');
  });

  test('advanced search', async () => {
    await page.locator('#advanced_search_button').click();
    await expect(page.locator('#advanced-search')).toBeVisible();
    await page.locator('#title-search').fill('the');
    await page.locator('#title-search').press('Enter');
    await shoot(page.locator('#search-column'), file('docs', 'advanced-search'));
    await page.locator('#title-search').fill('');
    await page.locator('#advanced_search_button').click();
  });

  test('category filter', async () => {
    // The open dropdown is drawn by the OS, outside the page; show the filtered list instead
    await page.locator('#category_select').selectOption({ label: 'Sound Effects' });
    await search('');
    await shoot(page.locator('#search-column'), file('docs', 'category-select'));
    await page.locator('#category_select').selectOption({ index: 0 });
    await search('');
  });

  test('edit song', async () => {
    await page.locator('#search_results tbody tr').nth(2).click();
    await clickMenu('Songs', 'Edit Selected Song');
    await shoot(modal('songFormModal').locator('.modal-content'), file('docs', 'edit-song'));
    await closeModal('songFormModal');
  });

  test('add song', async () => {
    const clip = path.join(userDataDir, 'New Cue.mp3');
    fs.copyFileSync(path.join(userDataDir, 'music', PLAYING_SONG.filename), clip);
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, clip);
    await clickMenu('Songs', 'Add Song');
    const dialog = modal('songFormModal');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await page.locator('#song-form-title').fill('Halftime Jingle');
    await page.locator('#song-form-artist').fill('The Scoreboard');
    await page.locator('#song-form-info').fill('Halftime');
    await page.locator('#song-form-title').blur().catch(() => {});
    await shoot(dialog.locator('.modal-content'), file('docs', 'add-song'));
    await closeModal('songFormModal');
  });

  test('manage categories', async () => {
    await clickMenu('Songs', 'Manage Categories…');
    await shoot(modal('categoryManagementModal').locator('.modal-content'), file('docs', 'manage-categories'));
    await closeModal('categoryManagementModal');
  });

  test('preferences', async () => {
    await clickMenu('Preferences');
    const dialog = modal('preferencesModal');
    await expect(dialog).toBeVisible();
    // Display only: a user's own paths and the shipped defaults, not the test suite's
    await page.evaluate((paths) => {
      for (const [selector, value] of Object.entries(paths)) {
        const input = document.querySelector(selector);
        if (input) input.value = value;
      }
      document.querySelector('#preferences-fadeout-seconds').value = '3';
      document.querySelector('#preferences-debug-log-enabled').checked = false;
    }, DISPLAY_PATHS);
    await shoot(dialog.locator('.modal-content'), file('docs', 'preferences'));
    await closeModal('preferencesModal');
  });

  test('restore from backup', async () => {
    for (let i = 0; i < 2; i++) {
      await clickMenu('Profile', 'Create Backup Now');
      await page.waitForTimeout(2500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    await clickMenu('Profile', 'Restore from Backup…');
    const dialog = modal('backupRestoreModal');
    await expect(dialog.locator('#backup-restore-list')).not.toBeEmpty();
    await shoot(dialog.locator('.modal-content'), file('docs', 'restore-backup'));
    await closeModal('backupRestoreModal');
  });

  test('new profile', async () => {
    await clickMenu('Profile', 'New Profile…');
    const dialog = modal('newProfileModal');
    await expect(dialog).toBeVisible();
    await page.locator('#newProfileName').fill('Alex');
    await page.locator('#newProfileDescription').fill('Friday night sound booth');
    await page.locator('#newProfileDescription').blur();
    await shoot(dialog.locator('.modal-content'), file('docs', 'new-profile'));
    await closeModal('newProfileModal');
  });

  test('profile picker and import show', async () => {
    await page.evaluate(async (name) => {
      await window.secureElectronAPI.profile.createProfile(name, 'Saturday late show');
      await window.secureElectronAPI.profile.createProfile('Jordan', 'Workshops and classes');
    }, OTHER_PROFILE);
    seedShows(userDataDir, OTHER_PROFILE, otherProfileShows());

    await clickMenu('Profile', 'Switch Profile…');
    const picker = page.locator('#profileSwitchModal');
    await expect(picker.locator('#profile-content')).toBeVisible();
    await shoot(picker.locator('.modal-content'), file('docs', 'switch-profile'));
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();

    await clickMenu('Shows', 'Import Show from Another Profile…');
    const dialog = modal('importShowModal');
    await expect(dialog.locator('#importShowList')).not.toBeEmpty();
    await shoot(dialog.locator('.modal-content'), file('docs', 'import-show'));
    await closeModal('importShowModal');
  });

  test('unsaved changes and the crash prompt', async () => {
    // Change the layout so the header shows the unsaved dot
    await search('Applause');
    await page.locator('#search_results tbody tr').first().click();
    await page.keyboard.press('Shift+Tab');
    await search('');
    await expect(page.locator('#show-dirty')).toBeVisible();
    await shoot(page.locator('#search-column .card-header'), file('docs', 'show-unsaved'));

    // Give the recovery record time to be written, then crash and relaunch
    await page.waitForTimeout(3000);
    await crashApp(app);
    ({ app, page } = await relaunchApp(electron, userDataDir, { profile: PROFILE }));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.showInactive());
    const prompt = shownDialog(page, 'Restore show?');
    await expect(prompt).toBeVisible({ timeout: 20000 });
    await prepare();
    await shoot(prompt.locator('.modal-content'), file('docs', 'restore-show'));
  });

  test('startup profile launcher', async () => {
    await crashApp(app);
    // No --profile: the app opens on its launcher window, as a normal start does
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));
    app = await electron.launch({
      executablePath: electronPath,
      args: ['--force-device-scale-factor=2', '.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_TEST_MODE: '1',
        DISABLE_HARDWARE_ACCELERATION: '1',
        AUTO_UPDATE: '0',
        E2E_USER_DATA_DIR: userDataDir,
        HOME: fakeHome,
        APPDATA: fakeHome
      }
    });
    page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await prepare();
    await expect(page.locator('#profile-list li').first()).toBeVisible({ timeout: 20000 });
    await shootWindow(file('docs', 'profile-launcher'));
  });
});
