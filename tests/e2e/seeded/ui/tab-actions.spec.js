import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import { launchSeededApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import { readRecovery, seedShows, showsDocument } from '../../../utils/seed-shows.js';
import { shownDialog } from '../../../utils/show-e2e.js';
import { CLEAR_TAB_MESSAGE, TAB_STRIPS, chooseTabAction, openTabActions, tabActionsMenu } from '../../../utils/tab-actions.js';

// Seeded songs: 1001 Got The Time, 1002 The Wheel, 1003, 1004 We Are Family, 1005 Eat It.
const PROFILE = 'Default User';

// A saved show with songs on two tabs of each panel
const LAYOUT = {
  hotkeys: [
    { tabNumber: 1, tabName: null, hotkeys: { f1: '1001', f2: '1002' } },
    { tabNumber: 2, tabName: 'Intros', hotkeys: { f1: '1004' } }
  ],
  holdingTank: [
    { tabNumber: 1, tabName: null, songIds: ['1004', '1005'] },
    { tabNumber: 3, tabName: 'Walk-ons', songIds: ['1001'] }
  ],
  selected: { hotkeyTab: 1, holdingTankTab: 1 }
};

const hotkeyTab = (page, n) => page.locator(`#hotkey_tabs a[href="#hotkeys_list_${n}"]`);
const holdingTab = (page, n) => page.locator(`#holding_tank_tabs a[href="#holding_tank_${n}"]`);
const holdingItems = (page, n) => page.locator(`#holding_tank_${n} .list-group-item`);
const hotkeySong = (page, n, key) => page.locator(`#hotkeys_list_${n} [id^="${key}_hotkey"] .song`);
const menuItem = (page, action) => tabActionsMenu(page).locator(`[data-action="${action}"]`);
const recoveredHoldingTab = (doc, n) => doc?.layout?.holdingTank?.find((tab) => tab.tabNumber === n)?.songIds ?? null;

test.describe('Tab actions - ⋯ menu and right-click', () => {
  let app;
  let page;
  let userDataDir;
  let suiteRoot;

  test.beforeEach(async () => {
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'tab-actions', {
      beforeLaunch: (dir) => seedShows(dir, PROFILE, showsDocument(LAYOUT, { name: 'Main Show', id: '00000000-0000-4000-8000-000000000001' }))
    }));
    await waitForAppReady(page, app);
    await expect(holdingItems(page, 1)).toHaveCount(2, { timeout: 10000 });
    await expect(hotkeyTab(page, 2)).toHaveText('Intros');
  });

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  test('the header keeps only its label and toggle; ⋯ ends each tab row without stretching', async () => {
    for (const id of ['hotkey-rename-btn', 'hotkey-clear-btn', 'holding-tank-rename-btn', 'holding-tank-clear-btn']) {
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    }
    for (const strip of Object.values(TAB_STRIPS)) {
      const button = page.locator(`${strip} > li:last-child .tab-actions-btn`);
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('aria-label', 'Tab actions');
      await expect(button).toHaveAttribute('title', 'Tab actions');
      const buttonBox = await button.boundingBox();
      const tabBox = await page.locator(`${strip} .nav-link`).first().boundingBox();
      expect(buttonBox.width).toBeLessThan(tabBox.width);
      expect(buttonBox.width).toBeLessThanOrEqual(40);
      // Same row as the tabs
      expect(Math.abs(buttonBox.y + buttonBox.height - (tabBox.y + tabBox.height))).toBeLessThanOrEqual(2);
    }
  });

  test('⋯ menu renames the selected tab', async () => {
    await hotkeyTab(page, 2).click();
    await expect(hotkeyTab(page, 2)).toHaveClass(/active/);

    const menu = await openTabActions(page, 'hotkeys');
    await expect(menuItem(page, 'rename')).toHaveText('Rename "Intros"…');
    await expect(menuItem(page, 'clear')).toHaveText('Clear "Intros"…');
    await expect(page.locator('#hotkey_tabs .tab-actions-btn')).toHaveAttribute('aria-expanded', 'true');

    // Esc closes it without doing anything
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.locator('#hotkey_tabs .tab-actions-btn')).toHaveAttribute('aria-expanded', 'false');

    await chooseTabAction(page, 'hotkeys', 'rename');
    const dialog = shownDialog(page, 'Rename Tab');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.prompt-input')).toHaveValue('Intros');
    await dialog.locator('.prompt-input').fill('Openers');
    await dialog.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 5000 });

    await expect(hotkeyTab(page, 2)).toHaveText('Openers');
    await expect(hotkeyTab(page, 1)).toHaveText('1');
    await openTabActions(page, 'hotkeys');
    await expect(menuItem(page, 'rename')).toHaveText('Rename "Openers"…');
    await page.keyboard.press('Escape');
    // An unnamed tab is "Tab N" in the menu, though its tab shows the number
    await hotkeyTab(page, 1).click();
    await openTabActions(page, 'hotkeys');
    await expect(menuItem(page, 'rename')).toHaveText('Rename "Tab 1"…');
    await page.keyboard.press('Escape');
    // A tab the user named "1" keeps "1"
    await chooseTabAction(page, 'hotkeys', 'rename');
    await shownDialog(page, 'Rename Tab').locator('.prompt-input').fill('1');
    await shownDialog(page, 'Rename Tab').getByRole('button', { name: 'OK', exact: true }).click();
    await expect(shownDialog(page, 'Rename Tab')).toHaveCount(0, { timeout: 5000 });
    await expect(hotkeyTab(page, 1)).toHaveText('1');
    await openTabActions(page, 'hotkeys');
    await expect(menuItem(page, 'clear')).toHaveText('Clear "1"…');
    await page.keyboard.press('Escape');
    await hotkeyTab(page, 2).click();
    await openTabActions(page, 'hotkeys');
    await expect(menuItem(page, 'rename')).toHaveText('Rename "Openers"…');
    // A click elsewhere closes it
    await page.click('body', { position: { x: 1, y: 1 } });
    await expect(tabActionsMenu(page)).toBeHidden();

    // So does switching tabs in either strip (here from a shortcut, no click)
    await openTabActions(page, 'hotkeys');
    await page.evaluate(() => window.moduleRegistry.hotkeys.switchToHotkeyTab(3));
    await expect(hotkeyTab(page, 3)).toHaveClass(/active/);
    await expect(tabActionsMenu(page)).toBeHidden();

    // And any scroll
    await openTabActions(page, 'holdingTank');
    await page.evaluate(() => document.getElementById('holding_tank').dispatchEvent(new Event('scroll')));
    await expect(tabActionsMenu(page)).toBeHidden();
  });

  test('⋯ menu clears only the selected tab, keeps the library and marks the show unsaved', async () => {
    const dot = page.locator('#show-dirty');
    await expect(dot).toBeHidden();

    await chooseTabAction(page, 'holdingTank', 'clear');
    const dialog = shownDialog(page, 'Clear "Tab 1"?');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.modal-body')).toHaveText(CLEAR_TAB_MESSAGE);
    await expect(dialog.locator('.confirm-btn')).toHaveText('Clear');
    await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 5000 });

    await expect(holdingItems(page, 1)).toHaveCount(0);
    await expect(holdingItems(page, 3)).toHaveCount(1);
    const count = await page.evaluate(() => window.secureElectronAPI.database.countSongs());
    expect(count.data[0].count).toBe(5);

    // Written to the recovery record as before, so the unsaved dot shows
    await expect.poll(() => recoveredHoldingTab(readRecovery(userDataDir, PROFILE), 1), { timeout: 10000 }).toEqual([]);
    expect(recoveredHoldingTab(readRecovery(userDataDir, PROFILE), 3)).toEqual(['1001']);
    await expect(dot).toBeVisible({ timeout: 10000 });

    // Hotkeys too
    await chooseTabAction(page, 'hotkeys', 'clear');
    const hotkeyDialog = shownDialog(page, 'Clear "Tab 1"?');
    await hotkeyDialog.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(hotkeyDialog).toHaveCount(0, { timeout: 5000 });
    await expect(hotkeySong(page, 1, 'f1')).toHaveText('');
    await expect(hotkeySong(page, 1, 'f2')).toHaveText('');
    await expect(hotkeySong(page, 2, 'f1')).not.toHaveText('');
  });

  test("Clear's confirm defaults to Cancel", async () => {
    await chooseTabAction(page, 'holdingTank', 'clear');
    const dialog = shownDialog(page, 'Clear "Tab 1"?');
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
    // Cancel is the default, so it has the focus and Return takes it
    await expect(cancel).toBeFocused({ timeout: 5000 });
    await expect(dialog.locator('.confirm-btn')).not.toBeFocused();

    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0, { timeout: 5000 });
    await expect(holdingItems(page, 1)).toHaveCount(2);
  });

  test('right-clicking an unselected tab selects it and its menu acts on it', async () => {
    await expect(holdingTab(page, 1)).toHaveClass(/active/);

    await holdingTab(page, 3).click({ button: 'right' });
    await expect(holdingTab(page, 3)).toHaveClass(/active/);
    await expect(holdingTab(page, 1)).not.toHaveClass(/active/);
    const menu = tabActionsMenu(page);
    await expect(menu).toBeVisible();
    await expect(menuItem(page, 'clear')).toHaveText('Clear "Walk-ons"…');

    // Opened at the pointer, not under the ⋯ button
    const tabBox = await holdingTab(page, 3).boundingBox();
    const menuBox = await menu.boundingBox();
    expect(menuBox.x).toBeGreaterThanOrEqual(tabBox.x - 1);
    expect(menuBox.x).toBeLessThanOrEqual(tabBox.x + tabBox.width);

    await menuItem(page, 'clear').click();
    const dialog = shownDialog(page, 'Clear "Walk-ons"?');
    await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 5000 });
    await expect(holdingItems(page, 3)).toHaveCount(0);
    await expect(holdingItems(page, 1)).toHaveCount(2);

    // Hotkeys: right-click tab 2, then Rename starts from its name
    await hotkeyTab(page, 2).click({ button: 'right' });
    await expect(hotkeyTab(page, 2)).toHaveClass(/active/);
    await menuItem(page, 'rename').click();
    const prompt = shownDialog(page, 'Rename Tab');
    await expect(prompt.locator('.prompt-input')).toHaveValue('Intros');
    await prompt.locator('.prompt-input').fill('Openers');
    await prompt.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(hotkeyTab(page, 2)).toHaveText('Openers');
    await expect(hotkeyTab(page, 1)).toHaveText('1');

    // Right-clicking the ⋯ itself opens nothing
    await page.locator('#hotkey_tabs .tab-actions-btn').click({ button: 'right' });
    await page.waitForTimeout(300);
    await expect(menu).toBeHidden();
  });

  test('double-click renames, with only one prompt', async () => {
    await hotkeyTab(page, 2).dblclick();
    const prompt = shownDialog(page, 'Rename Tab');
    await expect(prompt).toBeVisible();
    // Give a second handler time to open another prompt
    await page.waitForTimeout(500);
    await expect(page.locator('.prompt-input')).toHaveCount(1);
    await expect(prompt.locator('.prompt-input')).toHaveValue('Intros');
    await prompt.locator('.prompt-input').fill('Openers');
    await prompt.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.locator('.prompt-input')).toHaveCount(0, { timeout: 5000 });
    await expect(hotkeyTab(page, 2)).toHaveText('Openers');

    await holdingTab(page, 3).dblclick();
    const holdingPrompt = shownDialog(page, 'Rename Tab');
    await expect(holdingPrompt).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator('.prompt-input')).toHaveCount(1);
    await expect(holdingPrompt.locator('.prompt-input')).toHaveValue('Walk-ons');
    await holdingPrompt.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.prompt-input')).toHaveCount(0, { timeout: 5000 });
    await expect(holdingTab(page, 3)).toHaveText('Walk-ons');
  });
});
