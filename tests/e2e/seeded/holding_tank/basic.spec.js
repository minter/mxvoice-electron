import { _electron as electron, test, expect } from '@playwright/test';

import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('Holding Tank - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before this suite
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for holding tank tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

    ({ app, page } = await launchSeededApp(electron, 'holding-tank'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('placeholder - holding tank column renders', async () => {
    await page.waitForLoadState('domcontentloaded');
    // Prefer stable IDs if present; fallback to a loose header text
    const byId = page.locator('#holding_tank_column, #holding-tank, #storage_mode_btn');
    if (await byId.count()) {
      await expect(byId.first()).toBeVisible();
    } else {
      // Be explicit to avoid strict-mode multi-match; anchor whole word if present
      const candidate = page.getByText(/^Holding$/).first();
      await expect(candidate).toBeVisible();
    }
  });
});


