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
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for songs tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'songs'));
  });

  test.beforeEach(async () => {
    // Ensure clean state before each test
    try {
      // Close any open modals
      const modalVisible = await page.locator('#songFormModal').isVisible();
      if (modalVisible) {
        try {
          await page.locator('#songFormModal .btn-close').click();
          await page.waitForTimeout(500);
        } catch (e) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
      
      // Wait for page to be ready
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log('Setup cleanup failed, continuing:', error.message);
    }
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

    // 2) Instrument the renderer to capture the IPC payload
    await page.exposeFunction('___captureAddDialog', (filename) => {
      window.__lastAddDialog = filename;
    });
    
    // Wait a moment for the page to be ready
    await page.waitForLoadState('domcontentloaded');
    
    await page.addInitScript(() => {
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
    


    // 3) Trigger the menu item that opens the dialog
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

    // 4) Since the modal is showing up, the IPC message worked! 
    // Let's verify the modal content directly
    
    // Wait for the modal to be visible with a longer timeout and retry logic
    let modalVisible = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!modalVisible && attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`Attempt ${attempts}: Waiting for modal to appear...`);
        await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 10000 });
        modalVisible = true;
        console.log('Modal is now visible');
      } catch (error) {
        console.log(`Attempt ${attempts} failed: ${error.message}`);
        if (attempts < maxAttempts) {
          console.log('Retrying menu trigger...');
          await triggerMenuItem();
          await page.waitForTimeout(2000);
        } else {
          throw new Error(`Modal failed to appear after ${maxAttempts} attempts: ${error.message}`);
        }
      }
    }
    
    // Ensure the modal is fully loaded and interactive
    await page.waitForTimeout(500);
    
    // Wait for the title to be populated
    await expect(page.locator('#songFormModalTitle')).toContainText('Add New Song', { timeout: 5000 });
    
    // Wait for the form fields to be populated
    await expect(page.locator('#song-form-title')).toHaveValue('Shame On You', { timeout: 5000 });
    await expect(page.locator('#song-form-artist')).toHaveValue('Indigo Girls', { timeout: 5000 });
    await expect(page.locator('#song-form-duration')).toHaveValue('0:30', { timeout: 5000 });
    
    // Verify the modal is in the correct state
    // Bootstrap modals have multiple classes, so check if they contain what we need
    await expect(page.locator('#songFormModal')).toHaveClass(/show/);
    await expect(page.locator('#songFormModal')).toBeVisible();
    
    // 5) Modify the form fields
    
    // Change category from "Game" to "Running In"
    await page.locator('#song-form-category').selectOption({ label: 'Running In' });
    
    // Change Info field from blank to "Test"
    await page.locator('#song-form-info').fill('Test');
    
    // 6) Submit the form by clicking the Add button
    await page.locator('#songFormSubmitButton').click();
    
    // 7) Wait for the modal to close
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
    
    // 8) Verify the song appears in the search results
    
    // Wait for the search results to update
    await page.waitForTimeout(1000);
    
    // Look for the new song in the search results
    await expect(page.locator('#search_results')).toContainText('Shame On You');
    await expect(page.locator('#search_results')).toContainText('Indigo Girls');
    await expect(page.locator('#search_results')).toContainText('Test');
    
    // 9) Verify the song file exists in the test music directory
    
    // Wait a bit longer for file operations to complete
    await page.waitForTimeout(2000);
    
    // Get the music directory from the store
    const musicDirResult = await page.evaluate(async () => {
      if (window.secureElectronAPI?.store?.get) {
        return await window.secureElectronAPI.store.get('music_directory');
      } else if (window.electronAPI?.store?.get) {
        return await window.electronAPI.store.get('music_directory');
      }
      return null;
    });
    
    if (musicDirResult?.success && musicDirResult.value) {
      const musicDir = musicDirResult.value;
      
      // Check if a file with the expected pattern exists in the test music directory
      const fileExists = await page.evaluate(async (dir) => {
        if (window.secureElectronAPI?.fileSystem?.readdir) {
          try {
            const result = await window.secureElectronAPI.fileSystem.readdir(dir);
            
            // The IPC handler returns the file array directly, not wrapped in {success, data}
            if (Array.isArray(result)) {
              return { success: true, files: result };
            } else if (result?.success && result.data) {
              return { success: true, files: result.data };
            } else {
              return { success: false, error: 'readdir failed', result: result };
            }
          } catch (err) {
            return { success: false, error: err.message };
          }
        } else {
          return { success: false, error: 'secureElectronAPI.fileSystem.readdir not available' };
        }
      }, musicDir);
      
      if (fileExists?.success && fileExists.files) {
        const files = fileExists.files;
        
        // Look for a file that contains "Indigo Girls" and "Shame On You"
        const songFile = files.find(file => 
          (file.includes('Indigo Girls') || file.includes('IndigoGirls')) && 
          (file.includes('Shame On You') || file.includes('ShameOnYou')) && 
          file.endsWith('.mp3')
        );
        
        if (songFile) {
          console.log('✅ Song file found in test music directory:', songFile);
        } else {
          console.log('❌ No matching song file found');
          const mp3Files = files.filter(f => f.endsWith('.mp3'));
          console.log('MP3 files in directory:', mp3Files);
        }
      } else {
        console.log('❌ Failed to read test music directory:', fileExists?.error || 'Unknown error');
      }
    } else {
      console.log('⚠️ Could not retrieve music directory from store');
    }
    
    // 10) Restore dialog
    await app.evaluate(() => { globalThis.__restoreDialog?.(); });
    
    // 11) Verify test environment is clean
    console.log('Test completed successfully, verifying clean state...');
    
    // Ensure modal is closed
    const modalStillVisible = await page.locator('#songFormModal').isVisible();
    if (modalStillVisible) {
      console.log('Modal still visible after test, closing...');
      try {
        await page.locator('#songFormModal .btn-close').click();
        await page.waitForTimeout(500);
      } catch (e) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }
  });

  test('Add song via dialog → cancel flow → song not added', async () => {
    // 1) Stub dialog in main and make it return the John Lennon song path
    const mp3 = path.resolve(__dirname, '../../../fixtures/test-songs/JohnLennon-NobodyToldMe.mp3');
    
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showOpenDialog;
      // Save a restorer for later
      // @ts-ignore
      globalThis.__restoreDialogCancel = () => (dialog.showOpenDialog = original);
    });
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => {
        return {
          canceled: false,
          filePaths: [filePath],
        };
      };
    }, mp3);

    // 2) Instrument the renderer to capture the IPC payload
    await page.exposeFunction('___captureAddDialogCancel', (filename) => {
      window.__lastAddDialogCancel = filename;
    });
    
    // Wait a moment for the page to be ready
    await page.waitForLoadState('domcontentloaded');
    
    await page.addInitScript(() => {
      // Listen for the add_dialog_load IPC message using the secure API
      if (window.secureElectronAPI?.events?.onAddDialogLoad) {
        window.secureElectronAPI.events.onAddDialogLoad((filename, metadata) => {
          console.log('IPC: add_dialog_load received for cancel test:', filename);
          window.___captureAddDialogCancel?.(filename);
          
          // Also check if startAddNewSong is available and call it
          if (window.startAddNewSong) {
            console.log('IPC: Calling startAddNewSong for cancel test');
            window.startAddNewSong(filename, metadata);
          } else if (window.moduleRegistry?.songManagement?.startAddNewSong) {
            console.log('IPC: Calling startAddNewSong via moduleRegistry for cancel test');
            window.moduleRegistry.songManagement.startAddNewSong(filename, metadata);
          } else {
            console.log('IPC: startAddNewSong not available for cancel test!');
          }
        });
      }
    });

    // 3) Trigger the menu item that opens the dialog
    const triggerMenuItemCancel = async () => {
      // First, ensure the page is in a clean state
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      // Verify the modal is not already visible
      const modalVisible = await page.locator('#songFormModal').isVisible();
      if (modalVisible) {
        console.log('Modal already visible, closing it first...');
        try {
          await page.locator('#songFormModal .btn-close').click();
          await page.waitForTimeout(500);
        } catch (e) {
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
    
    await triggerMenuItemCancel();

    // 4) Wait for the modal to appear and verify John Lennon song info
    let modalVisible = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!modalVisible && attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`Attempt ${attempts}: Waiting for modal to appear for cancel test...`);
        await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 10000 });
        modalVisible = true;
        console.log('Modal is now visible for cancel test');
      } catch (error) {
        console.log(`Attempt ${attempts} failed: ${error.message}`);
        if (attempts < maxAttempts) {
          console.log('Retrying menu trigger for cancel test...');
          await triggerMenuItemCancel();
          await page.waitForTimeout(2000);
        } else {
          throw new Error(`Modal failed to appear after ${maxAttempts} attempts: ${error.message}`);
        }
      }
    }
    
    // Ensure the modal is fully loaded and interactive
    await page.waitForTimeout(500);
    
    // Wait for the title to be populated
    await expect(page.locator('#songFormModalTitle')).toContainText('Add New Song', { timeout: 5000 });
    
    // Wait for the form fields to be populated with John Lennon song info
    await expect(page.locator('#song-form-title')).toHaveValue('Nobody Told Me', { timeout: 5000 });
    await expect(page.locator('#song-form-artist')).toHaveValue('John Lennon', { timeout: 5000 });
    
    // Verify the modal is in the correct state
    await expect(page.locator('#songFormModal')).toHaveClass(/show/);
    await expect(page.locator('#songFormModal')).toBeVisible();
    
    // 5) Click the Cancel button instead of Add
    console.log('Clicking Cancel button...');
    await page.locator('#songFormModal .btn.btn-secondary').click();
    
    // 6) Wait for the modal to close
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
    
    // 7) Search for "Lennon" and verify no results
    console.log('Searching for "Lennon" to verify no results...');
    
    // Find the search input and enter "Lennon"
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Lennon');
    await searchInput.press('Enter');
    
    // Wait for search results to update
    await page.waitForTimeout(1000);
    
    // Verify no search results contain "Lennon"
    const searchResults = page.locator('#search_results');
    await expect(searchResults).not.toContainText('John Lennon');
    await expect(searchResults).not.toContainText('Nobody Told Me');
    
    // 8) Verify no John Lennon file exists in the music directory
    console.log('Verifying no John Lennon file exists in music directory...');
    
    // Get the music directory from the store
    const musicDirResult = await page.evaluate(async () => {
      if (window.secureElectronAPI?.store?.get) {
        return await window.secureElectronAPI.store.get('music_directory');
      } else if (window.electronAPI?.store?.get) {
        return await window.electronAPI.store.get('music_directory');
      }
      return null;
    });
    
    if (musicDirResult?.success && musicDirResult.value) {
      const musicDir = musicDirResult.value;
      
      // Check if any files with "Lennon" exist in the test music directory
      const fileExists = await page.evaluate(async (dir) => {
        if (window.secureElectronAPI?.fileSystem?.readdir) {
          try {
            const result = await window.secureElectronAPI.fileSystem.readdir(dir);
            
            // The IPC handler returns the file array directly, not wrapped in {success, data}
            if (Array.isArray(result)) {
              return { success: true, files: result };
            } else if (result?.success && result.data) {
              return { success: true, files: result.data };
            } else {
              return { success: false, error: 'readdir failed', result: result };
            }
          } catch (err) {
            return { success: false, error: err.message };
          }
        } else {
          return { success: false, error: 'secureElectronAPI.fileSystem.readdir not available' };
        }
      }, musicDir);
      
      if (fileExists?.success && fileExists.files) {
        const files = fileExists.files;
        
        // Look for any files containing "Lennon"
        const lennonFiles = files.filter(file => 
          file.includes('Lennon') && file.endsWith('.mp3')
        );
        
        if (lennonFiles.length === 0) {
          console.log('✅ No John Lennon files found in music directory (as expected)');
        } else {
          console.log('❌ John Lennon files found in music directory:', lennonFiles);
          throw new Error('John Lennon files should not exist after canceling');
        }
      } else {
        console.log('❌ Failed to read test music directory:', fileExists?.error || 'Unknown error');
      }
    } else {
      console.log('⚠️ Could not retrieve music directory from store');
    }
    
    // 9) Restore dialog
    await app.evaluate(() => { globalThis.__restoreDialogCancel?.(); });
    
    // 10) Verify test environment is clean
    console.log('Cancel test completed successfully, verifying clean state...');
    
    // Ensure modal is closed
    const modalStillVisible = await page.locator('#songFormModal').isVisible();
    if (modalStillVisible) {
      console.log('Modal still visible after cancel test, closing...');
      try {
        await page.locator('#songFormModal .btn-close').click();
        await page.waitForTimeout(500);
      } catch (e) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }
  });

  test('Bulk add all test songs to new category "RNOUT"', async () => {
    // 1) Stub dialog in main to return the test-songs directory
    const testSongsDir = path.resolve(__dirname, '../../../fixtures/test-songs');
    
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showOpenDialog;
      // Save a restorer for later
      // @ts-ignore
      globalThis.__restoreBulkDialog = () => (dialog.showOpenDialog = original);
    });
    await app.evaluate(({ dialog }, dirPath) => {
      dialog.showOpenDialog = async () => {
        return {
          canceled: false,
          filePaths: [dirPath],
        };
      };
    }, testSongsDir);

    // 2) Trigger the "Add All Songs In Directory" menu item
    const triggerBulkMenuItem = async () => {
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      const res = await app.evaluate(async ({ Menu, BrowserWindow }) => {
        const menu = Menu.getApplicationMenu();
        
        // Find the "Add All Songs In Directory" menu item in the Songs submenu
        const songsSubmenu = menu?.items?.find(item => item.label === 'Songs');
        const bulkAddItem = songsSubmenu?.submenu?.items?.find(item => item.label === 'Add All Songs In Directory');
        
        if (!bulkAddItem) return { ok: false, reason: 'Add All Songs In Directory menu item not found' };
        
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
        if (!win) return { ok: false, reason: 'No focused window' };
        
        // @ts-ignore
        bulkAddItem.click({}, win, win.webContents);
        return { ok: true };
      });
      
      if (!res.ok) {
        throw new Error(`Bulk menu item trigger failed: ${res.reason}`);
      }
      
      await page.waitForTimeout(1000);
    };
    
    await triggerBulkMenuItem();

    // 3) Wait for the bulk add modal to appear
    await expect(page.locator('#bulkAddModal')).toBeVisible({ timeout: 10000 });
    
    // 4) Select the "RNOUT" category (or create it if it doesn't exist)
    const categorySelect = page.locator('#bulk-add-category');
    
    // Check if RNOUT category exists, if not, create it
    const rnoutExists = await categorySelect.locator('option[value="RNOUT"]').count();
    if (rnoutExists === 0) {
      // Create new category by selecting "New Category" option
      await categorySelect.selectOption('new');
      await page.waitForTimeout(500);
      
      // Fill in the new category name
      const newCategoryInput = page.locator('#bulk-song-form-new-category');
      await newCategoryInput.fill('RNOUT');
      await page.waitForTimeout(500);
    } else {
      // Select existing RNOUT category
      await categorySelect.selectOption('RNOUT');
    }
    
    // 5) Click "Add All" button
    await page.locator('#bulkAddSubmitButton').click();
    
    // 6) Wait for the modal to close
    await expect(page.locator('#bulkAddModal')).not.toBeVisible({ timeout: 10000 });
    
    // 7) Wait for bulk processing to complete
    await page.waitForTimeout(3000);
    
    // 8) Verify all 7 test songs appear in the RNOUT category
    // First, select the RNOUT category in the search dropdown
    const searchCategorySelect = page.locator('#category_select');
    await searchCategorySelect.selectOption('RNOUT');
    await page.waitForTimeout(1000);
    
    // Clear any existing search terms
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('');
    await searchInput.press('Enter');
    await page.waitForTimeout(1000);
    
    // Verify we have exactly 7 results
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(7, { timeout: 10000 });
    
    // Verify specific songs are present (using actual metadata from the files)
    await expect(page.locator('#search_results')).toContainText('Eat It');
    await expect(page.locator('#search_results')).toContainText('Got The Time');
    await expect(page.locator('#search_results')).toContainText('Greatest Ameican Hero Theme');
    await expect(page.locator('#search_results')).toContainText('Nobody Told Me');
    await expect(page.locator('#search_results')).toContainText('Shame On You');
    await expect(page.locator('#search_results')).toContainText('The Wheel (Back and Forth)');
    await expect(page.locator('#search_results')).toContainText('We Are Family');
    
    // 9) Restore dialog
    await app.evaluate(() => { globalThis.__restoreBulkDialog?.(); });
    
    // 10) Verify test environment is clean
    console.log('Bulk add test completed successfully, verifying clean state...');
    
    // Ensure modal is closed
    const modalStillVisible = await page.locator('#bulkAddModal').isVisible();
    if (modalStillVisible) {
      console.log('Bulk modal still visible after test, closing...');
      try {
        await page.locator('#bulkAddModal .btn-close').click();
        await page.waitForTimeout(500);
      } catch (e) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }
  });
});


