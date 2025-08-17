import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('Categories - management', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for categories tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'categories'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('placeholder - categories modal is present in DOM', async () => {
    const count = await page.locator('#categoryManagementModal').count();
    expect(count).toBeGreaterThan(0);
  });
});


