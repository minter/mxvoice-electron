import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'node:path';
import { launchSeededApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import { readShows, seedShows } from '../../../utils/seed-shows.js';
import { SHOW_IDS, clickShowMenu, showMenuState, waitForShowMenuReady } from '../../../utils/show-e2e.js';
import {
  loadTabFromFile,
  saveDialogOptions,
  saveTabToFile,
  stubOpenDialog,
  stubSaveDialog,
  tabActionsMenu
} from '../../../utils/tab-actions.js';

// Seeded songs: 1001 Got The Time, 1002 The Wheel, 1003, 1004 We Are Family, 1005 Eat It.
const PROFILE = 'Default User';

function show(index, name, layout) {
  const now = Date.now();
  return { id: SHOW_IDS[index], name, createdAt: now + index, updatedAt: now + index, layout };
}

// Main Show: a named hotkey tab and a named holding tank tab. Encore: empty tab 1s, songs on tab 2s.
const DOCUMENT = {
  version: 1,
  activeShowId: SHOW_IDS[0],
  shows: [
    show(0, 'Main Show', {
      hotkeys: [{ tabNumber: 1, tabName: 'Friday Drops', hotkeys: { f1: '1001', f3: '1003', f12: '1005' } }],
      holdingTank: [{ tabNumber: 1, tabName: 'Preshow', songIds: ['1004', '1002'] }],
      selected: { hotkeyTab: 1, holdingTankTab: 1 }
    }),
    show(1, 'Encore', {
      hotkeys: [
        { tabNumber: 1, tabName: null, hotkeys: {} },
        { tabNumber: 2, tabName: 'Outros', hotkeys: { f2: '1002' } }
      ],
      holdingTank: [
        { tabNumber: 1, tabName: null, songIds: [] },
        { tabNumber: 2, tabName: 'Walk-ons', songIds: ['1001'] }
      ],
      selected: { hotkeyTab: 1, holdingTankTab: 1 }
    })
  ]
};

const hotkeyTab = (page, n) => page.locator(`#hotkey_tabs a[href="#hotkeys_list_${n}"]`);
const holdingTab = (page, n) => page.locator(`#holding_tank_tabs a[href="#holding_tank_${n}"]`);
const songId = (page, n, key) => page.locator(`#hotkeys_list_${n} [id^="${key}_hotkey"]`);
const holdingIds = (page, n) => page.locator(`#holding_tank_${n} li[songid]`).evaluateAll((items) => items.map((item) => item.getAttribute('songid')));

const MRV = [
  'f1::1001', 'f2::', 'f3::1003', 'f4::', 'f5::', 'f6::', 'f7::', 'f8::', 'f9::', 'f10::', 'f11::', 'f12::1005',
  'tab_name::Friday_Drops', ''
].join('\n');

test.describe('Tab files - save and load from the ⋯ menu', () => {
  let app;
  let page;
  let userDataDir;
  let suiteRoot;
  let tempDir;

  test.beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-tab-files-'));
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'tab-files', {
      beforeLaunch: (dir) => seedShows(dir, PROFILE, DOCUMENT)
    }));
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
    await expect(hotkeyTab(page, 1)).toHaveText('Friday Drops', { timeout: 10000 });
  });

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function switchToEncore() {
    await clickShowMenu(app, 'Encore');
    await expect(page.locator('#show-name')).toHaveText('Encore');
    await expect.poll(async () => showMenuState(app)).toMatchObject({ checked: 'Encore', enabled: true });
    await expect(hotkeyTab(page, 2)).toHaveText('Outros');
  }

  test('the menu has Save and Load after a separator', async () => {
    await page.locator('#hotkey_tabs .tab-actions-btn').click();
    const menu = tabActionsMenu(page);
    await expect(menu).toBeVisible();
    await expect(menu.locator(':scope > *')).toHaveCount(5);
    await expect(menu.locator(':scope > :nth-child(3)')).toHaveAttribute('role', 'separator');
    await expect(menu.locator('[data-action="save"]')).toHaveText('Save Tab to File…');
    await expect(menu.locator('[data-action="load"]')).toHaveText('Load Tab from File…');
  });

  test('a named hotkey tab saves in the old format and loads into an empty tab of another show', async () => {
    const file = path.join(tempDir, 'drops.mrv');
    await stubSaveDialog(app, file);
    await saveTabToFile(page, 'hotkeys');

    await expect.poll(() => fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe(MRV);
    const [options] = await saveDialogOptions(app);
    expect(path.basename(options.defaultPath)).toBe('Friday Drops.mrv');

    await switchToEncore();
    await stubOpenDialog(app, file);
    // Encore's tab 1 is empty: no question asked
    await loadTabFromFile(page, 'hotkeys', { confirm: 'none' });

    await expect(songId(page, 1, 'f1')).toHaveAttribute('songid', '1001');
    await expect(songId(page, 1, 'f3')).toHaveAttribute('songid', '1003');
    await expect(songId(page, 1, 'f12')).toHaveAttribute('songid', '1005');
    await expect(hotkeyTab(page, 1)).toHaveText('Friday Drops');
    await expect(page.locator('#show-dirty')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.modal.show')).toHaveCount(0);
  });

  test('loading into a tab with songs: Cancel changes nothing', async () => {
    const file = path.join(tempDir, 'other.mrv');
    fs.writeFileSync(file, 'f1::1004\ntab_name::Other\n');
    await stubOpenDialog(app, file);

    await loadTabFromFile(page, 'hotkeys', { confirm: 'cancel' });

    await expect(songId(page, 1, 'f1')).toHaveAttribute('songid', '1001');
    await expect(songId(page, 1, 'f3')).toHaveAttribute('songid', '1003');
    await expect(hotkeyTab(page, 1)).toHaveText('Friday Drops');
    await expect(page.locator('#show-dirty')).toBeHidden();
  });

  test('loading into a tab with songs asks with Cancel as the default; Replace replaces it', async () => {
    const file = path.join(tempDir, 'other.mrv');
    fs.writeFileSync(file, 'f2::1004\ntab_name::Other_Set\n');
    await stubOpenDialog(app, file);

    await page.locator('#hotkey_tabs .tab-actions-btn').click();
    await tabActionsMenu(page).locator('[data-action="load"]').click();
    const dialog = page.locator('.modal.show').filter({ has: page.locator('.modal-title', { hasText: 'Load Tab from File' }) });
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.locator('.modal-body')).toHaveText('Replace the songs in "Friday Drops"?');
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'Replace', exact: true }).click();

    await expect(songId(page, 1, 'f2')).toHaveAttribute('songid', '1004');
    await expect(songId(page, 1, 'f1')).not.toHaveAttribute('songid', /.+/);
    await expect(hotkeyTab(page, 1)).toHaveText('Other Set');
    await expect(page.locator('#show-dirty')).toBeVisible({ timeout: 10000 });
    // Live session only: the saved show is unchanged
    expect(readShows(userDataDir, PROFILE).shows[0].layout.hotkeys[0].hotkeys.f1).toBe('1001');
  });

  test('a holding tank tab saves one id per line and loads into another show', async () => {
    const file = path.join(tempDir, 'preshow.hld');
    await stubSaveDialog(app, file);
    await saveTabToFile(page, 'holdingTank');

    await expect.poll(() => fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('1004\n1002\n');
    const [options] = await saveDialogOptions(app);
    expect(path.basename(options.defaultPath)).toBe('Preshow.hld');

    await switchToEncore();
    await stubOpenDialog(app, file);
    await loadTabFromFile(page, 'holdingTank', { confirm: 'none' });
    await expect(page.locator('#holding_tank_1 li[songid]')).toHaveCount(2, { timeout: 10000 });
    expect(await holdingIds(page, 1)).toEqual(['1004', '1002']);
    await expect(page.locator('#show-dirty')).toBeVisible({ timeout: 10000 });

    // Tab 2 has a song: Cancel keeps it, Replace replaces it
    await holdingTab(page, 2).click();
    await expect(holdingTab(page, 2)).toHaveClass(/active/);
    await loadTabFromFile(page, 'holdingTank', { confirm: 'cancel' });
    expect(await holdingIds(page, 2)).toEqual(['1001']);
    await loadTabFromFile(page, 'holdingTank', { confirm: 'replace' });
    await expect.poll(() => holdingIds(page, 2)).toEqual(['1004', '1002']);
  });

  test('an unnamed tab saves as "Tab N"', async () => {
    await switchToEncore();
    await stubSaveDialog(app, null);
    await saveTabToFile(page, 'holdingTank');
    await expect.poll(async () => (await saveDialogOptions(app)).length).toBe(1);
    const [options] = await saveDialogOptions(app);
    expect(path.basename(options.defaultPath)).toBe('Tab 1.hld');
    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  test('a file with a song missing from the library loads the rest and says so', async () => {
    const file = path.join(tempDir, 'missing.hld');
    fs.writeFileSync(file, '1003\n99999\n1005\n');
    await switchToEncore();
    await stubOpenDialog(app, file);

    await loadTabFromFile(page, 'holdingTank', { confirm: 'none' });

    await expect(page.locator('#file-drop-toast')).toHaveText("1 song in this file isn't in your library.", { timeout: 10000 });
    expect(await holdingIds(page, 1)).toEqual(['1003', '1005']);
  });

  test('a hotkey file that fails validation shows an alert and changes nothing', async () => {
    const file = path.join(tempDir, 'bad.mrv');
    fs.writeFileSync(file, 'f1::abc\n');
    await stubOpenDialog(app, file);

    await loadTabFromFile(page, 'hotkeys', { confirm: 'none' });

    const alert = page.locator('.modal.show').filter({ has: page.locator('.modal-title', { hasText: 'Load Tab from File' }) });
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert.locator('.modal-body')).toContainText('Line 1: invalid song ID for f1');
    await expect(songId(page, 1, 'f1')).toHaveAttribute('songid', '1001');
  });
});
