import { _electron as electron, test, expect } from '@playwright/test';
import electronPath from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

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

  async function launchReplacementProcess() {
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
  }

  async function switchToLauncher(mainWindow) {
    // Electron's automatic replacement process is not connected to Playwright.
    // Suppress only that spawn; the production switch path still saves state,
    // closes the window, and exits this process. The test launches the observable
    // replacement process with the same isolated user-data directory.
    await app.evaluate(({ app: electronApp }) => {
      electronApp.relaunch = () => {};
    });

    const processClosed = app.waitForEvent('close', { timeout: 15000 });
    await mainWindow.evaluate(() => {
      void window.moduleRegistry.profileState.switchProfileWithSave();
    }).catch(() => {});
    await processClosed;
    app = null;
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

    // Reload profile list to reflect the deletion
    await page.evaluate(() => {
      if (typeof window.loadProfiles === 'function') {
        window.loadProfiles();
      }
    });

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
  });

  test('switching profiles across process relaunch preserves isolated state', async () => {
    await createProfileInLauncher('SecondProfile', 'For switching');

    let mainWindow = await launchProfile('Default User');
    await mainWindow.waitForFunction(
      () => window.moduleRegistry?.profileState && window.isRestoringProfileState === false,
      { timeout: 15000 }
    );
    await dismissFirstRunModal(mainWindow);

    await renameActiveTab(mainWindow, '#hotkey-rename-btn', 'Default Keys');
    await renameActiveTab(mainWindow, '#holding-tank-rename-btn', 'Default Queue');
    await mainWindow.evaluate(() => (
      window.secureElectronAPI.profile.setPreference('e2e_profile_marker', 'default-marker')
    ));
    await expect(mainWindow.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText('Default Keys');
    await expect(mainWindow.locator('#holding_tank_tabs a[href="#holding_tank_1"]')).toHaveText('Default Queue');

    await switchToLauncher(mainWindow);
    await launchReplacementProcess();

    mainWindow = await launchProfile('SecondProfile');
    await mainWindow.waitForFunction(
      () => window.moduleRegistry?.profileState && window.isRestoringProfileState === false,
      { timeout: 15000 }
    );
    await dismissFirstRunModal(mainWindow);

    expect(await mainWindow.evaluate(() => window.secureElectronAPI.profile.getCurrent()))
      .toMatchObject({ success: true, profile: 'SecondProfile' });
    await expect(mainWindow.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText('1');
    await expect(mainWindow.locator('#holding_tank_tabs a[href="#holding_tank_1"]')).toHaveText('1');
    expect(await mainWindow.evaluate(async () => (
      await window.secureElectronAPI.profile.getPreference('e2e_profile_marker')
    )).value).not.toBe('default-marker');

    await renameActiveTab(mainWindow, '#hotkey-rename-btn', 'Second Keys');
    await renameActiveTab(mainWindow, '#holding-tank-rename-btn', 'Second Queue');
    await mainWindow.evaluate(() => (
      window.secureElectronAPI.profile.setPreference('e2e_profile_marker', 'second-marker')
    ));

    await switchToLauncher(mainWindow);
    await launchReplacementProcess();

    mainWindow = await launchProfile('Default User');
    await mainWindow.waitForFunction(
      () => window.moduleRegistry?.profileState && window.isRestoringProfileState === false,
      { timeout: 15000 }
    );
    await dismissFirstRunModal(mainWindow);

    expect(await mainWindow.evaluate(() => window.secureElectronAPI.profile.getCurrent()))
      .toMatchObject({ success: true, profile: 'Default User' });
    await expect(mainWindow.locator('#hotkey_tabs a[href="#hotkeys_list_1"]')).toHaveText('Default Keys');
    await expect(mainWindow.locator('#holding_tank_tabs a[href="#holding_tank_1"]')).toHaveText('Default Queue');
    expect(await mainWindow.evaluate(async () => (
      await window.secureElectronAPI.profile.getPreference('e2e_profile_marker')
    ))).toMatchObject({ success: true, value: 'default-marker' });

    const secondState = JSON.parse(fs.readFileSync(
      path.join(userDataDir, 'profiles', 'SecondProfile', 'state.json'),
      'utf8'
    ));
    expect(secondState.hotkeys[0].tabName).toBe('Second Keys');
    expect(secondState.holdingTank[0].tabName).toBe('Second Queue');
  });
});
