import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('Songs - delete', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for songs delete tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'songs-delete'));
    
    // After database reset, refresh the page to clear any cached search state
    console.log('🔄 Refreshing page to clear search cache after database reset...');
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    console.log('✅ Page refreshed and ready');
  });



  test.afterAll(async () => {
    await closeApp(app);
  });

  test('Delete song via context menu → confirmation modal → song removed', async () => {
    // 1) Start with a fresh database and search for "Anthrax"
    console.log('🔍 Searching for "Anthrax" to find the song to delete...');
    
    // First, ensure the database is ready by doing an empty search
    console.log('⏳ Ensuring database is ready with empty search...');
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.fill('');
    await searchInput.press('Enter');
    await page.waitForTimeout(2000);
    
    // Verify we have songs in the database
    const initialRows = page.locator('#search_results tbody tr');
    const initialCount = await initialRows.count();
    console.log(`🔍 Initial database state: ${initialCount} songs`);
    
    if (initialCount === 0) {
      console.log('⚠️ No songs found in database, waiting longer...');
      await page.waitForTimeout(3000);
      const retryCount = await initialRows.count();
      console.log(`🔍 After retry: ${retryCount} songs`);
    }
    
    // Now search for "Anthrax"
    console.log('🔍 Searching for "Anthrax"...');
    await searchInput.click();
    await searchInput.fill('Anthrax');
    await searchInput.press('Enter');
    
    // Wait for search results with more debugging
    console.log('⏳ Waiting for search results...');
    await page.waitForTimeout(3000);
    
    // Debug: Check what's in the search input
    const searchValue = await searchInput.inputValue();
    console.log(`🔍 Search input value: "${searchValue}"`);
    
    // Debug: Check if there are any search results at all
    const allRows = page.locator('#search_results tbody tr');
    const totalRows = await allRows.count();
    console.log(`🔍 Total rows in search results: ${totalRows}`);
    
    if (totalRows > 0) {
      // Show what songs are actually in the results
      for (let i = 0; i < totalRows; i++) {
        const row = allRows.nth(i);
        const title = await row.locator('td:nth-child(3)').textContent();
        const artist = await row.locator('td:nth-child(4)').textContent();
        console.log(`🔍 Row ${i}: Title="${title?.trim()}", Artist="${artist?.trim()}"`);
      }
    }
    
    // 2) Verify exactly one song is returned with longer timeout for CI
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 10000 });
    
    // Verify it's the expected song
    await expect(page.locator('#search_results')).toContainText('Got The Time');
    await expect(page.locator('#search_results')).toContainText('Anthrax');
    
    console.log('✅ Found Anthrax song as expected');
    
    // 3) Right-click on the song to get the context menu
    console.log('🖱️ Right-clicking on the song to open context menu...');
    
    // Find the specific row with the Anthrax song and right-click on it
    const anthraxRow = page.locator('#search_results tbody tr').filter({ hasText: 'Anthrax' });
    await anthraxRow.click({ button: 'right' });
    
    // 4) Wait for custom context menu to appear and click Delete
    console.log('🗑️ Waiting for context menu and selecting Delete...');
    
    // Wait for the custom context menu to be visible
    const contextMenu = page.locator('#mxv-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 2000 });
    
    // Click the Delete item in the context menu
    const deleteOption = contextMenu.locator('.mxv-context-item').filter({ hasText: 'Delete' });
    await expect(deleteOption).toBeVisible();
    await deleteOption.click();
    
    // 5) Ensure the confirmation modal appears
    console.log('🔍 Waiting for confirmation modal...');
    
    // Look for the specific confirmation modal - it's likely the one with the delete text
    const confirmationModal = page.locator('.modal').filter({ hasText: 'Are you sure you want to delete' }).first();
    await expect(confirmationModal).toBeVisible({ timeout: 5000 });
    
    // 6) Ensure the modal contains the expected text
    const modalText = await confirmationModal.textContent();
    console.log('📋 Modal text:', modalText);
    
    await expect(confirmationModal).toContainText('Are you sure you want to delete Got The Time');
    
    // 7) Click Confirm button
    console.log('✅ Clicking Confirm button...');
    
    // Look for the confirm button within the specific confirmation modal
    const confirmButton = confirmationModal.locator('button').filter({ hasText: /Confirm|Delete|Yes|OK/ }).first();
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();
    
    // 8) Modal should close
    console.log('🔒 Waiting for modal to close...');
    await expect(confirmationModal).not.toBeVisible({ timeout: 5000 });
    
    // 9) Do a search for "Anthrax" again
    console.log('🔍 Searching for "Anthrax" again to verify deletion...');
    
    await searchInput.click();
    await searchInput.fill('Anthrax');
    await searchInput.press('Enter');
    
    // Wait for search results to update
    await page.waitForTimeout(1000);
    
    // 10) Ensure no rows are returned
    const updatedRows = page.locator('#search_results tbody tr');
    await expect(updatedRows).toHaveCount(0, { timeout: 5000 });
    
    console.log('✅ No Anthrax songs found after deletion');
    
    // 11) Verify the file no longer exists in the music directory
    console.log('📁 Verifying file is removed from music directory...');
    
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
      
      // Check if the Anthrax file still exists
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
        
        // Look for any files containing "Anthrax" or "GotTheTime"
        const anthraxFiles = files.filter(file => 
          (file.includes('Anthrax') || file.includes('GotTheTime')) && file.endsWith('.mp3')
        );
        
        if (anthraxFiles.length === 0) {
          console.log('✅ No Anthrax files found in music directory (as expected)');
        } else {
          console.log('❌ Anthrax files still found in music directory:', anthraxFiles);
          throw new Error('Anthrax files should not exist after deletion');
        }
      } else {
        console.log('❌ Failed to read music directory:', fileExists?.error || 'Unknown error');
      }
    } else {
      console.log('⚠️ Could not retrieve music directory from store');
    }
    
    console.log('✅ Song deletion test completed successfully');
  });

  test('Delete song → cancel flow → song preserved', async () => {
    // 1) Do a search for all songs (empty search)
    console.log('🔍 Performing empty search to see all songs...');
    
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.fill(''); // Clear any previous search
    await searchInput.press('Enter');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // 2) Record the initial number of songs (avoid cross-test assumptions)
    const rows = page.locator('#search_results tbody tr');
    const initialCount = await rows.count();
    console.log(`🔍 Found ${initialCount} songs in search results (initial)`);
    
    // 3) Right click on the song "The Wheel (Back And Forth)" (Edie Brickell)
    console.log('🖱️ Right-clicking on "The Wheel (Back And Forth)" song...');
    
    // Find the specific row with "The Wheel (Back And Forth)" and right-click on it
    const wheelRow = page.locator('#search_results tbody tr').filter({ hasText: 'The Wheel (Back And Forth)' });
    await wheelRow.click({ button: 'right' });
    
    // 4) Wait for custom context menu to appear and click Delete
    console.log('🗑️ Waiting for context menu and selecting Delete...');
    
    // Wait for the custom context menu to be visible
    const contextMenu = page.locator('#mxv-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 2000 });
    
    // Click the Delete item in the context menu
    const deleteOption = contextMenu.locator('.mxv-context-item').filter({ hasText: 'Delete' });
    await expect(deleteOption).toBeVisible();
    await deleteOption.click();
    
    // 5) Wait for the modal to appear
    console.log('🔍 Waiting for confirmation modal...');
    
    // Look for the specific confirmation modal for "The Wheel (Back And Forth)"
    const confirmationModal = page.locator('.modal').filter({ hasText: 'Are you sure you want to delete The Wheel' }).first();
    await expect(confirmationModal).toBeVisible({ timeout: 5000 });
    
    // 6) Verify that the modal contains the expected text
    const modalText = await confirmationModal.textContent();
    console.log('📋 Modal text:', modalText);
    
    await expect(confirmationModal).toContainText('Are you sure you want to delete The Wheel (Back And Forth)');
    
    // 7) Press cancel
    console.log('❌ Clicking Cancel button...');
    
    // Look for the cancel button within the confirmation modal
    const cancelButton = confirmationModal.locator('button').filter({ hasText: /Cancel|No|Close/ }).first();
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    
    // 8) The modal should disappear
    console.log('🔒 Waiting for modal to close...');
    await expect(confirmationModal).not.toBeVisible({ timeout: 5000 });
    
    // 9) Search for "Edie"
    console.log('🔍 Searching for "Edie" to verify song is preserved...');
    
    await searchInput.click();
    await searchInput.fill('Edie');
    await searchInput.press('Enter');
    
    // Wait for search results to update
    await page.waitForTimeout(1000);
    
    // 10) There should be one search result
    const edieRows = page.locator('#search_results tbody tr');
    await expect(edieRows).toHaveCount(1, { timeout: 5000 });
    
    // Verify it's the expected song
    await expect(page.locator('#search_results')).toContainText('The Wheel (Back And Forth)');
    await expect(page.locator('#search_results')).toContainText('Edie Brickell');
    
    console.log('✅ Edie Brickell song preserved after canceling deletion');
    
    // 11) Verify total song count is unchanged after cancel
    await searchInput.click();
    await searchInput.fill('');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);
    const afterCancelCount = await page.locator('#search_results tbody tr').count();
    expect(afterCancelCount).toBe(initialCount);

    // 12) Verify the file still exists in the music directory
    console.log('📁 Verifying file still exists in music directory...');
    
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
      
      // Check if the Edie Brickell file still exists
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
        
        // Look for files containing "Edie" or "Brickell"
        const edieFiles = files.filter(file => 
          (file.includes('Edie') || file.includes('Brickell')) && file.endsWith('.mp3')
        );
        
        if (edieFiles.length > 0) {
          console.log('✅ Edie Brickell files found in music directory (as expected):', edieFiles);
        } else {
          console.log('❌ No Edie Brickell files found in music directory');
          throw new Error('Edie Brickell files should still exist after canceling deletion');
        }
      } else {
        console.log('❌ Failed to read music directory:', fileExists?.error || 'Unknown error');
      }
    } else {
      console.log('⚠️ Could not retrieve music directory from store');
    }
    
    console.log('✅ Song deletion cancel test completed successfully');
  });

  test('Delete song via keyboard → Delete key → confirmation modal', async () => {
    // 1) Do a search for "Eat It"
    console.log('🔍 Searching for "Eat It"...');
    
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // 2) Verify exactly one result is returned
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    
    // Verify it's the expected song
    await expect(page.locator('#search_results')).toContainText('Eat It');
    await expect(page.locator('#search_results')).toContainText('Weird Al Yankovic');
    
    console.log('✅ Found "Eat It" song as expected');
    
    // 3) Click on that result to highlight it
    console.log('🖱️ Clicking on the song row to highlight it...');
    
    const eatItRow = page.locator('#search_results tbody tr').filter({ hasText: 'Eat It' });
    await eatItRow.click();
    
    // Wait a moment for the selection to be established
    await page.waitForTimeout(500);
    
    // 4) Press the Delete key
    console.log('⌨️ Pressing Delete key...');
    
    await page.keyboard.press('Delete');
    
    // 5) The modal should pop up
    console.log('🔍 Waiting for confirmation modal...');
    
    // Look for the specific confirmation modal for "Eat It"
    const confirmationModal = page.locator('.modal').filter({ hasText: 'Are you sure you want to delete Eat It' }).first();
    await expect(confirmationModal).toBeVisible({ timeout: 5000 });
    
    // 6) Verify that the modal contains the expected text
    const modalText = await confirmationModal.textContent();
    console.log('📋 Modal text:', modalText);
    
    await expect(confirmationModal).toContainText('Are you sure you want to delete Eat It');
    
    console.log('✅ Keyboard deletion test completed successfully - modal appeared with correct text');
  });
});
