import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import { launchSeededApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import { relaunchApp, waitForBoardSettled } from '../../../utils/relaunch.js';
import { readBoards, readRecovery, recoveryRecordPath, seedBoards } from '../../../utils/seed-boards.js';
import {
  answerConfirm,
  answerPrompt,
  assignF1,
  boardMenuState,
  clickBoardMenu,
  f1Hotkey,
  multiBoardDocument,
  quitApp,
  shownDialog,
  waitForBoardMenuReady
} from '../../../utils/board-e2e.js';

// Seeded songs: 1001 Got The Time, 1002 The Wheel, 1003, 1004 We Are Family, 1005 Eat It.
const PROFILE = 'Default User';

const activeBoard = (doc) => doc.boards.find((b) => b.id === doc.activeBoardId);
const f1Of = (board) => board.layout.hotkeys[0].hotkeys.f1 ?? null;

test.describe('Boards - menu commands', () => {
  let app;
  let page;
  let userDataDir;
  let suiteRoot;
  const homes = [];

  async function launch(boards, options) {
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'board-commands', {
      beforeLaunch: (dir) => seedBoards(dir, PROFILE, multiBoardDocument(boards, options))
    }));
    await waitForAppReady(page, app);
    await waitForBoardMenuReady(app);
  }

  async function quitAndRelaunch() {
    await quitApp(app);
    let fakeHome;
    ({ app, page, fakeHome } = await relaunchApp(electron, userDataDir, { profile: PROFILE }));
    homes.push(fakeHome);
    await waitForBoardSettled(page);
    await expect(page.locator('.modal.show').filter({ hasText: 'Restore show?' })).toHaveCount(0);
    await waitForAppReady(page, app);
    await waitForBoardMenuReady(app);
  }

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  test('new board from the live layout becomes active and survives a quit', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);
    await expect(page.locator('#board-name')).toHaveText('Main Show');
    await expect(page.locator('#profile-name')).toHaveText(PROFILE);
    await assignF1(page, '1001');

    await clickBoardMenu(app, 'New Board…');
    await answerPrompt(page, 'New Board', 'Late Show', { message: 'Name for the new board' });

    await expect.poll(() => activeBoard(readBoards(userDataDir, PROFILE)).name).toBe('Late Show');
    await expect(page.locator('#board-name')).toHaveText('Late Show');
    const doc = readBoards(userDataDir, PROFILE);
    expect(doc.boards.map((b) => b.name)).toEqual(['Main Show', 'Late Show']);
    expect(f1Of(activeBoard(doc))).toBe('1001');
    expect(f1Of(doc.boards[0])).toBe('1002');
    await expect.poll(async () => (await boardMenuState(app)).checked).toBe('Late Show');

    await quitAndRelaunch();
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
    await expect(page.locator('#board-name')).toHaveText('Late Show');
    expect(await boardMenuState(app)).toMatchObject({ boards: ['Main Show', 'Late Show'], checked: 'Late Show' });
  });

  test('new re-prompts on a duplicate name', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);

    await clickBoardMenu(app, 'New Board…');
    await answerPrompt(page, 'New Board', 'main show');
    await answerPrompt(page, 'New Board', 'Second Show', { message: 'A board with this name already exists.' });

    await expect.poll(() => readBoards(userDataDir, PROFILE).boards.map((b) => b.name)).toEqual(['Main Show', 'Second Show']);
  });

  test('update then quit reopens with the updated layout', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);
    await assignF1(page, '1001');
    await expect.poll(() => readRecovery(userDataDir, PROFILE)?.layout?.hotkeys?.[0]?.hotkeys?.f1 ?? null, { timeout: 10000 }).toBe('1001');

    await clickBoardMenu(app, 'Update "Main Show"');
    await answerConfirm(page, 'Update "Main Show"?', 'Update', {
      message: '"Main Show" will open with the layout on screen now. Its saved layout will be replaced.'
    });

    await expect.poll(() => f1Of(activeBoard(readBoards(userDataDir, PROFILE)))).toBe('1001');
    // The live layout now equals the saved board, so there is nothing to recover
    await expect.poll(() => fs.existsSync(recoveryRecordPath(userDataDir, PROFILE))).toBe(false);

    await quitAndRelaunch();
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
  });

  test('songid survives Update', async () => {
    await launch([{ name: 'Main Show' }]);
    await assignF1(page, '1004');

    await clickBoardMenu(app, 'Update "Main Show"');
    await answerConfirm(page, 'Update "Main Show"?', 'Update');
    await expect.poll(() => f1Of(activeBoard(readBoards(userDataDir, PROFILE)))).toBe('1004');

    await quitAndRelaunch();
    // On the li, never the span
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1004');
    await expect(f1Hotkey(page).locator('span')).not.toHaveAttribute('songid', /.*/);
    await expect(f1Hotkey(page).locator('span')).not.toHaveText('');
  });

  test('cancelling update keeps the saved board', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);
    await assignF1(page, '1001');

    await clickBoardMenu(app, 'Update "Main Show"');
    await answerConfirm(page, 'Update "Main Show"?', 'Cancel');

    expect(f1Of(activeBoard(readBoards(userDataDir, PROFILE)))).toBe('1002');
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
  });

  test('revert brings back the saved board', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);
    await assignF1(page, '1001');

    await clickBoardMenu(app, 'Revert to "Main Show"');
    await answerConfirm(page, 'Revert to "Main Show"?', 'Revert', {
      message: 'Changes since "Main Show" was opened will be discarded.'
    });

    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002');
    await waitForBoardMenuReady(app);
    await expect.poll(() => fs.existsSync(recoveryRecordPath(userDataDir, PROFILE))).toBe(false);
  });

  test('switching boards from the menu loads the chosen board', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);

    await clickBoardMenu(app, 'Encore');
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1003');
    await expect(page.locator('#board-name')).toHaveText('Encore');
    await expect.poll(async () => boardMenuState(app)).toMatchObject({ checked: 'Encore', enabled: true });
    expect(activeBoard(readBoards(userDataDir, PROFILE)).name).toBe('Encore');
    // No dialog is shown for a switch
    await expect(page.locator('.modal.show')).toHaveCount(0);
  });

  test('delete the active board loads the next one', async () => {
    await launch([
      { name: 'Opening', hotkeys: { f1: '1002' } },
      { name: 'Main Show', hotkeys: { f1: '1003' } },
      { name: 'Encore', hotkeys: { f1: '1005' } }
    ], { active: 1 });

    await clickBoardMenu(app, 'Delete Board', 'Main Show…');
    const dialog = shownDialog(page, 'Delete "Main Show"?');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    // Delete is destructive: Return takes Cancel
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await answerConfirm(page, 'Delete "Main Show"?', 'Delete', {
      message: 'The layout on screen will be replaced with "Encore".'
    });

    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1005');
    await expect(page.locator('#board-name')).toHaveText('Encore');
    await expect.poll(() => readBoards(userDataDir, PROFILE).boards.map((b) => b.name)).toEqual(['Opening', 'Encore']);
    expect(activeBoard(readBoards(userDataDir, PROFILE)).name).toBe('Encore');
    await expect.poll(async () => boardMenuState(app)).toMatchObject({ boards: ['Opening', 'Encore'], checked: 'Encore', enabled: true });
  });

  test('delete a non-active board keeps the live layout', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);
    await assignF1(page, '1001');
    await expect.poll(() => readRecovery(userDataDir, PROFILE)?.layout?.hotkeys?.[0]?.hotkeys?.f1 ?? null, { timeout: 10000 }).toBe('1001');

    await clickBoardMenu(app, 'Delete Board', 'Encore…');
    await answerConfirm(page, 'Delete "Encore"?', 'Delete', { message: "This can't be undone." });

    await expect.poll(() => readBoards(userDataDir, PROFILE).boards.map((b) => b.name)).toEqual(['Main Show']);
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
    expect(readRecovery(userDataDir, PROFILE)?.layout.hotkeys[0].hotkeys.f1).toBe('1001');
    await expect.poll(async () => (await boardMenuState(app)).boards).toEqual(['Main Show']);
  });

  test('rename changes the board name in the menu', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);

    await clickBoardMenu(app, 'Rename Board', 'Main Show…');
    const dialog = shownDialog(page, 'Rename Board');
    await expect(dialog.locator('.prompt-input')).toHaveValue('Main Show', { timeout: 10000 });
    await answerPrompt(page, 'Rename Board', 'Friday Show', { message: 'New name' });

    await expect.poll(async () => boardMenuState(app)).toMatchObject({ boards: ['Friday Show'], checked: 'Friday Show' });
    expect(readBoards(userDataDir, PROFILE).boards[0].name).toBe('Friday Show');
    await expect(page.locator('#board-name')).toHaveText('Friday Show');
    await expect(page.locator('#board-name')).toHaveAttribute('title', 'Friday Show');
  });

  test('a switch dropped behind a prompt leaves the menu check on the active board', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);

    await clickBoardMenu(app, 'New Board…');
    const prompt = shownDialog(page, 'New Board');
    await expect(prompt).toBeVisible({ timeout: 10000 });
    await clickBoardMenu(app, 'Encore');
    await prompt.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    expect(await boardMenuState(app)).toMatchObject({ checked: 'Main Show', enabled: true });
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002');
    expect(activeBoard(readBoards(userDataDir, PROFILE)).name).toBe('Main Show');
  });

  test('a board command is dropped while another dialog is open', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);

    await clickBoardMenu(app, 'New Board…');
    await expect(shownDialog(page, 'New Board')).toBeVisible({ timeout: 10000 });
    await clickBoardMenu(app, 'Revert to "Main Show"');
    await page.waitForTimeout(500);
    await expect(page.locator('.modal.show')).toHaveCount(1);

    await shownDialog(page, 'New Board').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);
    expect(readBoards(userDataDir, PROFILE).boards.map((b) => b.name)).toEqual(['Main Show', 'Encore']);
  });
});
