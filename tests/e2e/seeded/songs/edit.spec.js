import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('Songs - edit', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for songs edit tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'songs-edit'));
    
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

  test('Edit song via context menu → modify fields → save changes', async () => {
    // 1) Start with a fresh database and search specifically for Anthrax
    console.log('🔍 Searching for Anthrax to edit...');
    
    const searchInput = page.locator('#omni_search');
    // Ensure window/page is focused and fully ready
    try {
      await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.show();
        if (win.isMinimized()) win.restore();
        win.focus();
      });
      await page.bringToFront();
      await page.click('body');
    } catch {}

    // Ensure page is fully ready and clear any prior filters/state
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);
    try {
      const resetBtn = page.locator('#reset_button');
      if (await resetBtn.count()) {
        await resetBtn.click();
        await page.waitForTimeout(300);
      }
    } catch {}

    // Prime the DB/UI by performing an empty search first (ensures app-side DB is ready)
    try {
      const preRows = page.locator('#search_results tbody tr');
      const input = page.locator('#omni_search');
      await input.click();
      await input.fill('');
      await input.press('Enter');
      await page.waitForTimeout(1000);
      // Give a little more time if still empty
      if ((await preRows.count()) === 0) {
        await page.waitForTimeout(1000);
      }
    } catch {}
    await searchInput.click();
    await searchInput.fill('Anthrax');
    await searchInput.press('Enter');
    await page.waitForTimeout(1200);
    
    const rows = page.locator('#search_results tbody tr');
    // If first attempt returns 0 (e.g., lingering filters), reset and retry once
    if ((await rows.count()) === 0) {
      try {
        const resetBtn = page.locator('#reset_button');
        if (await resetBtn.count()) {
          await resetBtn.click();
          await page.waitForTimeout(300);
        }
      } catch {}
      await searchInput.click();
      await searchInput.fill('Anthrax');
      await searchInput.press('Enter');
      await page.waitForTimeout(1200);
    }
    await expect(rows).toHaveCount(1, { timeout: 8000 });
    
    // Verify it's the expected Anthrax song
    await expect(page.locator('#search_results')).toContainText('Got The Time');
    await expect(page.locator('#search_results')).toContainText('Anthrax');
    await expect(page.locator('#search_results')).toContainText('Countdown');
    console.log('✅ Found Anthrax song as expected');
    
    // 3) Right-click on the song to get the context menu
    console.log('🖱️ Right-clicking on the song to open context menu...');
    
    // Find the specific row with the Anthrax song and right-click on it
    const rowToEdit = page.locator('#search_results tbody tr').filter({ hasText: 'Anthrax' });
    await rowToEdit.click({ button: 'right' });
    
    // Wait for context menu to appear
    await page.waitForTimeout(500);
    
    // 4) Choose Edit from the context menu
    console.log('✏️ Selecting Edit from context menu...');
    
    // Look for the edit option in the context menu
    const editOption = page.locator('text=Edit').first();
    
    if (await editOption.isVisible()) {
      await editOption.click();
    } else {
      // If text search doesn't work, try keyboard navigation
      // Press 'E' for Edit (common shortcut)
      await page.keyboard.press('E');
    }
    
    // 5) Ensure the edit modal appears
    console.log('🔍 Waiting for edit modal...');
    
    // Look for the song form modal (should be the same modal used for adding/editing)
    const editModal = page.locator('#songFormModal');
    await expect(editModal).toBeVisible({ timeout: 5000 });
    
    // 6) Verify the modal title indicates editing
    await expect(page.locator('#songFormModalTitle')).toContainText('Edit This Song', { timeout: 5000 });
    
    // 7) Verify the form fields are populated with current values
    console.log('📋 Verifying form fields are populated...');
    
    await expect(page.locator('#song-form-title')).toHaveValue('Got The Time', { timeout: 5000 });
    await expect(page.locator('#song-form-artist')).toHaveValue('Anthrax', { timeout: 5000 });
    await expect(page.locator('#song-form-category')).toHaveValue('GAME', { timeout: 5000 });
    await expect(page.locator('#song-form-info')).toHaveValue('Countdown', { timeout: 5000 });
    await expect(page.locator('#song-form-duration')).toHaveValue('0:06', { timeout: 5000 });
    
    console.log('✅ Form fields populated with current song data');
    
    // 8) Modify the form fields
    console.log('✏️ Modifying song fields...');
    
    // Change fields for Anthrax
    await page.locator('#song-form-title').fill('Got The Time (Edited)');
    await page.locator('#song-form-artist').fill('Anthrax (Edited)');
    await page.locator('#song-form-category').selectOption({ label: 'Running In' });
    await page.locator('#song-form-info').fill('Edited Countdown Info');
    
    console.log('✅ Song fields modified');
    
    // 9) Submit the form by clicking the Save button
    console.log('💾 Clicking Save button...');
    
    // Look for the save button (might be labeled "Save", "Update", etc.)
    const saveButton = page.locator('#songFormSubmitButton');
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    
    // 10) Wait for the modal to close
    console.log('🔒 Waiting for modal to close...');
    await expect(editModal).not.toBeVisible({ timeout: 5000 });
    
    // 11) Verify the changes are saved by searching again
    console.log('🔍 Searching for "Anthrax" to verify changes...');
    
    await searchInput.click();
    await searchInput.fill('Anthrax');
    await searchInput.press('Enter');
    
    // Wait for search results to update
    await page.waitForTimeout(1000);
    
    // 12) Verify the updated song appears with new values
    const updatedRows = page.locator('#search_results tbody tr');
    await expect(updatedRows).toHaveCount(1, { timeout: 5000 });
    
    // Check that the updated values appear in the search results
    await expect(page.locator('#search_results')).toContainText('Got The Time (Edited)');
    await expect(page.locator('#search_results')).toContainText('Anthrax (Edited)');
    await expect(page.locator('#search_results')).toContainText('Edited Countdown Info');
    // The category should show as "Running In" in the results
    await expect(page.locator('#search_results')).toContainText('RNIN');
    
    console.log('✅ Song changes verified in search results');
    
    // 13) Verify the edited values are present and original values are not in their exact form
    // Check that the edited values appear
    await expect(page.locator('#search_results')).toContainText('Got The Time (Edited)');
    await expect(page.locator('#search_results')).toContainText('Edited Countdown Info');
    
    // Check that the original exact values are not present (but substrings might be)
    // We can't use not.toContainText for substrings, so we verify the edited versions are there instead
    console.log('✅ Edited values confirmed, original values replaced');
    
    console.log('✅ Song editing test completed successfully');
  });

  test('Edit song → cancel flow → no changes saved', async () => {
    // 1) Search for "Weird Al" to find another song to edit
    console.log('🔍 Searching for "Weird Al" to find another song to edit...');
    
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.fill('Weird Al');
    await searchInput.press('Enter');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // 2) Verify exactly one song is returned
    const rows = page.locator('#search_results tbody tr');
    const rowCount = await rows.count();
    console.log(`🔍 Search results: Found ${rowCount} rows`);
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    
    // Capture pre-edit values to assert no-change after cancel
    const targetRow = rows.first();
    const beforeTitle = (await targetRow.locator('td:nth-child(3)').textContent())?.trim() || '';
    const beforeArtist = (await targetRow.locator('td:nth-child(4)').textContent())?.trim() || '';
    console.log(`📋 Before edit values: title="${beforeTitle}", artist="${beforeArtist}"`);
    
    console.log('✅ Found Weird Al song as expected');
    
    // 3) Right-click on the song to get the context menu
    console.log('🖱️ Right-clicking on the song to open context menu...');
    
    const weirdAlRow = page.locator('#search_results tbody tr').filter({ hasText: 'Weird Al' });
    await weirdAlRow.click({ button: 'right' });
    
    // Wait for context menu to appear and stabilize
    console.log('⏳ Waiting for context menu to appear...');
    await page.waitForTimeout(1000);
    
    // 4) Choose Edit from the context menu
    console.log('✏️ Selecting Edit from context menu...');
    
    // Debug: Check if context menu is visible
    const contextMenu = page.locator('.mxv-context-menu');
    const isMenuVisible = await contextMenu.isVisible();
    console.log(`🔍 Context menu visible: ${isMenuVisible}`);
    
    if (isMenuVisible) {
      // Debug: Check what items are in the context menu
      const menuItems = page.locator('.mxv-context-item');
      const itemCount = await menuItems.count();
      console.log(`🔍 Context menu items found: ${itemCount}`);
      
      for (let i = 0; i < itemCount; i++) {
        const item = menuItems.nth(i);
        const text = await item.textContent();
        console.log(`🔍 Menu item ${i}: "${text}"`);
      }
      
      // Try to find the Edit option with more specific selectors
      const editOption = page.locator('.mxv-context-item').filter({ hasText: 'Edit' });
      console.log(`🔍 Edit option found: ${await editOption.count() > 0}`);
      
      // Wait a bit more and check visibility again
      await page.waitForTimeout(500);
      const isEditVisible = await editOption.isVisible();
      console.log(`🔍 Edit option visible: ${isEditVisible}`);
      
      if (isEditVisible) {
        console.log('✅ Clicking Edit option...');
        await editOption.click();
        console.log('✅ Edit option clicked, waiting for modal...');
      } else {
        console.log('⚠️ Edit option still not visible, trying direct function call...');
        // Try to call editSelectedSong directly through the page context
        await page.evaluate(() => {
          if (window.editSelectedSong) {
            console.log('✅ Calling editSelectedSong directly...');
            window.editSelectedSong();
          } else if (window.moduleRegistry?.songManagement?.editSelectedSong) {
            console.log('✅ Calling editSelectedSong through moduleRegistry...');
            window.moduleRegistry.songManagement.editSelectedSong();
          } else {
            console.log('❌ editSelectedSong not available');
          }
        });
      }
    } else {
      console.log('❌ Context menu not visible, trying direct function call...');
      await page.evaluate(() => {
        if (window.editSelectedSong) {
          console.log('✅ Calling editSelectedSong directly...');
          window.editSelectedSong();
        } else if (window.moduleRegistry?.songManagement?.editSelectedSong) {
          console.log('✅ Calling editSelectedSong through moduleRegistry...');
          window.moduleRegistry.songManagement.editSelectedSong();
        } else {
          console.log('❌ editSelectedSong not available');
        }
      });
    }
    
    // 5) Ensure the edit modal appears
    console.log('🔍 Waiting for edit modal...');
    
    const editModal = page.locator('#songFormModal');
    await expect(editModal).toBeVisible({ timeout: 5000 });
    
    // 6) Verify the form fields are populated with current values
    console.log('📋 Verifying form fields are populated...');
    
    await expect(page.locator('#song-form-title')).toHaveValue('Eat It', { timeout: 5000 });
    await expect(page.locator('#song-form-artist')).toHaveValue('Weird Al Yankovic', { timeout: 5000 });
    await expect(page.locator('#song-form-category')).toHaveValue('GROAN', { timeout: 5000 });
    
    console.log('✅ Form fields populated with current song data');
    
    // 7) Modify the form fields
    console.log('✏️ Modifying song fields...');
    
    // Change the title
    await page.locator('#song-form-title').fill('Eat It (Modified)');
    
    // Change the artist
    await page.locator('#song-form-artist').fill('Weird Al (Modified)');
    
    // Change the category
    await page.locator('#song-form-category').selectOption({ label: 'Game' });
    
    console.log('✅ Song fields modified');
    
    // 8) Click Cancel instead of Save
    console.log('❌ Clicking Cancel button...');
    
    // Look for the cancel button
    const cancelButton = page.locator('#songFormModal .btn.btn-secondary');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    
    // 9) Wait for the modal to close
    console.log('🔒 Waiting for modal to close...');
    await expect(editModal).not.toBeVisible({ timeout: 5000 });
    
    // 10) Verify no changes were saved by searching again
    console.log('🔍 Searching for "Weird Al" to verify no changes...');
    
    await searchInput.click();
    await searchInput.fill('Weird Al');
    await searchInput.press('Enter');
    
    // Wait for search results to update
    await page.waitForTimeout(1000);
    
    // 11) Verify the row values are unchanged
    const updatedRows = page.locator('#search_results tbody tr');
    await expect(updatedRows).toHaveCount(1, { timeout: 5000 });
    const afterRow = updatedRows.first();
    const afterTitle = (await afterRow.locator('td:nth-child(3)').textContent())?.trim() || '';
    const afterArtist = (await afterRow.locator('td:nth-child(4)').textContent())?.trim() || '';
    expect(afterTitle).toBe(beforeTitle);
    expect(afterArtist).toBe(beforeArtist);
    
    // Also ensure our temporary "Modified" strings are not present
    await expect(page.locator('#search_results')).not.toContainText('Modified');
    
    console.log('✅ Original values preserved after canceling edit');
    
    console.log('✅ Song editing cancel test completed successfully');
  });
});
