import { _electron as electron, test, expect } from '@playwright/test';
import electronPath from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * In-process profile switching keeps one main process and one window for the
 * whole session (it used to relaunch). Nothing registered per switch or per
 * dialog may accumulate: these counts must stay constant.
 */
test.describe('Profile switch stability', () => {
  let app;
  let userDataDir;

  test.beforeEach(async () => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-switch-stability-'));
    app = await electron.launch({
      executablePath: electronPath,
      args: ['.', '--profile=Default User'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_TEST_MODE: '1',
        DISABLE_HARDWARE_ACCELERATION: '1',
        AUTO_UPDATE: '0',
        E2E_USER_DATA_DIR: userDataDir,
        HOME: userDataDir,
        APPDATA: userDataDir,
      },
    });
  });

  test.afterEach(async () => {
    await app?.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  // The predicate must be synchronous: waitForFunction treats a returned
  // Promise as truthy and would pass before the app has started
  async function waitForProfile(page, name) {
    await page.waitForFunction(
      () => !!window.moduleRegistry?.profileState && window.isRestoringProfileState === false,
      null,
      { timeout: 20000 }
    );
    await expect.poll(
      () => page.evaluate(async () => (await window.secureElectronAPI.profile.getCurrent()).profile),
      { timeout: 20000 }
    ).toBe(name);
  }

  function mainProcessCounts() {
    return app.evaluate(({ app: electronApp, ipcMain, BrowserWindow }) => {
      const count = (emitter) => emitter.eventNames().reduce((sum, name) => sum + emitter.listenerCount(name), 0);
      const [win] = BrowserWindow.getAllWindows();
      return {
        windows: BrowserWindow.getAllWindows().length,
        ipcMainListeners: count(ipcMain),
        invokeHandlers: ipcMain._invokeHandlers?.size ?? null,
        appListeners: count(electronApp),
        windowListeners: count(win),
      };
    });
  }

  async function documentListenerCount(page, cdp) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'document' });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    return listeners.length;
  }

  test('repeated switches keep one window and a constant set of main-process listeners', async () => {
    const page = await app.firstWindow();
    await waitForProfile(page, 'Default User');
    await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Other', ''));
    const pid = app.process().pid;
    const before = await mainProcessCounts();

    for (let i = 1; i <= 6; i++) {
      const target = i % 2 ? 'Other' : 'Default User';
      const reloaded = page.waitForEvent('load');
      await page.evaluate((name) => { void window.secureElectronAPI.profile.switchToProfile(name, 'launcher'); }, target);
      await reloaded;
      await waitForProfile(page, target);
    }

    expect(app.process().pid).toBe(pid);
    expect(await mainProcessCounts()).toEqual(before);
  });

  test('opening and closing Switch Profile leaves no listeners behind, even in quick succession', async () => {
    const page = await app.firstWindow();
    await waitForProfile(page, 'Default User');
    // The empty library shows the first-run dialog; Bootstrap dialogs don't stack
    const firstRun = page.locator('#firstRunModal');
    await expect(firstRun).toBeVisible({ timeout: 5000 });
    await firstRun.getByRole('button', { name: 'Got It!' }).click();
    await expect(firstRun).toBeHidden();
    const cdp = await page.context().newCDPSession(page);
    const dialog = page.locator('#profileSwitchModal');
    // Hidden happens before teardown: the picker (and its document key
    // listener) goes on Bootstrap's 'hidden', after the backdrop fades out
    const torndown = () => expect(dialog.locator('#profile-list')).toHaveCount(0);

    // First open creates the dialog for this page; count after that
    await page.evaluate(() => window.moduleRegistry.profilePicker.open());
    await expect(dialog.locator('#profile-content')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await torndown();
    const baseline = await documentListenerCount(page, cdp);

    for (let i = 0; i < 8; i++) {
      // Esc straight after opening (while it animates in) still closes it,
      // and opening again straight after closing still opens it
      await page.evaluate(() => window.moduleRegistry.profilePicker.open());
      await page.keyboard.press('Escape');
      // Past the animation: closed, and it stays closed
      await page.waitForTimeout(400);
      await expect(dialog).toBeHidden();
      await page.evaluate(() => window.moduleRegistry.profilePicker.open());
      await expect(dialog.locator('#profile-content')).toBeVisible();
      await page.evaluate(() => window.moduleRegistry.profilePicker.close());
      await expect(dialog).toBeHidden();
    }
    await torndown();

    expect(await documentListenerCount(page, cdp)).toBe(baseline);
  });

  test('Switch Profile does not open over another dialog', async () => {
    const page = await app.firstWindow();
    await waitForProfile(page, 'Default User');
    // The empty library's first-run dialog is open: Switch Profile must not
    // open invisibly behind it (and take over Enter and Esc)
    const firstRun = page.locator('#firstRunModal');
    await expect(firstRun).toBeVisible({ timeout: 5000 });

    await page.evaluate(() => window.moduleRegistry.profilePicker.open());
    await expect(page.locator('#profileSwitchModal')).toHaveCount(0);

    await firstRun.getByRole('button', { name: 'Got It!' }).click();
    await expect(firstRun).toBeHidden();
    await page.evaluate(() => window.moduleRegistry.profilePicker.open());
    await expect(page.locator('#profileSwitchModal #profile-content')).toBeVisible();
  });

  test('Enter right after Esc goes to the main window, not to the closing dialog', async () => {
    const page = await app.firstWindow();
    await waitForProfile(page, 'Default User');
    await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Other', ''));
    const firstRun = page.locator('#firstRunModal');
    await expect(firstRun).toBeVisible({ timeout: 5000 });
    await firstRun.getByRole('button', { name: 'Got It!' }).click();
    await expect(firstRun).toBeHidden();
    await page.evaluate(() => { window.__e2eSessionMarker = 'still-here'; });

    const dialog = page.locator('#profileSwitchModal');
    await page.evaluate(() => window.moduleRegistry.profilePicker.open());
    // The only other profile starts selected, so a stray Enter would switch to it
    await expect(dialog.locator('#launch-btn')).toHaveText('Switch to Other');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(800);

    expect(await page.evaluate(() => window.__e2eSessionMarker)).toBe('still-here');
    expect(await page.evaluate(async () => (await window.secureElectronAPI.profile.getCurrent()).profile)).toBe('Default User');
  });
});

test.describe('Unknown --profile at startup', () => {
  test('opens the launcher instead of running a profile that cannot save', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-unknown-profile-'));
    const app = await electron.launch({
      executablePath: electronPath,
      args: ['.', '--profile=Nobody Here'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_TEST_MODE: '1',
        DISABLE_HARDWARE_ACCELERATION: '1',
        AUTO_UPDATE: '0',
        E2E_USER_DATA_DIR: userDataDir,
        HOME: userDataDir,
        APPDATA: userDataDir,
      },
    });
    try {
      const page = await app.firstWindow();
      await page.waitForSelector('#profile-content', { timeout: 10000 });
      expect(page.url()).toContain('launcher.html');
      await expect(page.locator('#launcher-title')).toHaveText('Choose a profile');
      expect(fs.existsSync(path.join(userDataDir, 'profiles', 'Nobody Here'))).toBe(false);
    } finally {
      await app.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
