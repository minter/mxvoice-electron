import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';

// Song rows (ui/song-label.js + reskin.css): title over artist with the time on
// the right. The joining words stay in the text but must never be drawn, and
// all twelve hotkey slots must fit the default window.

const ALL_KEYS = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i + 1}`, String(1001 + (i % 5))]));

async function applyLayout(page) {
  return page.evaluate((hotkeys) => window.__showsTest.applyLayout({
    hotkeys: [{ tabNumber: 1, hotkeys }],
    holdingTank: [{ tabNumber: 1, songIds: ['1004', '1001'] }]
  }), ALL_KEYS);
}

// The content area, not the outer window: on Windows the outer size includes
// the title and menu bars, so the same numbers mean the same page everywhere
async function setContentSize(app, page, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test.describe('UI - song rows', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'song-rows'));
    await waitForAppReady(page, app);
    await applyLayout(page);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('a hotkey slot and a holding tank row draw title, artist and time, never the joining words', async () => {
    const hotkey = page.locator('#hotkeys_list_1 #f4_hotkey span.song');
    const tankRow = page.locator('#holding_tank_1 li[songid="1004"]');
    // The text still reads as before, for anything that reads it
    await expect(hotkey).toHaveText('We Are Family by Sister Sledge (0:07)');
    await expect(tankRow).toHaveText('We Are Family by Sister Sledge (0:07)');

    for (const row of [hotkey, tankRow]) {
      const drawn = await row.evaluate((el) => ({
        text: el.innerText,
        separatorsShown: [...el.querySelectorAll('.song-label-sep')].filter((sep) => getComputedStyle(sep).display !== 'none').length,
        titleWidth: el.querySelector('.song-label-title').getBoundingClientRect().width,
        titleTop: el.querySelector('.song-label-title').getBoundingClientRect().top,
        artistTop: el.querySelector('.song-label-artist').getBoundingClientRect().top
      }));
      expect(drawn.separatorsShown).toBe(0);
      expect(drawn.text).not.toContain(' by ');
      expect(drawn.text).not.toContain('(');
      // Title and artist on their own lines, the title not squeezed
      expect(drawn.artistTop).toBeGreaterThan(drawn.titleTop);
      expect(drawn.titleWidth).toBeGreaterThan(80);
    }
  });

  test('all twelve hotkey slots fit a 1200×800 page without scrolling', async () => {
    await setContentSize(app, page, 1200, 800);
    const fit = await page.evaluate(() => {
      const column = document.querySelector('#hotkeys-column').getBoundingClientRect();
      const f12 = document.querySelector('#hotkeys_list_1 #f12_hotkey').getBoundingClientRect();
      const slots = [...document.querySelectorAll('#hotkeys_list_1 > li')].map((li) => Math.round(li.getBoundingClientRect().height));
      return { columnBottom: column.bottom, f12Bottom: f12.bottom, slots };
    });
    expect(fit.f12Bottom).toBeLessThanOrEqual(fit.columnBottom);
    // Empty and loaded slots are the same height
    expect(new Set(fit.slots).size).toBe(1);
  });
  test('the twelve slots share the column height at any window size, all the same height', async () => {
    for (const [width, height] of [[1200, 800], [1400, 1000], [1600, 1300]]) {
      await setContentSize(app, page, width, height);
      const fit = await page.evaluate(() => {
        const body = document.querySelector('#hotkeys-column .card-body');
        const slots = [...document.querySelectorAll('#hotkeys_list_1 > li')].map((li) => li.getBoundingClientRect());
        const box = body.getBoundingClientRect();
        return {
          heights: slots.map((r) => Math.round(r.height)),
          // What's left under F12, inside the column
          spare: box.bottom - slots.at(-1).bottom,
          scrolls: body.scrollHeight > body.clientHeight + 1
        };
      });
      expect(fit.scrolls).toBe(false);
      expect(new Set(fit.heights).size).toBe(1);
      // F12 ends at the bottom of the column, not partway down it
      expect(fit.spare).toBeLessThan(24);
    }
    await setContentSize(app, page, 1200, 800);
  });

  test('a short window scrolls the slots instead of squashing them', async () => {
    await setContentSize(app, page, 1200, 560);
    const fit = await page.evaluate(() => {
      const body = document.querySelector('#hotkeys-column .card-body');
      return {
        scrolls: body.scrollHeight > body.clientHeight + 1,
        heights: [...document.querySelectorAll('#hotkeys_list_1 > li')].map((li) => Math.round(li.getBoundingClientRect().height))
      };
    });
    expect(fit.scrolls).toBe(true);
    expect(Math.min(...fit.heights)).toBeGreaterThanOrEqual(40);
    expect(new Set(fit.heights).size).toBe(1);
    await setContentSize(app, page, 1200, 800);
  });

  test('View > Increase / Decrease Font Size scale search rows, hotkeys and the holding tank', async () => {
    const sizes = () => page.evaluate(() => {
      const px = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
      return {
        search: px('#search_results tbody tr'),
        hotkey: px('#hotkeys_list_1 #f4_hotkey span.song .song-label-title'),
        tank: px('#holding_tank_1 li[songid="1004"] .song-label-title')
      };
    });
    const menu = (channel) => app.evaluate(({ BrowserWindow }, name) => {
      BrowserWindow.getAllWindows()[0].webContents.send(name);
    }, channel);

    await page.locator('#omni_search').fill('a');
    await page.locator('#omni_search').press('Enter');
    await expect(page.locator('#search_results tbody tr').first()).toBeVisible();
    const before = await sizes();

    await menu('increase_font_size');
    await menu('increase_font_size');
    await expect.poll(async () => (await sizes()).search).toBe(before.search + 2);
    const bigger = await sizes();
    // Empty and loaded slots still match at the bigger size
    const slotHeights = await page.evaluate(() => [...document.querySelectorAll('#hotkeys_list_1 > li')].map((li) => Math.round(li.getBoundingClientRect().height)));
    expect(new Set(slotHeights).size).toBe(1);
    expect(bigger.hotkey).toBeGreaterThan(before.hotkey);
    expect(bigger.tank).toBeGreaterThan(before.tank);
    await expect.poll(() => page.evaluate(async () => (await window.secureElectronAPI.profile.getPreference('font_size'))?.value)).toBe(before.search + 2);

    // Rows drawn after the change get the new size too
    await page.locator('#omni_search').fill('e');
    await page.locator('#omni_search').press('Enter');
    await expect.poll(async () => (await sizes()).search).toBe(before.search + 2);

    await menu('decrease_font_size');
    await menu('decrease_font_size');
    await expect.poll(async () => (await sizes()).search).toBe(before.search);
    expect((await sizes()).hotkey).toBe(before.hotkey);
  });

  test('dragging a song over a hotkey highlights the slot, and the holding tank opens a gap where it will land', async () => {
    const drag = (selector, type, where) => page.evaluate(({ selector, type, where }) => {
      const el = document.querySelector(selector);
      const box = el.getBoundingClientRect();
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', '1002');
      el.dispatchEvent(new DragEvent(type, {
        bubbles: true, cancelable: true, dataTransfer,
        clientX: box.left + 20, clientY: where === 'top' ? box.top + 3 : box.bottom - 3
      }));
    }, { selector, type, where });

    const slot = page.locator('#hotkeys_list_1 #f2_hotkey');
    await drag('#hotkeys_list_1 #f2_hotkey span.song', 'dragover', 'top');
    await expect(slot).toHaveClass(/drop_target/);
    // Dashed, unlike the playing slot's solid outline
    expect(await slot.evaluate((li) => getComputedStyle(li).outlineStyle)).toBe('dashed');
    // Crossing onto the slot's own label doesn't drop the highlight
    await slot.evaluate((li) => li.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: li.querySelector('span.song') })));
    await expect(slot).toHaveClass(/drop_target/);
    await slot.evaluate((li) => li.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: document.body })));
    await expect(slot).not.toHaveClass(/drop_target/);

    // Lower half of the first row: the gap opens above the second row
    const first = '#holding_tank_1 li[songid="1004"]';
    const second = page.locator('#holding_tank_1 li[songid="1001"]');
    const gapBefore = await second.evaluate((li) => li.getBoundingClientRect().top - li.previousElementSibling.getBoundingClientRect().bottom);
    await drag(first, 'dragover', 'bottom');
    await expect(second).toHaveClass(/holding-tank-drop-above/);
    await expect(page.locator(first)).not.toHaveClass(/holding-tank-drop-below/);
    await expect.poll(() => second.evaluate((li) => li.getBoundingClientRect().top - li.previousElementSibling.getBoundingClientRect().bottom))
      .toBeGreaterThan(gapBefore + 20);

    // A drag that ends anywhere leaves no highlight behind
    await page.evaluate(() => document.dispatchEvent(new DragEvent('dragend', { bubbles: true })));
    await expect(page.locator('.holding-tank-drop-above, .holding-tank-drop-below, .drop_target')).toHaveCount(0);
  });
});
