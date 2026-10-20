import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import { launchSeededApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import { profileBoardsPath, readBoards, seedBoards } from '../../../utils/seed-boards.js';
import {
  answerConfirm,
  assignF1,
  boardMenuState,
  clickBoardMenu,
  f1Hotkey,
  multiBoardDocument,
  waitForBoardMenuReady
} from '../../../utils/board-e2e.js';

// Seeded songs: 1001 Got The Time, 1002 The Wheel, 1003, 1004 We Are Family, 1005 Eat It.
const activeBoard = (doc) => doc.boards.find((b) => b.id === doc.activeBoardId);

test.describe('Boards - Import Board', () => {
  let app;
  let page;
  let userDataDir;
  let suiteRoot;

  async function switchProfile(profile) {
    const reloaded = page.waitForEvent('load');
    await page.evaluate((name) => { void window.secureElectronAPI.profile.switchToProfile(name); }, profile);
    await reloaded;
    await page.waitForFunction(
      () => window.isRestoringProfileState === false && window.__e2eInitialSearchSettled === true,
      null,
      { timeout: 20000 }
    );
    await expect.poll(
      () => page.evaluate(async () => (await window.secureElectronAPI.profile.getCurrent()).profile),
      { timeout: 20000 }
    ).toBe(profile);
    await waitForBoardMenuReady(app);
  }

  // Jesse is the current profile; Derek has saved "Comedy Sports"
  async function launchJesseAndDerek() {
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'import-board'));
    await waitForAppReady(page, app);
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.createProfile('Jesse', '');
      await window.secureElectronAPI.profile.createProfile('Derek', '');
    });
    seedBoards(userDataDir, 'Derek', multiBoardDocument([
      { name: 'Warmups', hotkeys: { f1: '1002' } },
      { name: 'Comedy Sports', hotkeys: { f1: '1004', f2: '1005' } }
    ]));
    seedBoards(userDataDir, 'Jesse', multiBoardDocument([{ name: 'Jesse Board', hotkeys: { f1: '1003' } }]));
    await switchProfile('Jesse');
  }

  async function openImportDialog() {
    await clickBoardMenu(app, 'Import Board…');
    const dialog = page.locator('#importBoardModal');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    return dialog;
  }

  async function importComedySports() {
    const dialog = await openImportDialog();
    const importButton = dialog.locator('#importBoardBtn');
    await expect(importButton).toBeDisabled();
    await dialog.getByRole('option', { name: 'Comedy Sports', exact: true }).click();
    await expect(importButton).toBeEnabled();
    await importButton.click();
    await expect(dialog).toBeHidden();
  }

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  test('Jesse imports Derek → Comedy Sports as "Comedy Sports (Derek)"', async () => {
    await launchJesseAndDerek();
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1003');

    await importComedySports();

    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1004');
    await expect(page.locator('#hotkeys_list_1 #f2_hotkey')).toHaveAttribute('songid', '1005');
    const doc = readBoards(userDataDir, 'Jesse');
    expect(doc.boards.map((b) => b.name)).toEqual(['Jesse Board', 'Comedy Sports (Derek)']);
    expect(activeBoard(doc).name).toBe('Comedy Sports (Derek)');
    await expect(page.locator('#board-name')).toHaveText('Comedy Sports (Derek)');
    await expect.poll(async () => boardMenuState(app)).toMatchObject({
      boards: ['Jesse Board', 'Comedy Sports (Derek)'],
      checked: 'Comedy Sports (Derek)',
      enabled: true
    });
  });

  test('editing and updating the copy leaves Derek\'s board unchanged', async () => {
    await launchJesseAndDerek();
    const derekBefore = fs.readFileSync(profileBoardsPath(userDataDir, 'Derek'), 'utf8');

    await importComedySports();
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1004');
    await waitForBoardMenuReady(app);
    await assignF1(page, '1001');

    await clickBoardMenu(app, 'Update "Comedy Sports (Derek)"');
    await answerConfirm(page, 'Update "Comedy Sports (Derek)"?', 'Update');

    await expect.poll(() => activeBoard(readBoards(userDataDir, 'Jesse')).layout.hotkeys[0].hotkeys.f1).toBe('1001');
    expect(fs.readFileSync(profileBoardsPath(userDataDir, 'Derek'), 'utf8')).toBe(derekBefore);
  });

  test('the import list never shows the current profile', async () => {
    await launchJesseAndDerek();

    const dialog = await openImportDialog();
    const list = dialog.locator('#importBoardList');
    await expect(list.getByRole('option')).not.toHaveCount(0);
    const headers = await list.locator('[role="presentation"]').allTextContents();
    expect(headers).toContain('Derek');
    expect(headers).not.toContain('Jesse');
    await expect(list.getByRole('option', { name: 'Jesse Board' })).toHaveCount(0);
    // Derek's boards are listed under his name, in his order
    await expect(list.locator('> *')).toContainText(['Derek', 'Warmups', 'Comedy Sports']);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    expect(readBoards(userDataDir, 'Jesse').boards.map((b) => b.name)).toEqual(['Jesse Board']);
  });

  test('with no other profiles the dialog says so and Import stays disabled', async () => {
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'import-board-empty'));
    await waitForAppReady(page, app);
    await waitForBoardMenuReady(app);

    const dialog = await openImportDialog();
    await expect(dialog.locator('#importBoardEmpty')).toBeVisible();
    await expect(dialog.locator('#importBoardEmpty')).toHaveText('No other profiles have saved boards.');
    await expect(dialog.locator('#importBoardBtn')).toBeDisabled();
    await expect(dialog.getByRole('option')).toHaveCount(0);
  });
});
