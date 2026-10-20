import { _electron as electron, test, expect } from '@playwright/test';
import electronPath from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Closing the last window quits on every platform (macOS included), after a
 * confirmation; an explicit quit (Cmd-Q, File > Quit) doesn't ask. Quitting
 * runs the shutdown path: page state flushed, then exit.
 *
 * Shows (Task 9): a clean quit discards the live layout. The flush now goes
 * to the crash-recovery record, which the exit then retires, so these tests
 * check that nothing of the night is left behind instead of that it was saved.
 */
test.describe('Quitting', () => {
  let app;
  let userDataDir;

  test.beforeEach(async () => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-quit-'));
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

  test.afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  async function readyWithRenamedHotkeyTab(name) {
    const page = await app.firstWindow();
    await page.waitForFunction(
      () => window.moduleRegistry?.profileState && window.isRestoringProfileState === false,
      null,
      { timeout: 20000 }
    );
    const firstRun = page.locator('#firstRunModal');
    await expect(firstRun).toBeVisible({ timeout: 5000 });
    await firstRun.getByRole('button', { name: 'Got It!' }).click();
    await expect(firstRun).toBeHidden();

    await page.locator('#hotkey-rename-btn').click();
    const prompt = page.locator('.modal:visible .prompt-input');
    await prompt.fill(name);
    await page.locator('.modal:visible .confirm-btn').click();
    await expect(page.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText(name);
    return page;
  }

  // The renamed tab is in neither the saved show nor a recovery record, and
  // nothing wrote state.json
  function expectNightDiscarded() {
    const profileDir = path.join(userDataDir, 'profiles', 'Default User');
    const shows = JSON.parse(fs.readFileSync(path.join(profileDir, 'shows.json'), 'utf8'));
    expect(shows.shows[0].layout.hotkeys[0].tabName).toBeNull();
    expect(fs.existsSync(path.join(userDataDir, 'recovery', 'default user.json'))).toBe(false);
    expect(fs.existsSync(path.join(profileDir, 'state.json'))).toBe(false);
  }

  test('closing the main window quits the app and discards the live layout', async () => {
    await readyWithRenamedHotkeyTab('Closed Keys');

    const exited = app.waitForEvent('close', { timeout: 20000 });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await exited;
    app = null;

    expectNightDiscarded();
  });

  test('closing the window asks first, and Cancel keeps the app running', async () => {
    const page = await readyWithRenamedHotkeyTab('Still Here');
    await app.evaluate(() => { globalThis.__e2eCloseAnswer = 'cancel'; });

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await expect.poll(() => app.evaluate(() => globalThis.__e2eCloseConfirmations)).toBe(1);

    // Still running, same page, nothing reloaded
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await expect(page.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText('Still Here');

    // Confirming the next close quits
    await app.evaluate(() => { globalThis.__e2eCloseAnswer = 'quit'; });
    const exited = app.waitForEvent('close', { timeout: 20000 });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await exited;
    app = null;
    expectNightDiscarded();
  });

  test('Cmd-Q quits without asking', async () => {
    await readyWithRenamedHotkeyTab('Explicit Quit');
    // Even with the answer set to Cancel, an explicit quit never consults it
    await app.evaluate(() => { globalThis.__e2eCloseAnswer = 'cancel'; });

    const exited = app.waitForEvent('close', { timeout: 20000 });
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
    await exited;
    app = null;
    expectNightDiscarded();
  });

  test('quitting right after a change leaves no recovery record behind', async () => {
    await readyWithRenamedHotkeyTab('Quit Keys');

    // Cmd-Q right away, before the debounced save would have run: the exit
    // flush must not land after the record is retired
    const exited = app.waitForEvent('close', { timeout: 20000 });
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
    await exited;
    app = null;

    expectNightDiscarded();
  });
});
