import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { launchSeededApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import { crashApp, relaunchApp, waitForShowSettled } from '../../../utils/relaunch.js';
import {
  showsDocument,
  hotkeyLayout,
  readShows,
  readRecovery,
  recoveryRecordPath,
  seedShows
} from '../../../utils/seed-shows.js';

// Seeded songs: 1001 Got The Time, 1002 The Wheel, 1003, 1004 We Are Family, 1005 Eat It.
const SAVED_SONG = '1002';
const LIVE_SONG = '1001';

const seedSavedShow = (profile = 'Default User', hotkeys = { f1: SAVED_SONG }) => (userDataDir) => {
  seedShows(userDataDir, profile, showsDocument(hotkeyLayout(hotkeys)));
};

const f1SongId = (page) => page.locator('#hotkeys_list_1 #f1_hotkey');

// As a drop onto F1 does: assign, then request the (debounced) save
async function assignF1(page, songId) {
  await page.evaluate(async (id) => {
    const f1 = document.querySelector('#hotkeys_list_1 #f1_hotkey');
    await window.moduleRegistry.hotkeys.setLabelFromSongId(id, f1);
    void window.moduleRegistry.hotkeys.requestProfileStateSave();
  }, songId);
  await expect(f1SongId(page)).toHaveAttribute('songid', songId);
}

// A live edit reaches the recovery record after the debounced save
async function waitForRecoveredF1(userDataDir, profile, songId) {
  await expect.poll(() => readRecovery(userDataDir, profile)?.layout?.hotkeys?.[0]?.hotkeys?.f1 ?? null, {
    timeout: 10000
  }).toBe(songId);
}

async function quit(app) {
  const exited = app.waitForEvent('close', { timeout: 20000 });
  await app.evaluate(({ app: electronApp }) => electronApp.quit());
  await exited;
}

// The predicate must be synchronous: waitForFunction treats a returned
// Promise as truthy
async function waitForShowReady(page, profile) {
  await page.waitForFunction(
    () => window.isRestoringProfileState === false && window.__e2eInitialSearchSettled === true,
    null,
    { timeout: 20000 }
  );
  await expect.poll(
    () => page.evaluate(async () => (await window.secureElectronAPI.profile.getCurrent()).profile),
    { timeout: 20000 }
  ).toBe(profile);
}

async function switchProfile(page, profile) {
  const reloaded = page.waitForEvent('load');
  await page.evaluate((name) => { void window.secureElectronAPI.profile.switchToProfile(name); }, profile);
  await reloaded;
  await waitForShowReady(page, profile);
}

function restorePrompt(page) {
  return page.locator('.modal.show').filter({ hasText: 'Restore show?' });
}

test.describe('Shows - session lifecycle', () => {
  let app;
  let page;
  let userDataDir;
  let suiteRoot;
  const homes = [];

  async function launch(options) {
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'shows-session', options));
    await waitForAppReady(page, app);
  }

  async function relaunch(profile = 'Default User') {
    let fakeHome;
    ({ app, page, fakeHome } = await relaunchApp(electron, userDataDir, { profile }));
    homes.push(fakeHome);
  }

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  test('a clean quit discards the night', async () => {
    await launch({ beforeLaunch: seedSavedShow() });
    await expect(f1SongId(page)).toHaveAttribute('songid', SAVED_SONG);
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Default User', LIVE_SONG);

    await quit(app);
    expect(fs.existsSync(recoveryRecordPath(userDataDir, 'Default User'))).toBe(false);

    await relaunch();
    await waitForShowSettled(page);
    await expect(restorePrompt(page)).toHaveCount(0);
    await waitForAppReady(page, app);
    await expect(f1SongId(page)).toHaveAttribute('songid', SAVED_SONG);
  });

  test('quitting while the prompt is open keeps the night for the next launch', async () => {
    await launch({ beforeLaunch: seedSavedShow() });
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Default User', LIVE_SONG);

    await crashApp(app);
    await relaunch();
    await expect(restorePrompt(page)).toBeVisible({ timeout: 20000 });
    await quit(app);
    expect(readRecovery(userDataDir, 'Default User')?.layout.hotkeys[0].hotkeys.f1).toBe(LIVE_SONG);

    await relaunch();
    const prompt = restorePrompt(page);
    await expect(prompt).toBeVisible({ timeout: 20000 });
    await prompt.getByRole('button', { name: 'Restore show in progress' }).click();
    await waitForAppReady(page, app);
    await expect(f1SongId(page)).toHaveAttribute('songid', LIVE_SONG);
  });

  test('a kill keeps the night behind the prompt', async () => {
    await launch({ beforeLaunch: seedSavedShow() });
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Default User', LIVE_SONG);

    await crashApp(app);
    await relaunch();

    const prompt = restorePrompt(page);
    await expect(prompt).toBeVisible({ timeout: 20000 });
    await expect(prompt).toContainText("Mx. Voice didn't close normally. Restore the show in progress from");
    await expect(prompt.getByRole('button', { name: 'Open saved show' })).toBeFocused();
    await prompt.getByRole('button', { name: 'Restore show in progress' }).click();
    await expect(prompt).toHaveCount(0);

    await waitForAppReady(page, app);
    await expect(f1SongId(page)).toHaveAttribute('songid', LIVE_SONG);
    // The restored layout is not the saved show
    await expect(page.locator('#show-dirty')).toBeVisible();
    // The saved show is untouched; the restored layout is still recoverable
    expect(readShows(userDataDir, 'Default User').shows[0].layout.hotkeys[0].hotkeys.f1).toBe(SAVED_SONG);
    expect(readRecovery(userDataDir, 'Default User')?.layout.hotkeys[0].hotkeys.f1).toBe(LIVE_SONG);
  });

  test('a renderer crash then Reload restores the live layout without a prompt', async () => {
    await launch({ beforeLaunch: seedSavedShow() });
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Default User', LIVE_SONG);

    // The native Reload/Quit dialog is answered by the test seam (Reload)
    await app.evaluate(() => { globalThis.__e2eRendererCrashAnswer = 'reload'; });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer());
    await expect.poll(() => app.evaluate(() => globalThis.__e2eRendererCrashPrompts || 0), { timeout: 20000 }).toBe(1);
    expect(readRecovery(userDataDir, 'Default User')?.handoff).toBe('renderer-crash');

    // Playwright's page stays marked crashed after the reload, so read the
    // reloaded page through the main process
    const inPage = (expr) => app.evaluate(
      ({ BrowserWindow }, code) => BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(code),
      expr
    ).catch(() => null);
    await expect.poll(() => inPage('window.isRestoringProfileState === false && !!window.__e2eInitialSearchSettled'), {
      timeout: 20000
    }).toBe(true);
    expect(await inPage(`document.querySelectorAll('.modal.show').length`)).toBe(0);
    expect(await inPage(`document.querySelector('#hotkeys_list_1 #f1_hotkey').getAttribute('songid')`)).toBe(LIVE_SONG);
    // The handoff is spent: another crash before any edit would ask
    expect(readRecovery(userDataDir, 'Default User')?.handoff).toBeNull();
  });

  test('declining the prompt opens the saved show', async () => {
    await launch({ beforeLaunch: seedSavedShow() });
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Default User', LIVE_SONG);

    await crashApp(app);
    await relaunch();

    const prompt = restorePrompt(page);
    await expect(prompt).toBeVisible({ timeout: 20000 });
    await prompt.getByRole('button', { name: 'Open saved show' }).click();
    await expect(prompt).toHaveCount(0);

    await waitForAppReady(page, app);
    await expect(f1SongId(page)).toHaveAttribute('songid', SAVED_SONG);
    expect(fs.existsSync(recoveryRecordPath(userDataDir, 'Default User'))).toBe(false);
  });

  test('the prompt is only shown to the crashed profile', async () => {
    await launch();
    await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Second Show', ''));
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Default User', LIVE_SONG);

    await crashApp(app);
    await relaunch('Second Show');
    await waitForShowReady(page, 'Second Show');
    await expect(restorePrompt(page)).toHaveCount(0);
    await expect(f1SongId(page)).not.toHaveAttribute('songid', /.+/);
    // The crashed profile's record is kept for its own next open
    expect(readRecovery(userDataDir, 'Default User')?.layout.hotkeys[0].hotkeys.f1).toBe(LIVE_SONG);
  });

  test('upgrade: an existing state.json becomes a show named Default Show; state.json unchanged', async () => {
    const stateJson = JSON.stringify({
      version: '1.0.0',
      timestamp: 1700000000000,
      hotkeys: [{ tabNumber: 1, tabName: 'Legacy Keys', hotkeys: { f1: '1003' } }],
      holdingTank: [{ tabNumber: 1, tabName: null, songIds: ['1004'] }]
    }, null, 2);
    let statePath;
    await launch({
      beforeLaunch: (dir) => {
        statePath = path.join(dir, 'profiles', 'Default User', 'state.json');
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, stateJson);
      }
    });

    await expect(f1SongId(page)).toHaveAttribute('songid', '1003');
    await expect(page.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText('Legacy Keys');
    await expect(page.locator('#holding_tank_1 .list-group-item[songid="1004"]')).toHaveCount(1);
    const doc = readShows(userDataDir, 'Default User');
    expect(doc.shows).toHaveLength(1);
    expect(doc.shows[0].name).toBe('Default Show');
    await expect(page.locator('#show-name')).toHaveText('Default Show');

    // Live edits and a quit never write state.json
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Default User', LIVE_SONG);
    await quit(app);
    expect(fs.readFileSync(statePath, 'utf8')).toBe(stateJson);
  });

  test('switch profile then cancel keeps the live layout', async () => {
    await launch();
    await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Second Show', ''));
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Default User', LIVE_SONG);

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu:switch-profile'));
    const picker = page.locator('#profileSwitchModal');
    await expect(picker.locator('#profile-content')).toBeVisible({ timeout: 10000 });
    await picker.locator('#cancel-switch-btn').click();
    await expect(picker).toBeHidden();

    await expect(f1SongId(page)).toHaveAttribute('songid', LIVE_SONG);
    expect(readRecovery(userDataDir, 'Default User')?.layout.hotkeys[0].hotkeys.f1).toBe(LIVE_SONG);
  });

  test('switch to another profile and back loads the saved show', async () => {
    await launch({ beforeLaunch: seedSavedShow() });
    await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Second Show', ''));
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Default User', LIVE_SONG);

    await switchProfile(page, 'Second Show');
    await expect(f1SongId(page)).not.toHaveAttribute('songid', /.+/);
    expect(fs.existsSync(recoveryRecordPath(userDataDir, 'Default User'))).toBe(false);

    await switchProfile(page, 'Default User');
    await expect(restorePrompt(page)).toHaveCount(0);
    await expect(f1SongId(page)).toHaveAttribute('songid', SAVED_SONG);
  });

  test('Log Out discards the live layout', async () => {
    await launch();
    await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Show Night', ''));
    await switchProfile(page, 'Show Night');
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Show Night', LIVE_SONG);

    const reloaded = page.waitForEvent('load');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu:logout'));
    await reloaded;
    await waitForShowReady(page, 'Default User');

    expect(fs.existsSync(recoveryRecordPath(userDataDir, 'Show Night'))).toBe(false);
    expect(readShows(userDataDir, 'Show Night').shows[0].layout.hotkeys[0].hotkeys).toEqual({});
    await switchProfile(page, 'Show Night');
    await expect(f1SongId(page)).not.toHaveAttribute('songid', /.+/);
  });

  test('Duplicate Profile copies the saved shows, not the live layout', async () => {
    await launch();
    await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Source Show', ''));
    seedSavedShow('Source Show')(userDataDir);
    await switchProfile(page, 'Source Show');
    await expect(f1SongId(page)).toHaveAttribute('songid', SAVED_SONG);
    await assignF1(page, LIVE_SONG);
    await waitForRecoveredF1(userDataDir, 'Source Show', LIVE_SONG);

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu:duplicate-profile'));
    const modal = page.locator('#duplicateProfileModal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await modal.locator('#duplicateTargetName').fill('Copy Show');
    const reloaded = page.waitForEvent('load');
    await modal.locator('#duplicateProfileBtn').click();
    await reloaded;
    await waitForShowReady(page, 'Copy Show');

    await expect(f1SongId(page)).toHaveAttribute('songid', SAVED_SONG);
    expect(readShows(userDataDir, 'Copy Show').shows[0].layout.hotkeys[0].hotkeys.f1).toBe(SAVED_SONG);
    expect(readShows(userDataDir, 'Source Show').shows[0].layout.hotkeys[0].hotkeys.f1).toBe(SAVED_SONG);
  });
});
