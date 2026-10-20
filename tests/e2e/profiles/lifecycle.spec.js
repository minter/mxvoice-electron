import { _electron as electron, test, expect } from '@playwright/test';
import electronPath from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { boardsDocument, readBoards, recoveryRecordPath, seedBoards } from '../../utils/seed-boards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Helper: launch the app without --profile to show the launcher,
 * create any needed profiles, then launch into the main app.
 */

test.describe('Profile Lifecycle', () => {
  let app;
  let page;
  let userDataDir;
  let fakeHome;

  test.beforeEach(async () => {
    const testId = `profile-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    userDataDir = path.join(__dirname, `../../fixtures/test-user-data-${testId}`);

    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(userDataDir, { recursive: true });

    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));

    app = await electron.launch({
      executablePath: electronPath,
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_TEST_MODE: '1',
        DISABLE_HARDWARE_ACCELERATION: '1',
        AUTO_UPDATE: '0',
        E2E_USER_DATA_DIR: userDataDir,
        HOME: fakeHome,
        APPDATA: fakeHome,
      },
    });

    page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#profile-content', { timeout: 10000 });
  });

  test.afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (userDataDir && fs.existsSync(userDataDir)) {
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
    }
    if (fakeHome && fs.existsSync(fakeHome)) {
      try { fs.rmSync(fakeHome, { recursive: true, force: true }); } catch {}
    }
  });

  /**
   * Helper: create a profile in the launcher UI
   */
  async function createProfileInLauncher(name, description = '') {
    const createButton = page.locator('#create-profile-btn');
    await createButton.click();

    const modal = page.locator('#create-profile-modal');
    await expect(modal).toBeVisible();

    const nameInput = page.locator('#profile-name-input');
    await nameInput.click();
    await nameInput.fill(name);

    if (description) {
      const descInput = page.locator('#profile-description-input');
      await descInput.click();
      await descInput.fill(description);
    }

    const confirmButton = page.locator('#confirm-create-btn');
    await confirmButton.click();

    await expect(page.locator(`.profile-item[data-profile-name="${name}"]`)).toBeVisible({ timeout: 10000 });
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  }

  /**
   * Helper: launch into a profile from the launcher
   */
  async function launchProfile(profileName) {
    const profileItem = page.locator(`.profile-item[data-profile-name="${profileName}"]`);
    await profileItem.click();
    await expect(profileItem).toHaveClass(/selected/);

    const windowPromise = app.waitForEvent('window');
    const launchButton = page.locator('#launch-btn');
    await launchButton.click();

    const mainWindow = await windowPromise;
    await mainWindow.waitForLoadState('domcontentloaded');
    await expect(mainWindow.locator('#omni_search')).toBeVisible({ timeout: 15000 });
    return mainWindow;
  }

  // Profile → Switch Profile opens the shared picker in a dialog inside the
  // main window. Returns the dialog.
  async function sendMenuEvent(channel) {
    await app.evaluate(({ BrowserWindow }, name) => {
      BrowserWindow.getAllWindows()
        .find((win) => win.webContents.getURL().endsWith('index.html'))
        .webContents.send(name);
    }, channel);
  }

  async function openSwitchPicker(mainWindow) {
    await sendMenuEvent('menu:switch-profile');
    const dialog = mainWindow.locator('#profileSwitchModal');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.locator('#profile-content')).toBeVisible();
    return dialog;
  }

  // Choose a profile in the open dialog; the main window reloads into it.
  async function chooseInPicker(mainWindow, profileName) {
    const dialog = mainWindow.locator('#profileSwitchModal');
    const profileItem = dialog.locator(`.profile-item[data-profile-name="${profileName}"]`);
    await profileItem.click();
    await expect(profileItem).toHaveClass(/selected/);
    const reloaded = mainWindow.waitForEvent('load');
    await dialog.locator('#launch-btn').click();
    await reloaded;
    await waitForProfileReady(mainWindow, profileName);
  }

  // The predicate must be synchronous: waitForFunction treats a returned
  // Promise as truthy and would pass before the page has started
  async function waitForProfileReady(mainWindow, profileName) {
    await mainWindow.waitForFunction(
      () => !!window.moduleRegistry?.profileState && window.isRestoringProfileState === false,
      null,
      { timeout: 15000 }
    );
    await expect.poll(
      () => mainWindow.evaluate(async () => (await window.secureElectronAPI.profile.getCurrent()).profile),
      { timeout: 15000 }
    ).toBe(profileName);
  }

  async function windowCount() {
    return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed()).length);
  }

  async function renameActiveTab(mainWindow, buttonSelector, name) {
    await mainWindow.locator(buttonSelector).click();
    const prompt = mainWindow.locator('.modal:visible .prompt-input');
    await expect(prompt).toBeVisible();
    await prompt.fill(name);
    await mainWindow.locator('.modal:visible .confirm-btn').click();
    await expect(prompt).not.toBeVisible({ timeout: 5000 });
  }

  async function dismissFirstRunModal(mainWindow) {
    const modal = mainWindow.locator('#firstRunModal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.getByRole('button', { name: 'Got It!' }).click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  }

  test('delete profile from launcher removes it', async () => {
    // Create a profile to delete
    await createProfileInLauncher('ToDelete', 'Will be deleted');

    // Verify it exists
    const profileItem = page.locator('.profile-item[data-profile-name="ToDelete"]');
    await expect(profileItem).toBeVisible();

    // Count profiles before delete
    const countBefore = await page.locator('.profile-item').count();

    // Delete via the launcher API (directly invoke IPC since launcher has delete capability)
    const deleteResult = await app.evaluate(async ({ ipcMain }, profileName) => {
      // Use the profile manager to delete directly
      const profileManager = globalThis.__profileManager || null;
      if (profileManager && typeof profileManager.deleteProfile === 'function') {
        return await profileManager.deleteProfile(profileName);
      }
      // Fallback: use the launcher IPC handler
      return { success: false, error: 'profileManager not available' };
    }, 'ToDelete');

    // If direct delete didn't work, try via the launcher's exposed API
    if (!deleteResult?.success) {
      await page.evaluate(async (profileName) => {
        if (window.launcherAPI?.deleteProfile) {
          return await window.launcherAPI.deleteProfile(profileName);
        }
      }, 'ToDelete');
    }

    // Reload the launcher to reflect the deletion
    await page.reload();
    await page.waitForSelector('#profile-content', { state: 'visible', timeout: 10000 });

    // Wait for the deleted profile to disappear from the UI
    await expect(page.locator('.profile-item[data-profile-name="ToDelete"]')).toHaveCount(0, { timeout: 10000 });

    // Verify profile count decreased
    const countAfter = await page.locator('.profile-item').count();
    expect(countAfter).toBe(countBefore - 1);

    // Verify the deleted profile is gone
    await expect(page.locator('.profile-item[data-profile-name="ToDelete"]')).toHaveCount(0);
  });

  test('cannot delete Default User profile', async () => {
    // Attempt to delete Default User via API
    const result = await page.evaluate(async () => {
      if (window.launcherAPI?.deleteProfile) {
        return await window.launcherAPI.deleteProfile('Default User');
      }
      return { success: false, error: 'API not available' };
    });

    // Should fail — Default User cannot be deleted
    expect(result?.success).toBeFalsy();

    // Verify Default User is still present
    await expect(page.locator('.profile-item[data-profile-name="Default User"]')).toBeVisible();
  });

  test('cannot delete the last remaining profile', async () => {
    // With only Default User, attempt to delete it
    const profiles = await page.locator('.profile-item').count();
    expect(profiles).toBe(1);

    const result = await page.evaluate(async () => {
      if (window.launcherAPI?.deleteProfile) {
        return await window.launcherAPI.deleteProfile('Default User');
      }
      return { success: false, error: 'API not available' };
    });

    expect(result?.success).toBeFalsy();

    // Still have 1 profile
    const afterCount = await page.locator('.profile-item').count();
    expect(afterCount).toBe(1);
  });

  test('duplicate profile creates a copy with new name', async () => {
    // Create a source profile first
    await createProfileInLauncher('Original', 'The original profile');

    // Launch into Original
    const mainWindow = await launchProfile('Original');

    // Wait for the app to fully initialize (moduleRegistry must be available)
    await mainWindow.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });

    // Call the duplicate function directly via evaluate (more reliable than menu IPC)
    await mainWindow.evaluate(async () => {
      // Store current profile for duplication
      const currentProfile = await window.secureElectronAPI.profile.getCurrent();
      window.currentProfileForDuplication = currentProfile.profile;
    });

    // Duplicate the profile directly via the API
    const result = await mainWindow.evaluate(async () => {
      const sourceName = window.currentProfileForDuplication;
      if (!sourceName) return { success: false, error: 'No source profile' };

      return await window.secureElectronAPI.profile.duplicateProfile(
        sourceName,
        'CopyOfOriginal',
        'A duplicated profile'
      );
    });

    console.log('Duplicate result:', result);
    expect(result?.success).toBe(true);

    // Poll for the duplicate profile directory to be created on disk
    let profilesExist = false;
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(path.join(userDataDir, 'profiles', 'CopyOfOriginal'))) {
        profilesExist = true;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    expect(profilesExist).toBe(true);

    // Verify the new profile has a preferences.json
    const prefsExist = fs.existsSync(path.join(userDataDir, 'profiles', 'CopyOfOriginal', 'preferences.json'));
    expect(prefsExist).toBe(true);
    // and the source's saved boards
    expect(readBoards(userDataDir, 'CopyOfOriginal')).toEqual(readBoards(userDataDir, 'Original'));
  });

  // Boards (Task 9): a switch discards the live layout, so each profile now
  // opens on its saved board. The isolation check seeds boards.json for both.
  test('switching profiles in-process opens each profile on its own saved board', async () => {
    await createProfileInLauncher('SecondProfile', 'For switching');
    const namedTabs = (keys, queue) => boardsDocument({
      hotkeys: [{ tabNumber: 1, tabName: keys, hotkeys: {} }],
      holdingTank: [{ tabNumber: 1, tabName: queue, songIds: [] }]
    });
    seedBoards(userDataDir, 'Default User', namedTabs('Default Keys', 'Default Queue'));
    seedBoards(userDataDir, 'SecondProfile', namedTabs('Second Keys', 'Second Queue'));

    const mainWindow = await launchProfile('Default User');
    await waitForProfileReady(mainWindow, 'Default User');
    await dismissFirstRunModal(mainWindow);
    const pid = app.process().pid;

    await expect(mainWindow.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText('Default Keys');
    await expect(mainWindow.locator('#holding_tank_tabs a[href="#holding_tank_1"]')).toHaveText('Default Queue');
    await mainWindow.evaluate(() => (
      window.secureElectronAPI.profile.setPreference('e2e_profile_marker', 'default-marker')
    ));

    await openSwitchPicker(mainWindow);
    await chooseInPicker(mainWindow, 'SecondProfile');
    await dismissFirstRunModal(mainWindow);

    await expect(mainWindow.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText('Second Keys');
    await expect(mainWindow.locator('#holding_tank_tabs a[href="#holding_tank_1"]')).toHaveText('Second Queue');
    expect(await mainWindow.evaluate(async () => (
      await window.secureElectronAPI.profile.getPreference('e2e_profile_marker')
    )).value).not.toBe('default-marker');

    // A live rename is discarded by the switch away
    await renameActiveTab(mainWindow, '#hotkey-rename-btn', 'Live Rename');
    await mainWindow.evaluate(() => (
      window.secureElectronAPI.profile.setPreference('e2e_profile_marker', 'second-marker')
    ));

    await openSwitchPicker(mainWindow);
    await chooseInPicker(mainWindow, 'Default User');
    await dismissFirstRunModal(mainWindow);

    await expect(mainWindow.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText('Default Keys');
    await expect(mainWindow.locator('#holding_tank_tabs a[href="#holding_tank_1"]')).toHaveText('Default Queue');
    expect(await mainWindow.evaluate(async () => (
      await window.secureElectronAPI.profile.getPreference('e2e_profile_marker')
    ))).toMatchObject({ success: true, value: 'default-marker' });

    expect(readBoards(userDataDir, 'SecondProfile').boards[0].layout.hotkeys[0].tabName).toBe('Second Keys');
    expect(fs.existsSync(recoveryRecordPath(userDataDir, 'SecondProfile'))).toBe(false);

    // Same process and window throughout, no relaunch hand-off keys
    expect(app.process().pid).toBe(pid);
    expect(await windowCount()).toBe(1);
    const config = JSON.parse(fs.readFileSync(path.join(userDataDir, 'config.json'), 'utf8'));
    expect(config).not.toHaveProperty('fallback-profile');
    expect(config).not.toHaveProperty('auto-select-profile');
  });

  test('cancelling Switch Profile returns to the untouched session', async () => {
    await createProfileInLauncher('SecondProfile');

    const mainWindow = await launchProfile('Default User');
    await waitForProfileReady(mainWindow, 'Default User');
    await dismissFirstRunModal(mainWindow);

    await renameActiveTab(mainWindow, '#hotkey-rename-btn', 'Live Keys');
    await mainWindow.locator('#omni_search').fill('in-flight search');
    await mainWindow.evaluate(() => { window.__e2eSessionMarker = 'still-here'; });

    const picker = await openSwitchPicker(mainWindow);
    expect(await windowCount()).toBe(1);
    await picker.locator('#cancel-switch-btn').click();
    await expect(picker).toBeHidden();

    // Not reloaded: in-memory page state and layout survive the cancel
    expect(await mainWindow.evaluate(() => window.__e2eSessionMarker)).toBe('still-here');
    await expect(mainWindow.locator('#omni_search')).toHaveValue('in-flight search');
    await expect(mainWindow.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText('Live Keys');
    await expect(mainWindow.locator('#omni_search')).toBeVisible();
    expect(await mainWindow.evaluate(() => window.secureElectronAPI.profile.getCurrent()))
      .toMatchObject({ success: true, profile: 'Default User' });
  });

  test('Esc cancels Switch Profile; the startup launcher has no cancel', async () => {
    await expect(page.locator('#cancel-switch-btn')).toBeHidden();

    const mainWindow = await launchProfile('Default User');
    await waitForProfileReady(mainWindow, 'Default User');
    await dismissFirstRunModal(mainWindow);
    await mainWindow.evaluate(() => { window.__e2eSessionMarker = 'still-here'; });

    const picker = await openSwitchPicker(mainWindow);
    await expect(picker.locator('#cancel-switch-btn')).toBeVisible();
    // Esc closes the create-profile form first, without leaving the picker
    await picker.locator('#create-profile-btn').click();
    await expect(picker.locator('#create-profile-modal')).toBeVisible();
    await mainWindow.keyboard.press('Escape');
    await expect(picker.locator('#create-profile-modal')).toBeHidden();
    await expect(picker).toBeVisible();

    await mainWindow.keyboard.press('Escape');
    await expect(picker).toBeHidden();
    expect(await mainWindow.evaluate(() => window.__e2eSessionMarker)).toBe('still-here');

    // The close button backs out too, and the dialog opens again afterwards
    await openSwitchPicker(mainWindow);
    await picker.locator('#modal-close').click();
    await expect(picker).toBeHidden();
    expect(await mainWindow.evaluate(() => window.__e2eSessionMarker)).toBe('still-here');
  });

  test('Switch Profile dialog names the running profile and what the button will do', async () => {
    await expect(page.locator('#launcher-title')).toHaveText('Choose a profile');
    await expect(page.locator('#launcher-current')).toBeHidden();
    await createProfileInLauncher('SecondProfile');

    const mainWindow = await launchProfile('Default User');
    await waitForProfileReady(mainWindow, 'Default User');
    await dismissFirstRunModal(mainWindow);

    const picker = await openSwitchPicker(mainWindow);
    await expect(picker.locator('#launcher-title')).toHaveText('Switch profile');
    await expect(picker.locator('#launcher-current')).toHaveText('Current: Default User');
    await expect(picker.locator('.profile-item[data-profile-name="Default User"] .profile-current-tag')).toHaveText('Current');
    await expect(picker.locator('.profile-item[data-profile-name="SecondProfile"] .profile-current-tag')).toHaveCount(0);
    // A dialog like the app's others, not a second window
    await expect(picker).toHaveClass(/modal/);
    expect(await windowCount()).toBe(1);

    // The running profile is shown but can't be chosen; the only other one
    // starts selected, and the button says what it will do
    const running = picker.locator('.profile-item[data-profile-name="Default User"]');
    await expect(running).toHaveClass(/disabled/);
    await expect(running).toHaveAttribute('aria-disabled', 'true');
    await expect(picker.locator('#launch-btn')).toHaveText('Switch to SecondProfile');
    await running.click({ force: true });
    await expect(running).not.toHaveClass(/selected/);
    await expect(picker.locator('.profile-item[data-profile-name="SecondProfile"]')).toHaveClass(/selected/);
    await expect(picker.locator('#launch-btn')).toHaveText('Switch to SecondProfile');
  });

  test('filtering keeps the Switch Profile dialog its size and drops a hidden selection', async () => {
    await createProfileInLauncher('Aaron');
    await createProfileInLauncher('Sandy Duncan');
    await createProfileInLauncher('Zed');
    const mainWindow = await launchProfile('Default User');
    await waitForProfileReady(mainWindow, 'Default User');
    await dismissFirstRunModal(mainWindow);

    const picker = await openSwitchPicker(mainWindow);
    await expect(picker.locator('.profile-item')).toHaveCount(4);
    const dialogHeight = () => picker.locator('.modal-content').evaluate((el) => el.getBoundingClientRect().height);
    const before = await dialogHeight();

    await picker.locator('.profile-item[data-profile-name="Zed"]').click();
    await expect(picker.locator('#launch-btn')).toHaveText('Switch to Zed');

    await picker.locator('#profile-search').fill('san');
    await expect(picker.locator('.profile-item')).toHaveCount(1);
    expect(await dialogHeight()).toBe(before);
    // Zed is filtered out, so it is no longer what the button would switch to
    await expect(picker.locator('#launch-btn')).toHaveText('Switch');
    await expect(picker.locator('#launch-btn')).toBeDisabled();

    await picker.locator('#profile-search').fill('nobody');
    await expect(picker.locator('.profile-picker-empty')).toBeVisible();
    expect(await dialogHeight()).toBe(before);
  });

  test('Enter in the Switch Profile dialog switches instead of playing a song', async () => {
    await createProfileInLauncher('SecondProfile');
    const mainWindow = await launchProfile('Default User');
    await waitForProfileReady(mainWindow, 'Default User');
    await dismissFirstRunModal(mainWindow);

    const picker = await openSwitchPicker(mainWindow);
    await picker.locator('.profile-item[data-profile-name="SecondProfile"]').click();
    const reloaded = mainWindow.waitForEvent('load');
    await mainWindow.keyboard.press('Enter');
    await reloaded;
    await waitForProfileReady(mainWindow, 'SecondProfile');
  });

  test('a profile created in the Switch Profile dialog is selected, not switched to', async () => {
    const mainWindow = await launchProfile('Default User');
    await waitForProfileReady(mainWindow, 'Default User');
    await dismissFirstRunModal(mainWindow);

    const picker = await openSwitchPicker(mainWindow);
    await picker.locator('#create-profile-btn').click();
    await picker.locator('#profile-name-input').fill('Made Here');
    await picker.locator('#confirm-create-btn').click();

    await expect(picker.locator('.profile-item[data-profile-name="Made Here"]')).toHaveClass(/selected/);
    await expect(picker.locator('#launch-btn')).toHaveText('Switch to Made Here');
    expect(await mainWindow.evaluate(() => window.secureElectronAPI.profile.getCurrent()))
      .toMatchObject({ profile: 'Default User' });
  });

  test('the startup launcher preselects the most recently used profile', async () => {
    await createProfileInLauncher('Recent');
    const mainWindow = await launchProfile('Recent');
    await waitForProfileReady(mainWindow, 'Recent');
    await app.close();

    app = await electron.launch({
      executablePath: electronPath,
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_TEST_MODE: '1',
        DISABLE_HARDWARE_ACCELERATION: '1',
        AUTO_UPDATE: '0',
        E2E_USER_DATA_DIR: userDataDir,
        HOME: fakeHome,
        APPDATA: fakeHome,
      },
    });
    page = await app.firstWindow();
    await page.waitForSelector('#profile-content', { timeout: 10000 });

    await expect(page.locator('.profile-item[data-profile-name="Recent"]')).toHaveClass(/selected/);
    await expect(page.locator('#launch-btn')).toHaveText('Open Recent');
    await expect(page.locator('#cancel-switch-btn')).toBeHidden();
  });

  test('Log Out switches to Default User in-process and discards the live layout', async () => {
    await createProfileInLauncher('ShowNight');

    const mainWindow = await launchProfile('ShowNight');
    await waitForProfileReady(mainWindow, 'ShowNight');
    await dismissFirstRunModal(mainWindow);
    await renameActiveTab(mainWindow, '#hotkey-rename-btn', 'Show Keys');
    const pid = app.process().pid;

    const reloaded = mainWindow.waitForEvent('load');
    await sendMenuEvent('menu:logout');
    await reloaded;
    await waitForProfileReady(mainWindow, 'Default User');

    expect(app.process().pid).toBe(pid);
    // Boards (Task 9): Log Out discards the live layout; the saved board and
    // recovery are untouched by it
    expect(readBoards(userDataDir, 'ShowNight').boards[0].layout.hotkeys[0].tabName).toBeNull();
    expect(fs.existsSync(recoveryRecordPath(userDataDir, 'ShowNight'))).toBe(false);
    expect(fs.existsSync(path.join(userDataDir, 'profiles', 'ShowNight', 'state.json'))).toBe(false);
  });

  test('deleting the current profile then cancelling falls back to Default User', async () => {
    await createProfileInLauncher('Temporary');

    const mainWindow = await launchProfile('Temporary');
    await waitForProfileReady(mainWindow, 'Temporary');
    await dismissFirstRunModal(mainWindow);

    mainWindow.once('dialog', (dialog) => dialog.accept());
    await sendMenuEvent('menu:delete-current-profile');
    const picker = mainWindow.locator('#profileSwitchModal');
    await expect(picker).toBeVisible({ timeout: 10000 });
    await expect(picker.locator('.profile-item[data-profile-name="Default User"]')).toBeVisible();
    await expect(picker.locator('.profile-item[data-profile-name="Temporary"]')).toHaveCount(0);
    await expect(picker.locator('.profile-current-tag')).toHaveCount(0);

    const reloaded = mainWindow.waitForEvent('load');
    await picker.locator('#cancel-switch-btn').click();
    await reloaded;
    await waitForProfileReady(mainWindow, 'Default User');

    // Nothing wrote the deleted profile back to disk
    expect(fs.existsSync(path.join(userDataDir, 'profiles', 'Temporary'))).toBe(false);
  });
});
