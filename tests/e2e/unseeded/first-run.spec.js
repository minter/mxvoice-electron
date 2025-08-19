import { _electron as electron, test, expect } from '@playwright/test';
import electronPath from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

test.describe('First run flow', () => {
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
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('creates DB, copies sample song, and shows first-run modal', async () => {
    // 1) First-run modal appears
    await page.waitForSelector('#firstRunModal.show', { timeout: 15000 });
    const firstRunModal = page.locator('#firstRunModal');
    await expect(firstRunModal).toBeVisible();

    // 2) Close the modal via the "Got It!" button
    await firstRunModal.getByRole('button', { name: 'Got It!' }).click();
    await expect(firstRunModal).toBeHidden();

    // 3) Click into the search bar
    const searchInput = page.locator('#omni_search');
    await searchInput.click();

    // 4) Hit Enter to search (empty query → should return seeded song)
    await searchInput.press('Enter');

    // 5) Verify exactly one result and it is the CSz Rock Bumper
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    const firstRow = rows.first();
    await expect(firstRow).toContainText('Rock Bumper');
    await expect(firstRow).toContainText('Patrick Short');
    await expect(firstRow).toContainText('UNC');

    // Pre-play UI state
    await expect(page.locator('#stop_button')).toBeDisabled();

    // 6) Double-click the result to start playback
    await firstRow.dblclick();

    // Verify playing UI state (pause button visible, stop enabled, now playing text shown)
    await expect(page.locator('#pause_button')).toBeVisible();
    await expect(page.locator('#stop_button')).not.toBeDisabled();
    await expect(page.locator('#song_now_playing')).toBeVisible();
    await expect(page.locator('#song_now_playing')).toContainText('Rock Bumper');

    // 7) Wait a moment and verify the timer is progressing
    const startTime = await page.locator('#timer').textContent();
    const startRemaining = await page.locator('#duration').textContent();
    await page.waitForTimeout(1200);
    const afterTime = await page.locator('#timer').textContent();
    const afterRemaining = await page.locator('#duration').textContent();
    expect(startTime).not.toEqual(afterTime);
    expect(startRemaining).not.toEqual(afterRemaining);

    // 8) Click Stop to stop playback and verify UI resets
    await page.locator('#stop_button').click();
    await expect(page.locator('#play_button')).toBeVisible();
    await expect(page.locator('#pause_button')).toHaveClass(/d-none/);
    await expect(page.locator('#stop_button')).toBeDisabled();
    await expect(page.locator('#song_now_playing')).toBeHidden();

    // Artifact checks
    expect(fs.existsSync(path.join(dbDir, 'mxvoice.db'))).toBeTruthy();
    expect(fs.existsSync(path.join(musicDir, 'PatrickShort-CSzRockBumper.mp3'))).toBeTruthy();
    expect(fs.existsSync(hotkeysDir)).toBeTruthy();
    expect(fs.existsSync(configPath)).toBeTruthy();
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(cfg.first_run_completed).toBe(true);
    expect(cfg.database_directory).toBe(dbDir);
    expect(cfg.music_directory).toBe(musicDir);
    expect(cfg.hotkey_directory).toBe(hotkeysDir);
  });

  test('first run modal does not appear after adding song and restarting', async () => {
    // 1) First-run modal appears initially
    await page.waitForSelector('#firstRunModal.show', { timeout: 15000 });
    const firstRunModal = page.locator('#firstRunModal');
    await expect(firstRunModal).toBeVisible();

    // 2) Close the modal via the "Got It!" button
    await firstRunModal.getByRole('button', { name: 'Got It!' }).click();
    await expect(firstRunModal).toBeHidden();

    // 3) Add the Indigo Girls song via dialog
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
      // Debug: Log what's available in the window object
      console.log('Debug: window.secureElectronAPI available:', !!window.secureElectronAPI);
      console.log('Debug: window.startAddNewSong available:', !!window.startAddNewSong);
      console.log('Debug: window.moduleRegistry available:', !!window.moduleRegistry);
      if (window.moduleRegistry) {
        console.log('Debug: moduleRegistry keys:', Object.keys(window.moduleRegistry));
        if (window.moduleRegistry.songManagement) {
          console.log('Debug: songManagement keys:', Object.keys(window.moduleRegistry.songManagement));
        }
      }
      
      // Listen for the add_dialog_load IPC message using the secure API
      if (window.secureElectronAPI?.events?.onAddDialogLoad) {
        window.secureElectronAPI.events.onAddDialogLoad((filename, metadata) => {
          console.log('IPC: add_dialog_load received via secure API:', filename);
          window.___captureAddDialog?.(filename);
          
          // Also check if startAddNewSong is available and call it
          if (window.startAddNewSong) {
            console.log('IPC: Calling startAddNewSong directly');
            window.startAddNewSong(filename, metadata);
          } else if (window.moduleRegistry?.songManagement?.startAddNewSong) {
            console.log('IPC: Calling startAddNewSong via moduleRegistry');
            window.moduleRegistry.songManagement.startAddNewSong(filename, metadata);
          } else {
            console.log('IPC: startAddNewSong not available!');
            // Try to manually show the modal as a fallback
            console.log('IPC: Attempting to manually show modal...');
            const modal = document.querySelector('#songFormModal');
            if (modal) {
              console.log('IPC: Modal found, attempting to show...');
              // Try Bootstrap modal show method
              if (window.bootstrap && window.bootstrap.Modal) {
                const bsModal = new window.bootstrap.Modal(modal);
                bsModal.show();
                console.log('IPC: Bootstrap modal.show() called');
              } else {
                console.log('IPC: Bootstrap not available');
                // Try manual CSS manipulation
                modal.classList.add('show');
                modal.style.display = 'block';
                modal.style.background = 'rgba(0,0,0,0.5)';
                console.log('IPC: Manual CSS modal show attempted');
              }
            } else {
              console.log('IPC: Modal element not found in DOM');
            }
          }
        });
      } else if (window.electronAPI?.onAddDialogLoad) {
        window.electronAPI.onAddDialogLoad((filename) => {
          console.log('IPC: add_dialog_load received via legacy API:', filename);
          window.___captureAddDialog?.(filename);
        });
      } else if (window.electron?.ipcRenderer?.on) {
        window.electron.ipcRenderer.on('add_dialog_load', (_e, filename) => {
          console.log('IPC: add_dialog_load received via direct IPC:', filename);
          window.___captureAddDialog?.(filename);
        });
      } else {
        console.log('IPC: No IPC monitoring method available!');
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
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 60000 });
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

    // 13) Wait a reasonable time and verify the first run modal does NOT appear
    await page.waitForTimeout(3000);
    
    // The modal should not be visible
    const modalAfterRestart = page.locator('#firstRunModal');
    await expect(modalAfterRestart).not.toBeVisible();

    // 14) Verify the app is in normal state (search bar visible, etc.)
    await expect(page.locator('#omni_search')).toBeVisible();
  });
});


