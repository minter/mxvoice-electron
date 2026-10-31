import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import { launchSeededApp, waitForAppReady, performEmptySearch } from '../../../utils/seeded-launch.js';
import { seedShows } from '../../../utils/seed-shows.js';
import { assignF1, clickShowMenu, f1Hotkey, multiShowDocument, shownDialog, waitForShowMenuReady } from '../../../utils/show-e2e.js';
import { chooseTabAction, openTabActions, tabActionsMenu } from '../../../utils/tab-actions.js';

// While a dialog or menu is open, Return, Space and Esc belong to it, not to
// the app's playback shortcuts. A song selected in the search results is what
// Return would otherwise play.
// Seeded songs: 1001 Got The Time, 1002 The Wheel, 1003, 1004 We Are Family, 1005 Eat It.
const PROFILE = 'Default User';

const nowPlaying = (page) => page.locator('#song_now_playing');

test.describe('Keys under dialogs and menus', () => {
  let app;
  let page;
  let suiteRoot;

  test.beforeEach(async () => {
    ({ app, page, suiteRoot } = await launchSeededApp(electron, 'overlay-keys', {
      beforeLaunch: (dir) => seedShows(dir, PROFILE, multiShowDocument([
        { name: 'Main Show', hotkeys: { f1: '1002' } },
        { name: 'Encore', hotkeys: { f1: '1003' } }
      ]))
    }));
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002', { timeout: 10000 });

    // Select a song in the search results, with the focus off the search field
    await performEmptySearch(page);
    const row = page.locator('#search_results tbody tr').filter({ hasText: 'Got The Time' });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();
    await expect(page.locator('#selected_row')).toHaveAttribute('songid', '1001');
  });

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  async function playSelected() {
    await page.keyboard.press('Enter');
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1001', { timeout: 5000 });
    await expect(page.locator('#stop_button')).toBeEnabled();
  }

  async function openUnsavedChoice() {
    await assignF1(page, '1001');
    await expect(page.locator('#show-dirty')).toBeVisible({ timeout: 10000 });
    await page.locator('#search_results tbody tr').filter({ hasText: 'Got The Time' }).click();
    await clickShowMenu(app, 'Encore');
    const dialog = shownDialog(page, 'Unsaved changes');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    return dialog;
  }

  test('Return in a confirm takes its default (Cancel) and plays nothing', async () => {
    await chooseTabAction(page, 'hotkeys', 'clear');
    const dialog = shownDialog(page, 'Clear "Tab 1"?');
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused({ timeout: 5000 });

    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0, { timeout: 5000 });
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002');
    await page.waitForTimeout(500);
    await expect(nowPlaying(page)).not.toHaveAttribute('songid');
    await expect(page.locator('#stop_button')).toBeDisabled();
  });

  test('Esc closes a confirm and the playing song keeps playing', async () => {
    await playSelected();
    await chooseTabAction(page, 'hotkeys', 'clear');
    const dialog = shownDialog(page, 'Clear "Tab 1"?');
    // Bootstrap takes Esc once the dialog has the focus
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0, { timeout: 5000 });
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002');
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1001');
    await expect(page.locator('#stop_button')).toBeEnabled();
  });

  test('Return in a choice takes its default (Cancel) and plays nothing', async () => {
    const dialog = await openUnsavedChoice();

    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('#show-name')).toHaveText('Main Show');
    await page.waitForTimeout(500);
    await expect(nowPlaying(page)).not.toHaveAttribute('songid');
    await expect(page.locator('#stop_button')).toBeDisabled();
  });

  test('Esc closes a choice and the playing song keeps playing', async () => {
    await playSelected();
    const dialog = await openUnsavedChoice();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('#show-name')).toHaveText('Main Show');
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1001');
    await expect(page.locator('#stop_button')).toBeEnabled();
  });

  test('Return in the tab menu takes the focused item and plays nothing', async () => {
    const menu = await openTabActions(page, 'hotkeys');
    await expect(menu.locator('[data-action="rename"]')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(tabActionsMenu(page)).toBeHidden();
    const prompt = shownDialog(page, 'Rename Tab');
    await expect(prompt).toBeVisible({ timeout: 5000 });
    await expect(nowPlaying(page)).not.toHaveAttribute('songid');

    // Esc in the prompt cancels it and still plays nothing
    await expect(prompt.locator('.prompt-input')).toBeFocused({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(prompt).toHaveCount(0, { timeout: 5000 });
    await expect(nowPlaying(page)).not.toHaveAttribute('songid');
  });

  test('Esc with the song menu open closes it and still stops playback', async () => {
    await playSelected();
    // The song menu never takes the focus, so Esc stays the stop key
    const other = page.locator('#search_results tbody tr').filter({ hasText: 'We Are Family' });
    await other.click({ button: 'right' });
    const songMenu = page.locator('#mxv-context-menu');
    await expect(songMenu).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(songMenu).toBeHidden();
    await expect(nowPlaying(page)).not.toHaveAttribute('songid', { timeout: 5000 });
    await expect(page.locator('#stop_button')).toBeDisabled({ timeout: 5000 });
  });

  test('Return on the song form volume slider plays nothing', async () => {
    // The slider has class="mousetrap", so Mousetrap's own rule lets keys
    // through there; the dialog guard is what stops Return
    const row = page.locator('#search_results tbody tr').filter({ hasText: 'Got The Time' });
    await row.click({ button: 'right' });
    await page.locator('#mxv-context-menu .mxv-context-item').filter({ hasText: 'Edit' }).click();
    const form = page.locator('#songFormModal');
    await expect(form).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#songFormModalTitle')).toContainText('Edit This Song');
    const slider = page.locator('#song-form-volume');
    await slider.focus();
    await expect(slider).toBeFocused();

    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(nowPlaying(page)).not.toHaveAttribute('songid');
    await expect(page.locator('#stop_button')).toBeDisabled();
  });

  test('F1 still plays its hotkey while a dialog is open', async () => {
    await chooseTabAction(page, 'hotkeys', 'clear');
    const dialog = shownDialog(page, 'Clear "Tab 1"?');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('F1');
    await expect(nowPlaying(page)).toHaveAttribute('songid', '1002', { timeout: 5000 });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 5000 });
  });
});
