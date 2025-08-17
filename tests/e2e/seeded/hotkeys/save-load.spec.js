import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('Hotkeys - save & load', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for hotkeys tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'hotkeys'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('placeholder - open hotkeys tab', async () => {
    await expect(page.locator('#hotkeys-column')).toBeVisible();
  });
});


