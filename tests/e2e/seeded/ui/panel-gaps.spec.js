import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';

// The window background shows between the panels (and carries the show color),
// so every outer edge and every gap between panels must be the same width.

async function measureGaps(page) {
  return page.evaluate(() => {
    const box = (sel) => document.querySelector(sel).getBoundingClientRect();
    const frame = box('.container-fluid');
    const tank = box('#holding-tank-column');
    const search = box('#search-column');
    const hotkeys = box('#hotkeys-column');
    const player = box('#player-panel');
    const topBottom = Math.max(tank.bottom, search.bottom, hotkeys.bottom);
    return {
      top: tank.top - frame.top,
      left: tank.left - frame.left,
      right: frame.right - hotkeys.right,
      tankToSearch: search.left - tank.right,
      searchToHotkeys: hotkeys.left - search.right,
      topRowToPlayer: player.top - topBottom,
      playerLeft: player.left - frame.left,
      playerRight: frame.right - player.right,
      bottom: frame.bottom - player.bottom,
      // Panels fill the row: all three top panels share one top and one bottom
      topsAligned: Math.max(tank.top, search.top, hotkeys.top) - Math.min(tank.top, search.top, hotkeys.top),
      bottomsAligned: topBottom - Math.min(tank.bottom, search.bottom, hotkeys.bottom),
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight
        || document.documentElement.scrollWidth > window.innerWidth,
      // macOS draws the traffic lights over a title strip at the top instead of a gap
      titleStrip: document.body.classList.contains('platform-mac')
    };
  });
}

function expectEvenGaps(gaps) {
  const { topsAligned, bottomsAligned, pageScrolls, titleStrip, ...sides } = gaps;
  console.log('panel gaps', JSON.stringify(gaps));
  const { top, ...edges } = sides;
  // The macOS title strip (30px, reskin-tier2.css) stands in for the top gap
  expect(Math.abs(top - (titleStrip ? 30 : 12)), `top edge is ${top}px`).toBeLessThanOrEqual(1);
  const values = Object.values(edges);
  for (const [name, value] of Object.entries(edges)) {
    expect(Math.abs(value - 12), `${name} gap is ${value}px`).toBeLessThanOrEqual(1);
  }
  expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  expect(topsAligned).toBeLessThanOrEqual(1);
  expect(bottomsAligned).toBeLessThanOrEqual(1);
  expect(pageScrolls).toBe(false);
}

async function setWindowSize(app, page, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0].setSize(size.width, size.height);
  }, { width, height });
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBeLessThanOrEqual(width);
  // Let layout settle after the resize event
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test.describe('UI - panel gaps', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'panel-gaps'));
    await waitForAppReady(page, app);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('outer edges and gaps between panels are equal at the default window size', async () => {
    expectEvenGaps(await measureGaps(page));
  });

  test('outer edges and gaps between panels stay equal in a narrower window', async () => {
    await setWindowSize(app, page, 1100, 800);
    expectEvenGaps(await measureGaps(page));
  });
});
