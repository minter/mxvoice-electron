import { _electron as electron, test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../../config/test-environment.js';
import electronPath from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

test.describe('First run modal behavior', () => {
  let app;
  let page;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const userDataDir = path.join(__dirname, '../../fixtures/test-user-data');
  // For first run, database_directory defaults to userData root (not userData/data)
  const dbDir = userDataDir;
  const musicDir = path.join(userDataDir, 'mp3');
  const hotkeysDir = path.join(userDataDir, 'hotkeys');
  const configPath = path.join(userDataDir, 'config.json');
  // Isolate HOME/APPDATA to avoid legacy migration paths
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));

  test.beforeAll(async () => {
    // Clean isolated userData
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.mkdirSync(userDataDir, { recursive: true });

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
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('first run modal does not appear after adding song and restarting', async () => {
    // 1) First-run modal appears
    // Robust waiting strategy: first ensure element exists, then wait for show class and visibility
    await page.waitForSelector('#firstRunModal', { timeout: 10000, state: 'attached' });
    await page.waitForSelector('#firstRunModal.show', { timeout: 15000 });
    const firstRunModal = page.locator('#firstRunModal');
    await expect(firstRunModal).toBeVisible();

    // 2) Close the modal via the "Got It!" button
    const gotItButton = firstRunModal.getByRole('button', { name: 'Got It!' });
    await gotItButton.click();
    
    // On Windows, try multiple approaches to ensure modal is dismissed
    if (TEST_CONFIG.platform.isWindows) {
      // Wait for modal animation to complete
      await page.waitForTimeout(TEST_CONFIG.platform.modalAnimationTime);
      
      // Try pressing Escape as a fallback
      if (await firstRunModal.isVisible()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
      
      // Try clicking outside the modal
      if (await firstRunModal.isVisible()) {
        await page.mouse.click(100, 100); // Click outside modal
        await page.waitForTimeout(500);
      }
    }
    
    // Wait for modal to be hidden with extended timeout
    await expect(firstRunModal).toBeHidden({ timeout: TEST_CONFIG.platform.defaultTimeout });

    // 3) Add the Indigo Girls song via menu dialog
    const mp3 = path.resolve(__dirname, '../../../tests/fixtures/test-songs/IndigoGirls-ShameOnYou.mp3');
    
    // Stub dialog in main and make it return our path
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showOpenDialog;
      // Save a restorer for later
      // @ts-ignore
      globalThis.__restoreDialog = () => (dialog.showOpenDialog = original);
    });
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => {
        return {
          canceled: false,
          filePaths: [filePath],
        };
      };
    }, mp3);

    // 4) Instrument the renderer to capture the IPC payload and trigger song addition
    await page.exposeFunction('___captureAddDialog', (filename) => {
      window.__lastAddDialog = filename;
    });
    
    // Wait a moment for the page to be ready
    await page.waitForLoadState('domcontentloaded');
    
    await page.addInitScript(() => {
      // Listen for the add_dialog_load IPC message using the secure API
      if (window.secureElectronAPI?.events?.onAddDialogLoad) {
        window.secureElectronAPI.events.onAddDialogLoad((filename, metadata) => {
          window.___captureAddDialog?.(filename);
          if (window.startAddNewSong) {
            window.startAddNewSong(filename, metadata);
          } else if (window.moduleRegistry?.songManagement?.startAddNewSong) {
            window.moduleRegistry.songManagement.startAddNewSong(filename, metadata);
          }
        });
      } else if (window.electronAPI?.onAddDialogLoad) {
        window.electronAPI.onAddDialogLoad((filename) => {
          window.___captureAddDialog?.(filename);
        });
      } else if (window.electron?.ipcRenderer?.on) {
        window.electron.ipcRenderer.on('add_dialog_load', (_e, filename) => {
          window.___captureAddDialog?.(filename);
        });
      }
    });

    // 5) Trigger the Add Song menu item
    const triggerMenuItem = async () => {
      // First, ensure the page is in a clean state
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Give extra time for any async operations
      
      // Verify the modal is not already visible
      const modalVisible = await page.locator('#songFormModal').isVisible();
      if (modalVisible) {
        console.log('Modal already visible, closing it first...');
        try {
          await page.locator('#songFormModal .btn-close').click();
          await page.waitForTimeout(500);
        } catch (e) {
          // If close button not found, try pressing Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
      
      const res = await app.evaluate(async ({ Menu, BrowserWindow }) => {
        const menu = Menu.getApplicationMenu();
        
        // Find the "Add Song" menu item in the Songs submenu
        const songsSubmenu = menu?.items?.find(item => item.label === 'Songs');
        const addSongItem = songsSubmenu?.submenu?.items?.find(item => item.label === 'Add Song');
        
        if (!addSongItem) return { ok: false, reason: 'Add Song menu item not found' };
        
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
        if (!win) return { ok: false, reason: 'No focused window' };
        
        // @ts-ignore
        addSongItem.click({}, win, win.webContents);
        return { ok: true };
      });
      
      if (!res.ok) {
        throw new Error(`Menu item trigger failed: ${res.reason}`);
      }
      
      // Wait for the IPC message to be processed
      await page.waitForTimeout(1000);
    };
    
    await triggerMenuItem();

    // 6) Wait for the modal to appear and verify song info
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#songFormModalTitle')).toContainText('Add New Song', { timeout: 5000 });
    await expect(page.locator('#song-form-title')).toHaveValue('Shame On You', { timeout: 5000 });
    await expect(page.locator('#song-form-artist')).toHaveValue('Indigo Girls', { timeout: 5000 });

    // 7) Submit the form by clicking the Add button
    await page.locator('#songFormSubmitButton').click();
    
    // 8) Wait for the modal to close
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
    
    // 9) Verify the song appears in the search results
    await page.waitForTimeout(1000);
    await expect(page.locator('#search_results')).toContainText('Shame On You');
    await expect(page.locator('#search_results')).toContainText('Indigo Girls');

    // 10) Restore dialog
    await app.evaluate(() => { globalThis.__restoreDialog?.(); });

    // 11) Close the app
    await app.close();
    app = null;
    page = null;

    // 12) Reopen the app without resetting state
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

    // 13) Wait a reasonable time and verify the first run modal does NOT appear
    await page.waitForTimeout(3000);
    
    // The modal should not be visible
    const modalAfterRestart = page.locator('#firstRunModal');
    await expect(modalAfterRestart).not.toBeVisible();

    // 14) Verify the app is in normal state (search bar visible, etc.)
    await expect(page.locator('#omni_search')).toBeVisible();
  });
});
