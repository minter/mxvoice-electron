import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('Songs - add', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'songs'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('placeholder - page renders', async () => {
    await expect(page.locator('body')).not.toBeEmpty();
  });
});


