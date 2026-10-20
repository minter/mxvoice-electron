import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import { launchSeededApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import { relaunchApp, waitForShowSettled } from '../../../utils/relaunch.js';
import { readShows, readRecovery, recoveryRecordPath, seedShows } from '../../../utils/seed-shows.js';
import {
  answerChoice,
  answerConfirm,
  answerPrompt,
  assignF1,
  showMenuState,
  clickShowMenu,
  f1Hotkey,
  multiShowDocument,
  quitApp,
  shownDialog,
  waitForShowMenuReady
} from '../../../utils/show-e2e.js';

// Seeded songs: 1001 Got The Time, 1002 The Wheel, 1003, 1004 We Are Family, 1005 Eat It.
const PROFILE = 'Default User';

const activeShow = (doc) => doc.shows.find((b) => b.id === doc.activeShowId);
const f1Of = (show) => show.layout.hotkeys[0].hotkeys.f1 ?? null;

test.describe('Shows - menu commands', () => {
  let app;
  let page;
  let userDataDir;
  let suiteRoot;
  const homes = [];

  async function launch(shows, options) {
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'show-commands', {
      beforeLaunch: (dir) => seedShows(dir, PROFILE, multiShowDocument(shows, options))
    }));
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
  }

  async function quitAndRelaunch() {
    await quitApp(app);
    let fakeHome;
    ({ app, page, fakeHome } = await relaunchApp(electron, userDataDir, { profile: PROFILE }));
    homes.push(fakeHome);
    await waitForShowSettled(page);
    await expect(page.locator('.modal.show').filter({ hasText: 'Restore show?' })).toHaveCount(0);
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
  }

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  test('save as from the live layout becomes active and survives a quit', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);
    await expect(page.locator('#show-name')).toHaveText('Main Show');
    await expect(page.locator('#profile-name')).toHaveText(PROFILE);
    await assignF1(page, '1001');

    await clickShowMenu(app, 'Save As…');
    await answerPrompt(page, 'Save As', 'Late Show', { message: 'Name for the new show' });

    await expect.poll(() => activeShow(readShows(userDataDir, PROFILE)).name).toBe('Late Show');
    await expect(page.locator('#show-name')).toHaveText('Late Show');
    const doc = readShows(userDataDir, PROFILE);
    expect(doc.shows.map((b) => b.name)).toEqual(['Main Show', 'Late Show']);
    expect(f1Of(activeShow(doc))).toBe('1001');
    expect(f1Of(doc.shows[0])).toBe('1002');
    await expect.poll(async () => (await showMenuState(app)).checked).toBe('Late Show');

    await quitAndRelaunch();
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
    await expect(page.locator('#show-name')).toHaveText('Late Show');
    expect(await showMenuState(app)).toMatchObject({ shows: ['Main Show', 'Late Show'], checked: 'Late Show' });
  });

  test('save as re-prompts on a duplicate name', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);

    await clickShowMenu(app, 'Save As…');
    await answerPrompt(page, 'Save As', 'main show');
    await answerPrompt(page, 'Save As', 'Second Show', { message: 'A show with this name already exists.' });

    await expect.poll(() => readShows(userDataDir, PROFILE).shows.map((b) => b.name)).toEqual(['Main Show', 'Second Show']);
  });

  test('save then quit reopens with the saved layout', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);
    await assignF1(page, '1001');
    await expect.poll(() => readRecovery(userDataDir, PROFILE)?.layout?.hotkeys?.[0]?.hotkeys?.f1 ?? null, { timeout: 10000 }).toBe('1001');

    await clickShowMenu(app, 'Save "Main Show"');
    await answerConfirm(page, 'Save "Main Show"?', 'Save', {
      message: '"Main Show" will open with the layout on screen now. Its saved layout will be replaced.'
    });

    await expect.poll(() => f1Of(activeShow(readShows(userDataDir, PROFILE)))).toBe('1001');
    // The live layout now equals the saved show, so there is nothing to recover
    await expect.poll(() => fs.existsSync(recoveryRecordPath(userDataDir, PROFILE))).toBe(false);

    await quitAndRelaunch();
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
  });

  test('songid survives Save', async () => {
    await launch([{ name: 'Main Show' }]);
    await assignF1(page, '1004');

    await clickShowMenu(app, 'Save "Main Show"');
    await answerConfirm(page, 'Save "Main Show"?', 'Save');
    await expect.poll(() => f1Of(activeShow(readShows(userDataDir, PROFILE)))).toBe('1004');

    await quitAndRelaunch();
    // On the li, never the span
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1004');
    await expect(f1Hotkey(page).locator('span')).not.toHaveAttribute('songid', /.*/);
    await expect(f1Hotkey(page).locator('span')).not.toHaveText('');
  });

  test('cancelling save keeps the saved show', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);
    await assignF1(page, '1001');

    await clickShowMenu(app, 'Save "Main Show"');
    await answerConfirm(page, 'Save "Main Show"?', 'Cancel');

    expect(f1Of(activeShow(readShows(userDataDir, PROFILE)))).toBe('1002');
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
  });

  test('the header dot marks unsaved changes until Save, or until the edit is undone', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);
    const dot = page.locator('#show-dirty');
    await expect(dot).toBeHidden();
    await expect(dot).toHaveAttribute('title', 'Unsaved changes');

    // The recovery save is debounced, so the dot follows shortly after an edit
    await assignF1(page, '1001');
    await expect(dot).toBeVisible({ timeout: 10000 });
    await expect(dot).toHaveText('•');
    await expect(page.locator('#show-name')).toHaveText('Main Show');

    await clickShowMenu(app, 'Save "Main Show"');
    await answerConfirm(page, 'Save "Main Show"?', 'Save');
    await expect(dot).toBeHidden({ timeout: 10000 });

    // An edit put back to the saved show leaves nothing unsaved
    await assignF1(page, '1003');
    await expect(dot).toBeVisible({ timeout: 10000 });
    await assignF1(page, '1001');
    await expect(dot).toBeHidden({ timeout: 10000 });
  });

  test('revert brings back the saved show', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);
    await assignF1(page, '1001');

    await clickShowMenu(app, 'Revert to "Main Show"');
    await answerConfirm(page, 'Revert to "Main Show"?', 'Revert', {
      message: 'Changes since "Main Show" was opened will be discarded.'
    });

    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002');
    await waitForShowMenuReady(app);
    await expect.poll(() => fs.existsSync(recoveryRecordPath(userDataDir, PROFILE))).toBe(false);
  });

  test('switching shows from the menu loads the chosen show', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);

    await clickShowMenu(app, 'Encore');
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1003');
    await expect(page.locator('#show-name')).toHaveText('Encore');
    await expect.poll(async () => showMenuState(app)).toMatchObject({ checked: 'Encore', enabled: true });
    expect(activeShow(readShows(userDataDir, PROFILE)).name).toBe('Encore');
    // No dialog is shown for a switch
    await expect(page.locator('.modal.show')).toHaveCount(0);
  });

  test('switching with unsaved changes: Cancel stays put and the menu check stays', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);
    await assignF1(page, '1001');
    await expect(page.locator('#show-dirty')).toBeVisible({ timeout: 10000 });

    await clickShowMenu(app, 'Encore');
    const dialog = shownDialog(page, 'Unsaved changes');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    // Cancel is the default, so Return takes it
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await answerChoice(page, 'Unsaved changes', 'Cancel', { message: 'Save changes to "Main Show"?' });

    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
    await expect(page.locator('#show-name')).toHaveText('Main Show');
    await expect.poll(async () => showMenuState(app)).toMatchObject({ checked: 'Main Show', enabled: true });
    const doc = readShows(userDataDir, PROFILE);
    expect(activeShow(doc).name).toBe('Main Show');
    expect(f1Of(activeShow(doc))).toBe('1002');
  });

  test("switching with unsaved changes: Don't Save loads the other show and drops the edit", async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);
    await assignF1(page, '1001');

    await clickShowMenu(app, 'Encore');
    await answerChoice(page, 'Unsaved changes', "Don't Save");
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1003');
    await expect(page.locator('#show-name')).toHaveText('Encore');

    await clickShowMenu(app, 'Main Show');
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002');
    // The edit is gone, so switching back asked nothing
    await expect(page.locator('.modal.show')).toHaveCount(0);
    expect(f1Of(readShows(userDataDir, PROFILE).shows[0])).toBe('1002');
  });

  test('switching with unsaved changes: Save keeps the edit in the first show', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);
    await assignF1(page, '1001');

    await clickShowMenu(app, 'Encore');
    await answerChoice(page, 'Unsaved changes', 'Save');
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1003');
    await expect(page.locator('#show-name')).toHaveText('Encore');
    expect(f1Of(readShows(userDataDir, PROFILE).shows[0])).toBe('1001');

    await clickShowMenu(app, 'Main Show');
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
    await expect(page.locator('.modal.show')).toHaveCount(0);
  });

  test('delete the active show loads the next one', async () => {
    await launch([
      { name: 'Opening', hotkeys: { f1: '1002' } },
      { name: 'Main Show', hotkeys: { f1: '1003' } },
      { name: 'Encore', hotkeys: { f1: '1005' } }
    ], { active: 1 });

    await clickShowMenu(app, 'Delete "Main Show"…');
    const dialog = shownDialog(page, 'Delete "Main Show"?');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    // Delete is destructive: Return takes Cancel
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await answerConfirm(page, 'Delete "Main Show"?', 'Delete', {
      message: 'The layout on screen will be replaced with "Encore".'
    });

    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1005');
    await expect(page.locator('#show-name')).toHaveText('Encore');
    await expect.poll(() => readShows(userDataDir, PROFILE).shows.map((b) => b.name)).toEqual(['Opening', 'Encore']);
    expect(activeShow(readShows(userDataDir, PROFILE)).name).toBe('Encore');
    await expect.poll(async () => showMenuState(app)).toMatchObject({ shows: ['Opening', 'Encore'], checked: 'Encore', enabled: true });
  });

  test('deleting another show means switching to it first', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);
    await clickShowMenu(app, 'Encore');
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1003');
    await clickShowMenu(app, 'Delete "Encore"…');
    await answerConfirm(page, 'Delete "Encore"?', 'Delete', {
      message: 'The layout on screen will be replaced with "Main Show".'
    });

    await expect.poll(() => readShows(userDataDir, PROFILE).shows.map((b) => b.name)).toEqual(['Main Show']);
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002');
    await expect(page.locator('#show-name')).toHaveText('Main Show');
    await expect.poll(async () => showMenuState(app)).toMatchObject({ shows: ['Main Show'], checked: 'Main Show' });
  });

  test('rename changes the show name in the menu', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }]);

    await clickShowMenu(app, 'Rename "Main Show"…');
    const dialog = shownDialog(page, 'Rename Show');
    await expect(dialog.locator('.prompt-input')).toHaveValue('Main Show', { timeout: 10000 });
    await answerPrompt(page, 'Rename Show', 'Friday Show', { message: 'New name' });

    await expect.poll(async () => showMenuState(app)).toMatchObject({ shows: ['Friday Show'], checked: 'Friday Show' });
    expect(readShows(userDataDir, PROFILE).shows[0].name).toBe('Friday Show');
    await expect(page.locator('#show-name')).toHaveText('Friday Show');
    await expect(page.locator('#show-name')).toHaveAttribute('title', 'Friday Show');
  });

  test('a switch dropped behind a prompt leaves the menu check on the active show', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);

    await clickShowMenu(app, 'Save As…');
    const prompt = shownDialog(page, 'Save As');
    await expect(prompt).toBeVisible({ timeout: 10000 });
    await clickShowMenu(app, 'Encore');
    await prompt.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    expect(await showMenuState(app)).toMatchObject({ checked: 'Main Show', enabled: true });
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002');
    expect(activeShow(readShows(userDataDir, PROFILE)).name).toBe('Main Show');
  });

  test('a show command is dropped while another dialog is open', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1002' } }, { name: 'Encore', hotkeys: { f1: '1003' } }]);

    await clickShowMenu(app, 'Save As…');
    await expect(shownDialog(page, 'Save As')).toBeVisible({ timeout: 10000 });
    await clickShowMenu(app, 'Revert to "Main Show"');
    await page.waitForTimeout(500);
    await expect(page.locator('.modal.show')).toHaveCount(1);

    await shownDialog(page, 'Save As').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);
    expect(readShows(userDataDir, PROFILE).shows.map((b) => b.name)).toEqual(['Main Show', 'Encore']);
  });
});
