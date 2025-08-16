import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, performEmptySearch } from '../../../utils/seeded-launch.js';
import { TEST_CONFIG } from '../../../config/test-environment.js';

test.describe('Search - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'search'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('returns seeded songs on empty search', async () => {
    await performEmptySearch(page);
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(TEST_CONFIG.schema.songs.length, { timeout: 5000 });
  });
});


