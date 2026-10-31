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
  test('categories stay on one line (ellipsis, full name on hover); the first column clears the selection bar', async () => {
    await searchAll();
    const tag = await page.locator('#search_results tbody .category-tag').first().evaluate((el) => ({
      wrap: getComputedStyle(el).whiteSpace,
      overflow: getComputedStyle(el).textOverflow,
      tooltip: el.title,
      text: el.textContent,
      pad: parseFloat(getComputedStyle(el.closest('td')).paddingLeft)
    }));
    expect(tag.wrap).toBe('nowrap');
    expect(tag.overflow).toBe('ellipsis');
    expect(tag.tooltip).toBe(tag.text);
    expect(tag.pad).toBeGreaterThanOrEqual(10);
  });

  test('titles are never cut off: no line clamp', async () => {
    await searchAll();
    const clamp = await page.locator('#search_results tbody .song-title-text').first()
      .evaluate((el) => getComputedStyle(el).webkitLineClamp);
    expect(clamp).toBe('none');
  });

  test('the focused search field gets a tight ring, not a 4px glow', async () => {
    await page.locator('#omni_search').focus();
    const shadow = await page.locator('#omni_search').evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).toContain('inset');
    expect(shadow).not.toContain('0px 0px 0px 4px');
  });

  test('the column headings stay put while results scroll, and the panel header never shrinks', async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1200, 560));
    await page.locator('#reset_button').click();
    const headerBefore = await page.locator('#search-column .card-header').evaluate((el) => el.getBoundingClientRect().height);
    await page.locator('#omni_search').fill('e');
    await page.locator('#omni_search').press('Enter');
    await expect(page.locator('#search_results tbody tr').first()).toBeVisible();
    // The seeded library is small: copies of the rows make the list long, as
    // a big library's would be (this is about layout only)
    await page.evaluate(() => {
      const tbody = document.querySelector('#search_results tbody');
      const rows = [...tbody.children];
      for (let i = 0; i < 8; i++) rows.forEach((tr) => tbody.appendChild(tr.cloneNode(true)));
    });

    const scrolled = await page.evaluate(() => {
      const wrap = document.querySelector('#search_results').closest('.my-custom-scrollbar');
      const canScroll = wrap.scrollHeight > wrap.clientHeight + 20;
      wrap.scrollTop = 200;
      return { canScroll, wrapTop: wrap.getBoundingClientRect().top, headTop: document.querySelector('#search_results thead th').getBoundingClientRect().top };
    });
    expect(scrolled.canScroll).toBe(true);
    expect(Math.abs(scrolled.headTop - scrolled.wrapTop)).toBeLessThanOrEqual(1);

    const headerAfter = await page.locator('#search-column .card-header').evaluate((el) => el.getBoundingClientRect().height);
    expect(headerAfter).toBe(headerBefore);
    await page.locator('#reset_button').click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1200, 800));
  });
});
