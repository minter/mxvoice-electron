import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, waitForAppReady, closeApp } from '../../../utils/seeded-launch.js';

// Seeded songs: 1001 Got The Time (0:06), 1004 We Are Family (0:07), 1005 Eat It (0:06).
const tankLayout = (songIds, hotkeys = {}) => ({
  hotkeys: [{ tabNumber: 1, tabName: null, hotkeys }],
  holdingTank: [{ tabNumber: 1, tabName: null, songIds }],
  selected: { hotkeyTab: 1, holdingTankTab: 1 }
});

async function applyLayout(page, layout) {
  return page.evaluate((value) => window.__boardsTest.applyLayout(value), layout);
}

// Record every songid #song_now_playing takes, so a song that starts and is
// replaced between two assertions is still caught.
async function recordNowPlaying(page) {
  await page.evaluate(() => {
    const target = document.getElementById('song_now_playing');
    window.__nowPlayingHistory = [];
    new MutationObserver(() => {
      const songId = target.getAttribute('songid');
      if (songId && window.__nowPlayingHistory.at(-1) !== songId) window.__nowPlayingHistory.push(songId);
    }).observe(target, { attributes: true, attributeFilter: ['songid'] });
  });
}

async function seekNearEndAndWaitForCompletion(page) {
  await page.evaluate(() => {
    const sound = window.sharedState.get('sound');
    sound.seek(Math.max(0, sound.duration() - 0.5));
  });
  await expect(page.locator('#play_button')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#pause_button')).not.toBeVisible();
  // Give autoplay a chance to start the next song, if it were going to
  await page.waitForTimeout(1500);
}

test.describe('Boards - layout swap during playback', () => {
  let app; let page;

  test.beforeEach(async () => {
    ({ app, page } = await launchSeededApp(electron, 'board-swap-playback'));
    await waitForAppReady(page, app);
  });

  test.afterEach(async () => {
    await closeApp(app);
  });

  test('switching layout mid-playlist keeps the song and does not advance', async () => {
    await applyLayout(page, tankLayout(['1005', '1004']));
    await page.locator('#playlist_mode_btn').click();
    await expect(page.locator('#playlist_mode_btn')).toHaveClass(/active/);

    const rows = page.locator('#holding_tank_1 .list-group-item');
    await expect(rows).toHaveCount(2);
    await rows.nth(0).dblclick();
    await expect(page.locator('#pause_button')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#song_now_playing')).toHaveAttribute('songid', '1005');
    await expect(rows.nth(0)).toHaveClass(/now_playing/);
    await recordNowPlaying(page);

    const result = await applyLayout(page, tankLayout(['1005', '1001'], { f1: '1004' }));
    expect(result).toEqual({ dropped: 0, droppedIds: [] });

    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toHaveAttribute('songid', '1001');
    await expect(page.locator('#song_now_playing')).toHaveAttribute('songid', '1005');
    await expect(page.locator('#pause_button')).toBeVisible();
    await expect(page.locator('.now_playing')).toHaveCount(0);
    await expect(page.locator('.active-hotkey')).toHaveCount(0);
    await expect(page.locator('#selected_row')).toHaveCount(0);

    // The operator picks a row in the new tank while the old song plays out
    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveAttribute('id', 'selected_row');

    await seekNearEndAndWaitForCompletion(page);

    expect(await page.evaluate(() => window.__nowPlayingHistory)).toEqual([]);
    await expect(page.locator('#song_now_playing')).not.toHaveAttribute('songid');
    await expect(page.locator('.now_playing')).toHaveCount(0);
    // The old song's end leaves that pick alone
    await expect(page.locator('#selected_row')).toHaveAttribute('songid', '1001');
  });

  test('switching to Playlist mode after a swap does not attach to the new tank', async () => {
    await applyLayout(page, tankLayout(['1005', '1004']));
    await expect(page.locator('#storage_mode_btn')).toHaveClass(/active/);

    const rows = page.locator('#holding_tank_1 .list-group-item');
    await rows.nth(0).dblclick();
    await expect(page.locator('#pause_button')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#song_now_playing')).toHaveAttribute('songid', '1005');
    await recordNowPlaying(page);

    await applyLayout(page, tankLayout(['1005', '1004']));
    await page.locator('#playlist_mode_btn').click();
    await expect(page.locator('#playlist_mode_btn')).toHaveClass(/active/);

    await expect(page.locator('#song_now_playing')).toHaveAttribute('songid', '1005');
    await expect(page.locator('.now_playing')).toHaveCount(0);

    await seekNearEndAndWaitForCompletion(page);

    expect(await page.evaluate(() => window.__nowPlayingHistory)).toEqual([]);
    await expect(page.locator('#song_now_playing')).not.toHaveAttribute('songid');
  });

  test('Stop still stops the song after a swap', async () => {
    await applyLayout(page, tankLayout(['1005'], { f1: '1005' }));
    const f1 = page.locator('#hotkeys_list_1 [id^="f1_hotkey"]');
    await expect(f1).toHaveAttribute('songid', '1005');
    await page.keyboard.press('F1');
    await expect(page.locator('#pause_button')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#song_now_playing')).toHaveAttribute('songid', '1005');
    await expect(f1).toHaveClass(/active-hotkey/);

    await applyLayout(page, tankLayout(['1001'], { f1: '1004' }));
    await expect(page.locator('#holding_tank_1 .list-group-item')).toHaveAttribute('songid', '1001');
    await expect(f1).toHaveAttribute('songid', '1004');
    await expect(page.locator('.active-hotkey')).toHaveCount(0);
    await expect(page.locator('#song_now_playing')).toHaveAttribute('songid', '1005');
    await expect(page.locator('#stop_button')).toBeEnabled();

    await page.locator('#stop_button').click();

    await expect(page.locator('#stop_button')).toBeDisabled({ timeout: 5000 });
    await expect(page.locator('#play_button')).toBeVisible();
    await expect(page.locator('#song_now_playing')).not.toHaveAttribute('songid');
    expect(await page.evaluate(() => window.sharedState.get('sound')?.playing?.() ?? false)).toBe(false);
  });

  test('a hotkey-started song still re-finds its tank row when Playlist mode is chosen, with no swap', async () => {
    const tank = page.locator('#holding_tank_1');
    await page.evaluate(async () => {
      const list = document.getElementById('holding_tank_1');
      await window.moduleRegistry.holdingTank.addToHoldingTank('1004', list);
      await window.moduleRegistry.holdingTank.addToHoldingTank('1005', list);
      const f1 = document.querySelector('#hotkeys_list_1 [id^="f1_hotkey"]');
      f1.setAttribute('songid', '1005');
      const song = f1.querySelector('.song');
      if (song) song.textContent = 'Eat It by Weird Al Yankovic (0:06)';
    });
    await expect(tank.locator('.list-group-item')).toHaveCount(2);
    // Startup applied the saved board once (Task 9); no swap happens after it
    const generation = await page.evaluate(() => window.sharedState.get('boardGeneration'));
    expect(generation).toBe(1);

    await page.keyboard.press('F1');
    await expect(page.locator('#pause_button')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#song_now_playing')).toHaveAttribute('songid', '1005');

    await page.locator('#playlist_mode_btn').click();
    await expect(page.locator('#playlist_mode_btn')).toHaveClass(/active/);

    await expect(tank.locator('.list-group-item[songid="1005"]')).toHaveClass(/now_playing/);
    expect(await page.evaluate(() => window.sharedState.get('boardGeneration'))).toBe(generation);
    await page.locator('#stop_button').click();
    await expect(page.locator('#stop_button')).toBeDisabled({ timeout: 5000 });
  });
});
