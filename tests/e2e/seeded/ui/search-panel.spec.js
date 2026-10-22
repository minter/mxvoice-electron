import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';

// Search panel (reskin-tier2.css): the title leads and the rest steps back,
// categories are quiet text, the clear ✕ sits inside the field.

test.describe('UI - search panel', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'search-panel'));
    await waitForAppReady(page, app);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  async function searchAll() {
    await page.locator('#reset_button').click();
    await page.locator('#omni_search').fill('e');
    await page.locator('#omni_search').press('Enter');
    await expect(page.locator('#search_results tbody tr').first()).toBeVisible();
  }

  test('the title leads; artist and time are muted, times right-aligned on even digits', async () => {
    await searchAll();
    const row = await page.locator('#search_results tbody tr').first().evaluate((tr) => {
      const css = (sel) => getComputedStyle(tr.querySelector(sel));
      return {
        title: css('td.song-title-cell').color,
        artist: css('td.song-artist-cell').color,
        time: css('td.song-time-cell').color,
        align: css('td.song-time-cell').textAlign,
        digits: css('td.song-time-cell').fontVariantNumeric,
        headAlign: getComputedStyle(document.querySelector('#search_results thead th:last-child')).textAlign
      };
    });
    expect(row.artist).not.toBe(row.title);
    expect(row.artist).toBe(row.time);
    expect(row.align).toBe('right');
    expect(row.headAlign).toBe('right');
    expect(row.digits).toContain('tabular-nums');
  });

  test('categories are plain text, and the column goes away when one category is picked', async () => {
    await searchAll();
    const tag = page.locator('#search_results tbody .category-tag').first();
    await expect(tag).toBeVisible();
    expect(await tag.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await expect(page.locator('#search_results thead th.hide-1')).toBeVisible();

    await page.locator('#category_select').selectOption({ label: 'Game' });
    await expect(page.locator('#search_results tbody tr')).toHaveCount(2, { timeout: 5000 });
    await expect(page.locator('#search_results thead th.hide-1')).toBeHidden();
    await expect(page.locator('#search_results tbody td.hide-1').first()).toBeHidden();

    await page.locator('#category_select').selectOption('*');
    await expect(page.locator('#search_results thead th.hide-1')).toBeVisible();
  });

  test('the clear ✕ sits inside the end of the field and still clears the search', async () => {
    await searchAll();
    const boxes = await page.evaluate(() => {
      const r = (sel) => document.querySelector(sel).getBoundingClientRect();
      return { field: r('#omni_search'), clear: r('#reset_button'), add: r('#advanced_search_button') };
    });
    expect(boxes.clear.left).toBeGreaterThanOrEqual(boxes.field.left);
    expect(boxes.clear.right).toBeLessThanOrEqual(boxes.field.right + 1);
    expect(boxes.add.left).toBeGreaterThanOrEqual(boxes.field.right - 1);
    expect(await page.locator('#reset_button').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');

    await page.locator('#reset_button').click();
    await expect(page.locator('#omni_search')).toHaveValue('');
    await expect(page.locator('#search_results tbody tr')).toHaveCount(0);
  });

  test('results start just below the field', async () => {
    await searchAll();
    const gap = await page.evaluate(() => document.querySelector('#search_results thead').getBoundingClientRect().top
      - document.querySelector('#search_form .input-group').getBoundingClientRect().bottom);
    expect(gap).toBeLessThanOrEqual(16);
  });
});
