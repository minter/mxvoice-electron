import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';

// Panel headers and the player bar (reskin.css, reskin-tier2.css): one
// header height, labels that read, and a player that shows its state.

async function setContentSize(app, page, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test.describe('UI - panel headers and player bar', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'panel-chrome'));
    await waitForAppReady(page, app);
    await setContentSize(app, page, 1200, 800);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('all three panel headers are one height, so the tab rows line up', async () => {
    const heights = await page.evaluate(() => ['#holding-tank-column', '#search-column', '#hotkeys-column']
      .map((col) => Math.round(document.querySelector(`${col} .card-header`).getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBeGreaterThanOrEqual(44);
    expect(heights[0]).toBeLessThanOrEqual(52);
  });

  test('the Holding / Playlist toggle keeps its words at an ordinary window width', async () => {
    await expect(page.locator('#storage_mode_btn .mode-btn-text')).toBeVisible();
    await expect(page.locator('#playlist_mode_btn .mode-btn-text')).toBeVisible();
  });

  test('the profile name is no louder than the panel titles', async () => {
    const sizes = await page.evaluate(() => ({
      title: parseFloat(getComputedStyle(document.querySelector('#search-column .header-button')).fontSize),
      profile: parseFloat(getComputedStyle(document.querySelector('#profile-name')).fontSize)
    }));
    expect(sizes.profile).toBeLessThanOrEqual(sizes.title);
  });

  test('the player bar is compact, and time left is larger than time elapsed', async () => {
    const bar = await page.evaluate(() => ({
      height: document.getElementById('player-panel').getBoundingClientRect().height,
      elapsed: parseFloat(getComputedStyle(document.getElementById('timer')).fontSize),
      left: parseFloat(getComputedStyle(document.getElementById('duration')).fontSize),
      digits: getComputedStyle(document.getElementById('duration')).fontVariantNumeric
    }));
    expect(bar.height).toBeLessThanOrEqual(96);
    expect(bar.left).toBeGreaterThan(bar.elapsed);
    expect(bar.digits).toContain('tabular-nums');
  });

  test('idle play and stop are outlines that keep their color', async () => {
    const idle = await page.evaluate(() => ['play_button', 'stop_button'].map((id) => {
      const el = document.getElementById(id);
      const c = getComputedStyle(el);
      return { disabled: el.disabled, style: c.borderTopStyle, bg: c.backgroundColor };
    }));
    for (const button of idle) {
      expect(button.disabled).toBe(true);
      expect(button.style).toBe('solid');
      expect(button.bg).toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('mute shows a speaker, and a crossed-out speaker once muted', async () => {
    const shown = () => page.evaluate(() => [...document.querySelectorAll('#mute_button svg, #mute_button i')]
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => el.getAttribute('data-icon') || el.className));
    expect(await shown()).toEqual(['volume-high']);
    await page.locator('#mute_button').click();
    await expect(page.locator('#mute_button')).toHaveClass(/active/);
    expect(await shown()).toEqual(['volume-xmark']);
    await page.locator('#mute_button').click();
    await expect(page.locator('#mute_button')).not.toHaveClass(/active/);
    expect(await shown()).toEqual(['volume-high']);
  });

  test('the volume slider is a thin track, and the tools reach the right edge', async () => {
    const layout = await page.evaluate(() => {
      const volume = document.getElementById('volume');
      const panel = document.querySelector('#player-panel').getBoundingClientRect();
      return {
        width: volume.getBoundingClientRect().width,
        border: getComputedStyle(volume).borderTopWidth,
        gap: panel.right - volume.getBoundingClientRect().right
      };
    });
    expect(layout.width).toBeGreaterThanOrEqual(110);
    expect(layout.border).toBe('0px');
    expect(layout.gap).toBeLessThan(40);
  });

  test('Shift over Stop shows the fade icon and tooltip; Shift elsewhere does nothing', async () => {
    const stop = page.locator('#stop_button');
    // Stop is only clickable while something plays; enable it to hover it
    await page.evaluate(() => { document.getElementById('stop_button').disabled = false; });
    const icon = () => page.evaluate(() => [...document.querySelectorAll('#stop_button svg, #stop_button i')]
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => el.getAttribute('data-icon') || el.className));

    await expect(stop).toHaveAttribute('aria-label', 'Stop (Shift-click to fade out)');
    await page.locator('#omni_search').click();
    await page.keyboard.down('Shift');
    await expect(stop).not.toHaveClass(/fade-cue/);
    await page.keyboard.up('Shift');

    await stop.hover();
    await page.keyboard.down('Shift');
    await expect(stop).toHaveClass(/fade-cue/);
    await expect(stop).toHaveAttribute('aria-label', 'Fade out');
    expect(await icon()).toEqual(['volume-low']);

    await page.keyboard.up('Shift');
    await expect(stop).not.toHaveClass(/fade-cue/);
    expect(await icon()).toEqual(['stop']);
    await page.mouse.move(5, 5);
    await page.evaluate(() => { document.getElementById('stop_button').disabled = true; });
  });
});
