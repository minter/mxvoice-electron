import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, performEmptySearch } from '../../../utils/seeded-launch.js';

test.describe('Playback - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for playback tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'playback'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('placeholder - can see controls', async () => {
    await expect(page.locator('#play_button')).toBeVisible();
    await expect(page.locator('#stop_button')).toBeVisible();
  });
});


