import { _electron as electron, test, expect } from '@playwright/test';
import {
  launchSeededApp,
  closeApp,
  clearModalBackdrop,
  performEmptySearch,
  waitForAppReady
} from '../../../utils/seeded-launch.js';

test.describe('Native menu wiring', () => {
  let app; let page;

  async function findMenuItem(label) {
    return app.evaluate(({ Menu }, targetLabel) => {
      const visit = (items = []) => {
        for (const item of items) {
          if (item.label === targetLabel) return item;
          const nested = visit(item.submenu?.items);
          if (nested) return nested;
        }
        return null;
      };
      const item = visit(Menu.getApplicationMenu()?.items);
      return item ? { found: true, enabled: item.enabled !== false } : { found: false };
    }, label);
  }

  async function triggerMenuItem(label) {
    const result = await app.evaluate(({ Menu, BrowserWindow }, targetLabel) => {
      const visit = (items = []) => {
        for (const item of items) {
          if (item.label === targetLabel) return item;
          const nested = visit(item.submenu?.items);
          if (nested) return nested;
        }
        return null;
      };
      const item = visit(Menu.getApplicationMenu()?.items);
      if (!item) return { ok: false, reason: `Menu item not found: ${targetLabel}` };
      if (item.enabled === false) return { ok: false, reason: `Menu item disabled: ${targetLabel}` };
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      if (!win) return { ok: false, reason: 'No application window' };
      item.click({}, win, win.webContents);
      return { ok: true };
    }, label);
    expect(result).toEqual({ ok: true });
  }

  async function closeModal(selector) {
    const modal = page.locator(selector);
    if (await modal.isVisible().catch(() => false)) {
      // Bootstrap ignores hide() while the fade-in transition is running, so a
      // single close click can be silently swallowed. Retry until it sticks.
      await expect(async () => {
        const close = modal.locator('.btn-close').first();
        if (await close.isVisible().catch(() => false)) await close.click();
        else await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 10000 });
    }
    await clearModalBackdrop(page);
  }

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'native-menu-wiring'));
    await waitForAppReady(page, app);
  });

  test.beforeEach(async () => {
    const tourClose = page.locator('.driver-popover-close-btn');
    if (await tourClose.isVisible().catch(() => false)) {
      await tourClose.click({ timeout: 2000 }).catch(() => {});
    }
    for (const selector of [
      '#categoryManagementModal', '#preferencesModal', '#newProfileModal',
      '#duplicateProfileModal', '#backupRestoreModal', '#backupSettingsModal'
    ]) {
      await closeModal(selector);
    }
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('View menu commands cross the main/preload/renderer boundary', async () => {
    await performEmptySearch(page);
    const firstSong = page.locator('#search_results tbody tr.song').first();
    await expect(firstSong).toBeVisible();

    await triggerMenuItem('Increase Font Size');
    await expect(firstSong).toHaveCSS('font-size', '12px');
    await triggerMenuItem('Decrease Font Size');
    await expect(firstSong).toHaveCSS('font-size', '11px');

    const waveform = page.locator('#waveform');
    await expect(waveform).toHaveClass(/hidden/);
    await triggerMenuItem('Show/Hide Waveform');
    await expect(waveform).not.toHaveClass(/hidden/, { timeout: 5000 });
    await triggerMenuItem('Show/Hide Waveform');
    await expect(waveform).toHaveClass(/hidden/, { timeout: 5000 });

    const advancedButton = page.locator('#advanced_search_button');
    await expect(advancedButton).toHaveAttribute('aria-expanded', 'false');
    await triggerMenuItem('Show/Hide Advanced Search');
    await expect(advancedButton).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
    await page.waitForFunction(
      () => !document.querySelector('#advanced-search')?.classList.contains('animate__animated'),
      { timeout: 5000 }
    );
    await triggerMenuItem('Show/Hide Advanced Search');
    await expect(advancedButton).toHaveAttribute('aria-expanded', 'false', { timeout: 5000 });
  });

  test('menu commands open renderer-owned modals and the What\'s New tour', async () => {
    const commands = [
      ['Manage Categories', '#categoryManagementModal'],
      ['Preferences', '#preferencesModal'],
      ['New Profile...', '#newProfileModal'],
      ['Duplicate Profile...', '#duplicateProfileModal'],
      ['Restore from Backup...', '#backupRestoreModal'],
      ['Backup Settings...', '#backupSettingsModal']
    ];

    for (const [label, selector] of commands) {
      await triggerMenuItem(label);
      await expect(page.locator(selector)).toBeVisible({ timeout: 5000 });
      await closeModal(selector);
    }

    await page.evaluate(() => window.secureElectronAPI.profile.setPreference('tours_seen', []));
    await triggerMenuItem("What's New");
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 5000 });
    await page.locator('.driver-popover-close-btn').click();
  });

  test('profile, backup, and library menu events reach their registered handlers', async () => {
    await page.evaluate(() => {
      window.__nativeMenuCalls = { switchProfile: 0, createBackup: 0, exportLibrary: 0, importLibrary: 0 };
      window.moduleRegistry.profileState.switchProfileWithSave = async () => {
        window.__nativeMenuCalls.switchProfile += 1;
      };
      window.moduleRegistry.profileBackup.createBackupNow = async () => {
        window.__nativeMenuCalls.createBackup += 1;
      };
      window.moduleRegistry.libraryTransfer.startExport = async () => {
        window.__nativeMenuCalls.exportLibrary += 1;
      };
      window.moduleRegistry.libraryTransfer.startImport = async () => {
        window.__nativeMenuCalls.importLibrary += 1;
      };
    });

    await triggerMenuItem('Switch Profile...');
    await triggerMenuItem('Create Backup Now');
    await triggerMenuItem('Export Library...');
    await triggerMenuItem('Import Library...');

    await expect.poll(() => page.evaluate(() => window.__nativeMenuCalls)).toEqual({
      switchProfile: 1,
      createBackup: 1,
      exportLibrary: 1,
      importLibrary: 1
    });

    expect(await findMenuItem('Log Out')).toEqual({ found: true, enabled: false });
    expect(await findMenuItem('Delete Current Profile...')).toEqual({ found: true, enabled: false });
  });

  test('Start a New Session reloads the renderer through the menu bridge', async () => {
    const navigation = page.waitForEvent('domcontentloaded');
    await triggerMenuItem('Start a New Session');
    await navigation;
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
    await expect(page.locator('#hotkeys-column')).toBeVisible();
  });
});
