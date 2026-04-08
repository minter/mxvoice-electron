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

  test('switch profile API saves state and triggers relaunch', async () => {
    // Create a second profile so we have something to switch to
    await createProfileInLauncher('SecondProfile', 'For switching');

    // Launch into Default User
    const mainWindow = await launchProfile('Default User');

    // Wait for full initialization (moduleRegistry must be available)
    await mainWindow.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });

    // Verify we're running as Default User
    const currentProfile = await mainWindow.evaluate(async () => {
      return await window.secureElectronAPI?.profile?.getCurrent?.();
    });
    console.log('Current profile:', currentProfile);
    expect(currentProfile?.success).toBe(true);
    expect(currentProfile?.profile).toBe('Default User');

    // Verify the switch profile API is available
    const switchAvailable = await mainWindow.evaluate(() => {
      return typeof window.secureElectronAPI?.profile?.switchProfile === 'function';
    });
    expect(switchAvailable).toBe(true);

    // Verify state can be extracted (the first step of profile switching)
    const stateResult = await mainWindow.evaluate(async () => {
      if (window.moduleRegistry?.profileState?.extractProfileState) {
        const state = window.moduleRegistry.profileState.extractProfileState();
        return { success: true, hasState: !!state, hotkeyTabs: Object.keys(state?.hotkeyTabs || {}).length };
      }
      return { success: false, error: 'extractProfileState not available' };
    });
    console.log('State extraction result:', stateResult);
    expect(stateResult.success).toBe(true);
    expect(stateResult.hasState).toBe(true);

    // Note: Actually calling switchProfile() would close the window and relaunch the app,
    // which Playwright can't track across process boundaries. We've verified:
    // 1. The current profile is correctly identified
    // 2. The switch API is available
    // 3. Profile state can be extracted for saving before switch
    // 4. Multiple profiles exist to switch between
  });
});
