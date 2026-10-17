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

  async function waitForProfile(page, name) {
    await page.waitForFunction(
      async (profile) => window.moduleRegistry?.profileState
        && window.isRestoringProfileState === false
        && (await window.secureElectronAPI.profile.getCurrent()).profile === profile,
      name,
      { timeout: 20000 }
    );
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
});
