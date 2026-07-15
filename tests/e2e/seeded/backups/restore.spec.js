import { _electron as electron, test, expect } from '@playwright/test';
import electronPath from 'electron';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

test.describe('Profile Backups - restore', () => {
  let app;
  let page;
  let userDataDir;
  let profileDir;
  let backupDir;
  const replacementHomes = [];

  async function relaunchWithCurrentUserData() {
    await closeApp(app);

    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-backup-restore-home-'));
    replacementHomes.push(fakeHome);
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
        HOME: fakeHome,
        APPDATA: fakeHome,
      },
    });

    page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page, app);
  }

  test.beforeAll(async () => {
    ({ app, page, userDataDir } = await launchSeededApp(electron, 'backup-restore'));

    profileDir = path.join(userDataDir, 'profiles', 'Default User');
    backupDir = path.join(userDataDir, 'profile-backups', 'Default User');

    // Ensure clean backup and profile directories
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });
    fs.mkdirSync(profileDir, { recursive: true });

    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    await page.bringToFront();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
    for (const home of replacementHomes) {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  // Dismiss any leftover modals
  test.beforeEach(async () => {
    if (!page) return;
    try {
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.querySelectorAll('.modal.show').forEach(el => {
          el.classList.remove('show');
          el.style.display = '';
        });
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      });
    } catch {
      // Page might not be ready
    }
  });

  /**
   * Helper: create a backup and wait for it to complete
   */
  async function createBackup() {
    // Ensure profile directory has content
    const stateFile = path.join(profileDir, 'state.json');
    if (!fs.existsSync(stateFile)) {
      fs.writeFileSync(stateFile, JSON.stringify({
        version: '1.0.0',
        timestamp: Date.now(),
        testData: 'original'
      }, null, 2));
    }

    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('menu:create-backup');
    });

    // Wait for the success/error modal
    const resultModal = page.locator('.modal').filter({
      hasText: /Backup (Complete|Failed|Error|created successfully)/i
    });
    await expect(resultModal).toBeVisible({ timeout: 60000 });

    const modalText = await resultModal.textContent();
    if (/Failed|Error/i.test(modalText)) {
      await resultModal.locator('button').first().click();
      throw new Error(`Backup failed: ${modalText}`);
    }

    // Dismiss success modal
    const okButton = resultModal.locator('button:has-text("OK"), button.btn-primary').first();
    if (await okButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await okButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(resultModal).not.toBeVisible({ timeout: 5000 });
  }

  test('restore backup via API restores profile state', async () => {
    // Step 1: Write a known preferences file to profile
    const originalPrefs = {
      fade_out_seconds: 42,
      font_size: 99,
      test_marker: 'original-prefs'
    };
    fs.writeFileSync(
      path.join(profileDir, 'preferences.json'),
      JSON.stringify(originalPrefs, null, 2)
    );

    // Step 2: Create a backup of this known state
    await createBackup();

    // Step 3: Modify the preferences (simulating user activity)
    const modifiedPrefs = {
      fade_out_seconds: 1,
      font_size: 10,
      test_marker: 'modified-prefs'
    };
    fs.writeFileSync(
      path.join(profileDir, 'preferences.json'),
      JSON.stringify(modifiedPrefs, null, 2)
    );

    // Verify the prefs were modified
    const prefsBeforeRestore = JSON.parse(
      fs.readFileSync(path.join(profileDir, 'preferences.json'), 'utf8')
    );
    expect(prefsBeforeRestore.test_marker).toBe('modified-prefs');

    // Step 4: Get the backup ID (first non-pre-restore backup)
    const metadataFile = path.join(backupDir, 'backup-metadata.json');
    expect(fs.existsSync(metadataFile)).toBe(true);
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    expect(metadata.backups.length).toBeGreaterThan(0);
    const backupId = metadata.backups[0].id;
    console.log('Backup ID to restore:', backupId);

    // Step 5: Restore via the API (bypassing the confirm dialog)
    const restoreResult = await page.evaluate(async (bid) => {
      const api = window.secureElectronAPI;
      if (api?.profile?.restoreBackup) {
        return await api.profile.restoreBackup(bid);
      }
      return { success: false, error: 'API not available' };
    }, backupId);

    console.log('Restore result:', restoreResult);
    expect(restoreResult.success).toBe(true);

    // Step 6: Verify the preferences file was restored to the original
    const prefsAfterRestore = JSON.parse(
      fs.readFileSync(path.join(profileDir, 'preferences.json'), 'utf8')
    );
    expect(prefsAfterRestore.test_marker).toBe('original-prefs');
    expect(prefsAfterRestore.fade_out_seconds).toBe(42);
  });

  test('restore creates a pre-restore backup', async () => {
    // Write some state
    fs.writeFileSync(
      path.join(profileDir, 'state.json'),
      JSON.stringify({ testData: 'pre-restore-check', timestamp: Date.now() }, null, 2)
    );

    // Create a backup
    await createBackup();

    // Modify state
    fs.writeFileSync(
      path.join(profileDir, 'state.json'),
      JSON.stringify({ testData: 'modified-for-pre-restore', timestamp: Date.now() }, null, 2)
    );

    // Count existing backups
    const metadataBefore = JSON.parse(
      fs.readFileSync(path.join(backupDir, 'backup-metadata.json'), 'utf8')
    );
    const countBefore = metadataBefore.backups.length;

    // Restore the first backup
    const backupId = metadataBefore.backups[0].id;
    await page.evaluate(async (bid) => {
      const api = window.secureElectronAPI;
      return await api.profile.restoreBackup(bid);
    }, backupId);

    // Read metadata again — should have more backups (pre-restore backup created)
    await expect(async () => {
      const metadataAfter = JSON.parse(
        fs.readFileSync(path.join(backupDir, 'backup-metadata.json'), 'utf8')
      );
      expect(metadataAfter.backups.length).toBeGreaterThan(countBefore);
    }).toPass({ timeout: 5000 });

    const metadataAfter = JSON.parse(
      fs.readFileSync(path.join(backupDir, 'backup-metadata.json'), 'utf8')
    );
    const countAfter = metadataAfter.backups.length;
    expect(countAfter).toBeGreaterThan(countBefore);

    // The newest backup should be a pre-restore type
    const preRestoreBackup = metadataAfter.backups.find(b =>
      b.mode === 'pre-restore' || b.mode === 'Pre-restore'
    );
    expect(preRestoreBackup).toBeTruthy();
    console.log('Pre-restore backup:', preRestoreBackup?.id, preRestoreBackup?.mode);
  });

  test('restore dialog lists backups with restore buttons', async () => {
    // Ensure at least one backup exists
    await createBackup();

    // Open restore dialog via menu
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('menu:restore-backup');
    });

    // Wait for the restore modal to appear
    await expect(page.locator('#backupRestoreModal')).toBeVisible({ timeout: 5000 });

    // Verify backup items are listed
    const backupItems = page.locator('#backup-restore-list .list-group-item');
    const itemCount = await backupItems.count();
    expect(itemCount).toBeGreaterThan(0);

    // Verify each item has a restore button
    const restoreButtons = page.locator('#backup-restore-list .restore-btn');
    const buttonCount = await restoreButtons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Close the modal
    await page.locator('#backupRestoreModal .btn-close').click();
    await expect(page.locator('#backupRestoreModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('restore button confirms, restores profile state, and preserves the replaced state', async () => {
    test.slow();

    fs.rmSync(backupDir, { recursive: true, force: true });
    fs.mkdirSync(backupDir, { recursive: true });

    const markerKey = 'e2e_backup_restore_marker';
    await expect(page.evaluate((key) => (
      window.secureElectronAPI.profile.setPreference(key, 'backed-up-state')
    ), markerKey)).resolves.toMatchObject({ success: true });
    await createBackup();

    const metadataPath = path.join(backupDir, 'backup-metadata.json');
    const metadataBefore = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const manualBackup = metadataBefore.backups.find(({ mode }) => mode === 'manual');
    expect(manualBackup).toBeTruthy();

    await expect(page.evaluate((key) => (
      window.secureElectronAPI.profile.setPreference(key, 'replaced-state')
    ), markerKey)).resolves.toMatchObject({ success: true });

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('menu:restore-backup');
    });

    const restoreModal = page.locator('#backupRestoreModal');
    await expect(restoreModal).toBeVisible({ timeout: 5000 });
    await restoreModal
      .locator(`.list-group-item[data-backup-id="${manualBackup.id}"] .restore-btn`)
      .click();

    const confirmation = page.locator('.modal.show').filter({ hasText: 'Restore Backup' });
    await expect(confirmation).toContainText('A backup of your current profile will be created first');
    await confirmation.getByRole('button', { name: 'Confirm' }).click();

    const complete = page.locator('.modal.show').filter({ hasText: 'Restore Complete' });
    await expect(complete).toContainText('Backup restored successfully', { timeout: 10000 });
    const reloaded = page.waitForEvent('load');
    await complete.getByRole('button', { name: 'Confirm' }).click();
    await reloaded;
    await waitForAppReady(page, app);

    await expect(page.evaluate(async (key) => (
      window.secureElectronAPI.profile.getPreference(key)
    ), markerKey)).resolves.toMatchObject({ success: true, value: 'backed-up-state' });

    const metadataAfter = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const preRestoreBackup = metadataAfter.backups.find(({ mode }) => mode === 'pre-restore');
    expect(preRestoreBackup).toBeTruthy();
    const replacedPreferences = JSON.parse(fs.readFileSync(
      path.join(backupDir, preRestoreBackup.id, 'preferences.json'),
      'utf8'
    ));
    expect(replacedPreferences[markerKey]).toBe('replaced-state');

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('menu:restore-backup');
    });
    await expect(restoreModal).toBeVisible({ timeout: 5000 });
    await expect(restoreModal.locator('.badge', { hasText: 'Pre-restore' })).toBeVisible();
    await restoreModal.getByRole('button', { name: 'Cancel' }).click();

    await relaunchWithCurrentUserData();
    await expect(page.evaluate(async (key) => (
      window.secureElectronAPI.profile.getPreference(key)
    ), markerKey)).resolves.toMatchObject({ success: true, value: 'backed-up-state' });
  });
});
