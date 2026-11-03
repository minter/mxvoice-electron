import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import { launchSeededApp, waitForAppReady, performEmptySearch, clearModalBackdrop } from '../../../utils/seeded-launch.js';
import { seedShows } from '../../../utils/seed-shows.js';
import { clickShowMenu, multiShowDocument, waitForShowMenuReady } from '../../../utils/show-e2e.js';

// The song context menu on a hotkey slot marks the slot as its target. It must
// not rename the slot: the F-key and a show switch find slots by their id.
// Seeded songs: 1001 Got The Time, 1004 We Are Family, 1005 Eat It.
const PROFILE = 'Default User';

const nowPlaying = (page) => page.locator('#song_now_playing');
const slot = (page, key) => page.locator(`#hotkeys_list_1 #${key}_hotkey`);
const menu = (page) => page.locator('#mxv-context-menu');
const menuItem = (page, name) => menu(page).getByRole('button', { name, exact: true });

test.describe('Hotkeys - context menu target', () => {
  let app;
  let page;
  let suiteRoot;

  test.beforeEach(async () => {
    ({ app, page, suiteRoot } = await launchSeededApp(electron, 'hotkey-context-target', {
      beforeLaunch: (dir) => seedShows(dir, PROFILE, multiShowDocument([
        { name: 'Main Show', hotkeys: { f2: '1001', f3: '1005' } },
        { name: 'Encore', hotkeys: { f3: '1004' } }
      ]))
    }));
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
    await expect(slot(page, 'f3')).toHaveAttribute('songid', '1005', { timeout: 10000 });
    await expect(slot(page, 'f2')).toHaveAttribute('songid', '1001');
  });

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  async function rightClickF3() {
    await slot(page, 'f3').click({ button: 'right' });
    await expect(menu(page)).toBeVisible({ timeout: 2000 });
    await expect(slot(page, 'f3')).toHaveAttribute('data-context-target', 'true');
  }

  async function closeMenu() {
    await page.locator('#song_now_playing').click({ force: true });
    await expect(menu(page)).toBeHidden();
  }

  test('right-click F3, press F2, F3 still plays', async () => {
    await rightClickF3();
    await page.keyboard.press('F2');
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1001', { timeout: 5000 });
    await expect(slot(page, 'f3')).toHaveCount(1);

    await closeMenu();
    await expect(page.locator('[data-context-target]')).toHaveCount(0);
    await page.keyboard.press('F3');
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1005', { timeout: 5000 });
  });

  test('right-click F3, switch shows, F3 shows the new show\'s song', async () => {
    await rightClickF3();
    await clickShowMenu(app, 'Encore');
    await expect(page.locator('#show-name')).toHaveText('Encore', { timeout: 10000 });

    // The switch closes the menu, so it can't act on the new show's song
    await expect(menu(page)).toBeHidden();
    await expect(page.locator('[data-context-target]')).toHaveCount(0);
    await expect(slot(page, 'f3')).toHaveAttribute('songid', '1004');
    await expect(slot(page, 'f3').locator('.song')).toContainText('We Are Family');
    await expect(slot(page, 'f2')).not.toHaveAttribute('songid');

    await closeMenu();
    await page.keyboard.press('F3');
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1004', { timeout: 5000 });
  });

  test('a show switch during the Remove from Hotkey confirm leaves the new show\'s song', async () => {
    await rightClickF3();
    await menuItem(page, 'Remove from Hotkey').click();
    const confirmModal = page.locator('.modal.show').filter({ hasText: 'remove Eat It from this hotkey' });
    await expect(confirmModal).toBeVisible({ timeout: 5000 });

    await clickShowMenu(app, 'Encore');
    await expect(page.locator('#show-name')).toHaveText('Encore', { timeout: 10000 });
    await expect(slot(page, 'f3')).toHaveAttribute('songid', '1004');

    await confirmModal.locator('.confirm-btn').click();
    await expect(confirmModal).toBeHidden({ timeout: 5000 });
    await clearModalBackdrop(page);
    await expect(slot(page, 'f3')).toHaveAttribute('songid', '1004');
    await expect(slot(page, 'f3').locator('.song')).toContainText('We Are Family');
  });

  test('context-menu Play / Edit / Mark as Unplayed on a hotkey act on that hotkey', async () => {
    // A search row is selected first; the menu acts on the hotkey, not on it
    await performEmptySearch(page);
    const searchRow = page.locator('#search_results tbody tr').filter({ hasText: 'We Are Family' });
    await searchRow.click();
    await expect(page.locator('#selected_row')).toHaveAttribute('songid', '1004');

    // Play, after another F-key was pressed with the menu open
    await rightClickF3();
    await page.keyboard.press('F2');
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1001', { timeout: 5000 });
    await menuItem(page, 'Play').click();
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1005', { timeout: 5000 });
    await expect(slot(page, 'f3')).not.toHaveAttribute('data-context-target');
    await expect(slot(page, 'f3').locator('.played-pill')).toHaveAttribute('data-count', '1', { timeout: 3000 });

    // Edit, after another F-key was pressed with the menu open
    await rightClickF3();
    await page.keyboard.press('F2');
    await expect(slot(page, 'f2').locator('.played-pill')).toHaveAttribute('data-count', '2', { timeout: 3000 });
    await menuItem(page, 'Edit').click();
    const modal = page.locator('#songFormModal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#song-form-title')).toHaveValue('Eat It');
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden({ timeout: 5000 });
    await clearModalBackdrop(page);
    await expect(slot(page, 'f3')).not.toHaveAttribute('data-context-target');

    // Mark as Unplayed clears F3's song, not F2's
    await rightClickF3();
    await expect(menuItem(page, 'Mark as Unplayed')).toBeVisible();
    await menuItem(page, 'Mark as Unplayed').click();
    await expect(slot(page, 'f3').locator('.played-pill')).toHaveCount(0);
    await expect(slot(page, 'f2').locator('.played-pill')).toHaveAttribute('data-count', '2');
    await expect(slot(page, 'f3')).not.toHaveAttribute('data-context-target');

    // The slot kept its id throughout
    await page.keyboard.press('F3');
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1005', { timeout: 5000 });
  });

  test('Songs > Edit Selected Song with the menu open on a hotkey edits that hotkey\'s song', async () => {
    await rightClickF3();
    const result = await app.evaluate(({ Menu, BrowserWindow }) => {
      const songs = Menu.getApplicationMenu()?.items?.find((i) => i.label === 'Songs');
      const item = songs?.submenu?.items?.find((i) => i.label === 'Edit Selected Song');
      if (!item) return false;
      const win = BrowserWindow.getAllWindows()[0];
      item.click({}, win, win.webContents);
      return true;
    });
    expect(result).toBe(true);
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#song-form-title')).toHaveValue('Eat It');
  });
});
