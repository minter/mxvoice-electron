import { test, expect } from '@playwright/test';

test.describe('Holding Tank Basic Functionality', () => {
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
    
    // Wait for the holding tank to be visible
    // This will wait for the app to be ready
    await page.waitForSelector('#holding_tank', { timeout: 30000 });
  });

  test('should display holding tank UI elements', async ({ page }) => {
    // Test that key UI elements are visible
    await expect(page.locator('#holding_tank_column')).toBeVisible();
    await expect(page.locator('#holding_tank')).toBeVisible();
    
    // Test mode toggle buttons
    await expect(page.locator('#storage_mode_btn')).toBeVisible();
    await expect(page.locator('#playlist_mode_btn')).toBeVisible();
    
    // Test icon bar
    await expect(page.locator('.icon-bar')).toBeVisible();
  });

  test('should handle mode switching between storage and playlist', async ({ page }) => {
    const storageBtn = page.locator('#storage_mode_btn');
    const playlistBtn = page.locator('#playlist_mode_btn');
    
    // Initial state - storage mode should be active
    await expect(storageBtn).toHaveClass(/active/);
    await expect(playlistBtn).not.toHaveClass(/active/);
    
    // Click playlist mode
    await playlistBtn.click();
    
    // Verify state change
    await expect(playlistBtn).toHaveClass(/active/);
    await expect(storageBtn).not.toHaveClass(/active/);
    
    // Switch back to storage mode
    await storageBtn.click();
    await expect(storageBtn).toHaveClass(/active/);
    await expect(playlistBtn).not.toHaveClass(/active/);
  });

  test('should display holding tank tabs', async ({ page }) => {
    // Test that all tabs are present
    const tabs = page.locator('#holding_tank_tabs .nav-link');
    await expect(tabs).toHaveCount(5);
    
    // Test tab navigation
    await page.click('text=2');
    await expect(page.locator('#holding_tank_2')).toHaveClass(/active/);
    
    await page.click('text=3');
    await expect(page.locator('#holding_tank_3')).toHaveClass(/active/);
    
    await page.click('text=1');
    await expect(page.locator('#holding_tank_1')).toHaveClass(/active/);
  });

  test('should have test data loaded from test environment', async ({ page }) => {
    // Verify that our test environment has data
    const dbStats = await testEnv.getDatabaseStats();
    expect(dbStats.songs).toBeGreaterThan(0);
    expect(dbStats.categories).toBeGreaterThan(0);
    
    console.log(`📊 Test database contains ${dbStats.songs} songs and ${dbStats.categories} categories`);
  });

  test('should maintain test isolation between tests', async ({ page }) => {
    // This test should run with a clean, reset test environment
    const dbStats = await testEnv.getDatabaseStats();
    
    // Should have the default test data
    expect(dbStats.songs).toBe(5); // 5 test songs from our config
    expect(dbStats.categories).toBe(5); // 5 test categories from our config
    
    console.log('✅ Test isolation verified - database has expected test data');
  });
});
