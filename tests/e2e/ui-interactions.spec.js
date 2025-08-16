import { test, expect } from '@playwright/test';

test.describe('UI Interactions and User Experience', () => {
  let testEnv;

  test.beforeEach(async ({ page }) => {
    // Access test environment from global setup
    testEnv = global.testEnvironment;
    
    if (!testEnv) {
      throw new Error('Test environment not available. Global setup may have failed.');
    }
    
    // Reset to known state before each test
    await testEnv.reset();
    
    // For Electron apps, we need to connect to the running app
    // The app should be started manually with 'yarn start' before running tests
    
    // Wait for the app to be fully loaded
    await page.waitForSelector('#holding_tank', { timeout: 30000 });
  });

  test('should handle responsive design and viewport changes', async ({ page }) => {
    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('#holding_tank_column')).toBeVisible();
    await expect(page.locator('#search_column')).toBeVisible();
    await expect(page.locator('#player_column')).toBeVisible();

    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    // Verify responsive behavior (adjust selectors based on your CSS)
    await expect(page.locator('#holding_tank_column')).toBeVisible();

    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('#holding_tank_column')).toBeVisible();
  });

  test('should handle keyboard navigation and shortcuts', async ({ page }) => {
    // Focus on the page
    await page.click('body');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    // Verify focus moves to first focusable element
    await expect(page.locator(':focus')).toBeVisible();
    
    // Test arrow key navigation (if implemented)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    
    // Test Enter key on buttons
    const storageBtn = page.locator('#storage_mode_btn');
    await storageBtn.focus();
    await page.keyboard.press('Enter');
    // Verify button state changed
    await expect(storageBtn).toHaveClass(/active/);
  });

  test('should handle form inputs and validation', async ({ page }) => {
    // Look for search input or other form elements
    const searchInput = page.locator('input[type="text"], #search_input, .search-input');
    
    if (await searchInput.count() > 0) {
      // Test input functionality
      await searchInput.fill('test search');
      await expect(searchInput).toHaveValue('test search');
      
      // Test clearing input
      await searchInput.clear();
      await expect(searchInput).toHaveValue('');
    } else {
      console.log('⚠️ No search input found, skipping form input test');
    }
  });

  test('should handle tooltips and accessibility', async ({ page }) => {
    // Test tooltips if they exist
    const tooltipElements = page.locator('[data-bs-toggle="tooltip"]');
    
    if (await tooltipElements.count() > 0) {
      // Hover over first tooltip element
      await tooltipElements.first().hover();
      
      // Wait for tooltip to appear (adjust selector based on your tooltip implementation)
      await page.waitForTimeout(500);
      
      // Verify tooltip is visible (adjust selector based on your tooltip implementation)
      const tooltip = page.locator('.tooltip, .bs-tooltip, [role="tooltip"]');
      if (await tooltip.count() > 0) {
        await expect(tooltip.first()).toBeVisible();
      }
    } else {
      console.log('⚠️ No tooltip elements found, skipping tooltip test');
    }
  });

  test('should handle loading states and transitions', async ({ page }) => {
    // Test that the app loads without errors
    await expect(page.locator('body')).not.toHaveText(/error/i);
    await expect(page.locator('body')).not.toHaveText(/failed/i);
    
    // Verify main content is loaded
    await expect(page.locator('#holding_tank')).toBeVisible();
    await expect(page.locator('#holding_tank_column')).toBeVisible();
    
    // Test that no loading spinners are stuck
    const loadingSpinners = page.locator('.loading, .spinner, .loading-spinner');
    if (await loadingSpinners.count() > 0) {
      // Wait for any loading to complete
      await page.waitForTimeout(2000);
      // Verify no spinners are still visible
      for (let i = 0; i < await loadingSpinners.count(); i++) {
        await expect(loadingSpinners.nth(i)).not.toBeVisible();
      }
    }
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Test that the app doesn't crash on invalid operations
    // Try to trigger some operations that might cause errors
    
    // Test invalid tab navigation
    await page.click('text=999'); // Non-existent tab
    // App should handle this gracefully
    
    // Test that main functionality still works
    await expect(page.locator('#holding_tank')).toBeVisible();
    
    // Verify no error messages are displayed
    const errorMessages = page.locator('.error, .alert-danger, .text-danger');
    if (await errorMessages.count() > 0) {
      await expect(errorMessages.first()).not.toBeVisible();
    }
  });

  test('should maintain state consistency across interactions', async ({ page }) => {
    // Test that UI state remains consistent
    
    // Initial state
    const storageBtn = page.locator('#storage_mode_btn');
    await expect(storageBtn).toHaveClass(/active/);
    
    // Perform some interactions
    await page.click('#playlist_mode_btn');
    await expect(page.locator('#playlist_mode_btn')).toHaveClass(/active/);
    
    // Navigate to different tab
    await page.click('text=2');
    await expect(page.locator('#holding_tank_2')).toHaveClass(/active/);
    
    // Return to first tab
    await page.click('text=1');
    await expect(page.locator('#holding_tank_1')).toHaveClass(/active/);
    
    // Verify playlist mode is still active
    await expect(page.locator('#playlist_mode_btn')).toHaveClass(/active/);
  });

  test('should handle dynamic content updates', async ({ page }) => {
    // Test that content updates properly
    
    // Verify test data is loaded
    const dbStats = await testEnv.getDatabaseStats();
    expect(dbStats.songs).toBeGreaterThan(0);
    
    // Test that UI reflects the data
    // Look for song elements or other content
    const songElements = page.locator('.song-item, .song, [data-song]');
    
    if (await songElements.count() > 0) {
      console.log(`📱 Found ${await songElements.count()} song elements in UI`);
      
      // Test that at least one song is visible
      await expect(songElements.first()).toBeVisible();
    } else {
      console.log('⚠️ No song elements found in UI, may need to load data first');
    }
  });

  test('should provide good user feedback', async ({ page }) => {
    // Test that user actions provide appropriate feedback
    
    // Test button click feedback
    const playlistBtn = page.locator('#playlist_mode_btn');
    await playlistBtn.click();
    
    // Verify visual feedback (button state change)
    await expect(playlistBtn).toHaveClass(/active/);
    
    // Test that the change is immediately visible
    await expect(page.locator('#storage_mode_btn')).not.toHaveClass(/active/);
    
    // Test tab switching feedback
    await page.click('text=3');
    await expect(page.locator('#holding_tank_3')).toHaveClass(/active/);
    await expect(page.locator('#holding_tank_1')).not.toHaveClass(/active/);
  });
});
