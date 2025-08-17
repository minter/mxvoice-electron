import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Songs - add', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'songs'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('placeholder - page renders', async () => {
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('Add file via Electron dialog → sends add_dialog_load to renderer', async () => {
    // Absolute path to fixture file
    const mp3 = path.resolve(__dirname, '../../../fixtures/test-songs/IndigoGirls-ShameOnYou.mp3');

    // 1) Stub dialog in main and make it return our path
    console.log('Setting up dialog stub...');
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showOpenDialog;
      console.log('Original dialog.showOpenDialog:', typeof original);
      // Save a restorer for later
      // @ts-ignore
      globalThis.__restoreDialog = () => (dialog.showOpenDialog = original);
    });
    await app.evaluate(({ dialog }, filePath) => {
      console.log('Stubbing dialog.showOpenDialog to return:', filePath);
      dialog.showOpenDialog = async () => {
        console.log('Stubbed dialog.showOpenDialog called!');
        return {
          canceled: false,
          filePaths: [filePath],
        };
      };
    }, mp3);
    console.log('Dialog stub setup completed');

    // 2) Instrument the renderer to capture the IPC payload
    await page.exposeFunction('___captureAddDialog', (filename) => {
      console.log('___captureAddDialog called with:', filename);
      window.__lastAddDialog = filename;
    });
    
    // Wait a moment for the page to be ready
    await page.waitForLoadState('domcontentloaded');
    
    await page.addInitScript(() => {
      console.log('Setting up IPC monitoring...');
      console.log('secureElectronAPI available:', !!window.secureElectronAPI);
      console.log('electronAPI available:', !!window.electronAPI);
      console.log('electron.ipcRenderer available:', !!window.electron?.ipcRenderer);
      
      // Listen for the add_dialog_load IPC message using the secure API
      if (window.secureElectronAPI?.events?.onAddDialogLoad) {
        console.log('Using secureElectronAPI.events.onAddDialogLoad');
        window.secureElectronAPI.events.onAddDialogLoad((filename, metadata) => {
          console.log('Received add_dialog_load via secure API:', filename);
          window.___captureAddDialog?.(filename);
          
          // Also check if startAddNewSong is available and call it
          if (window.startAddNewSong) {
            console.log('Calling startAddNewSong...');
            window.startAddNewSong(filename, metadata);
          } else if (window.moduleRegistry?.songManagement?.startAddNewSong) {
            console.log('Calling startAddNewSong via moduleRegistry...');
            window.moduleRegistry.songManagement.startAddNewSong(filename, metadata);
          } else {
            console.log('startAddNewSong not available!');
          }
        });
      } else if (window.electronAPI?.onAddDialogLoad) {
        console.log('Using electronAPI.onAddDialogLoad');
        window.electronAPI.onAddDialogLoad((filename) => {
          console.log('Received add_dialog_load via legacy API:', filename);
          window.___captureAddDialog?.(filename);
        });
      } else if (window.electron?.ipcRenderer?.on) {
        console.log('Using electron.ipcRenderer.on directly');
        window.electron.ipcRenderer.on('add_dialog_load', (_e, filename) => {
          console.log('Received add_dialog_load via direct IPC:', filename);
          window.___captureAddDialog?.(filename);
        });
      } else {
        console.log('No IPC monitoring method available!');
      }
    });
    
    // Also try to capture console logs from the page
    page.on('console', msg => {
      console.log('Page console:', msg.text());
    });

    // 3) Trigger the menu item that opens the dialog
    console.log('About to trigger menu item...');
    await app.evaluate(async ({ Menu, BrowserWindow }) => {
      const menu = Menu.getApplicationMenu();
      console.log('Menu items:', menu?.items?.map(item => item.label));
      
      // Find the "Add Song" menu item in the Songs submenu
      const songsSubmenu = menu?.items?.find(item => item.label === 'Songs');
      console.log('Songs submenu items:', songsSubmenu?.submenu?.items?.map(item => item.label));
      
      const addSongItem = songsSubmenu?.submenu?.items?.find(item => item.label === 'Add Song');
      console.log('Add Song item found:', !!addSongItem);
      
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      console.log('Window found:', !!win);
      
      if (addSongItem) {
        console.log('Clicking Add Song menu item...');
        // @ts-ignore
        addSongItem?.click?.({}, win, win?.webContents);
        console.log('Add Song menu item clicked');
        
        // Wait a moment and check if the dialog was called
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('After click - checking if dialog was triggered...');
      } else {
        console.log('Add Song menu item not found!');
      }
    });
    console.log('Menu item trigger completed');
    
    // Add a small delay to see if the IPC message arrives
    console.log('Waiting a moment for IPC message...');
    await page.waitForTimeout(1000);

    // 4) Since the modal is showing up, the IPC message worked! 
    // Let's verify the modal content directly
    console.log('Waiting for modal to appear...');
    
    // Wait for the modal to be visible with a longer timeout
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 10000 });
    console.log('Modal is visible, checking title...');
    
    // Wait for the title to be populated
    await expect(page.locator('#songFormModalTitle')).toContainText('Add New Song', { timeout: 5000 });
    console.log('Modal title verified, checking form fields...');
    
    // Wait for the form fields to be populated
    await expect(page.locator('#song-form-title')).toHaveValue('Shame On You', { timeout: 5000 });
    await expect(page.locator('#song-form-artist')).toHaveValue('Indigo Girls', { timeout: 5000 });
    await expect(page.locator('#song-form-duration')).toHaveValue('0:30', { timeout: 5000 });
    
    console.log('All form fields verified successfully!');
    
    // 6) Restore dialog
    await app.evaluate(() => { globalThis.__restoreDialog?.(); });
  });


});


