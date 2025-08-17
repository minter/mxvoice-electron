import { _electron as electron, test, expect } from '@playwright/test';

// Seeded app launcher with per-suite isolation
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('UI - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before this suite
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for UI tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

    ({ app, page } = await launchSeededApp(electron, 'ui'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('placeholder - core UI elements render', async () => {
    await page.waitForLoadState('domcontentloaded');
    // Basic, stable elements across the app
    await expect(page.locator('#omni_search')).toBeVisible();
    // Search results table may render but be empty/hidden until search; check presence instead of visible
    await expect(page.locator('#search_results')).toHaveCount(1);
    await expect(page.locator('#play_button')).toBeVisible();
  });
});


