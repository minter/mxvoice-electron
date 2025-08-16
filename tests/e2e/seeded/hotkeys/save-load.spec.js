import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('Hotkeys - save & load', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'hotkeys'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('placeholder - open hotkeys tab', async () => {
    await expect(page.locator('#hotkeys-column')).toBeVisible();
  });
});


