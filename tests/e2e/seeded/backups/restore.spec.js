import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Profile Backups - restore', () => {
  let app;
  let page;
  let userDataDir;
  let profileDir;
  let backupDir;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for backup restore tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

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
    await page.waitForTimeout(1500);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  // Dismiss any leftover modals
  test.beforeEach(async () => {
    if (!page) return;
    try {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.querySelectorAll('.modal.show').forEach(el => {
          el.classList.remove('show');
          el.style.display = 'none';
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
      const api = window.secureElectronAPI || window.electronAPI;
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
      const api = window.secureElectronAPI || window.electronAPI;
      return await api.profile.restoreBackup(bid);
    }, backupId);

    await page.waitForTimeout(1000);

    // Read metadata again — should have more backups (pre-restore backup created)
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
});
