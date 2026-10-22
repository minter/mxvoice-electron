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
});
