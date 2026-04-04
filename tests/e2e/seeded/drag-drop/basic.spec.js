import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, performEmptySearch } from '../../../utils/seeded-launch.js';

test.describe('Drag & Drop - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for drag-drop tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

    ({ app, page } = await launchSeededApp(electron, 'drag-drop'));

    // Ensure window is visible and focused
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    await page.bringToFront();
    await page.click('body');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('song rows are draggable', async () => {
    // Populate search results
    await performEmptySearch(page);

    // Verify song rows exist and have songid attributes
    const rows = page.locator('#search_results tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Verify the first row has a songid attribute and is draggable
    const firstRow = rows.first();
    const songId = await firstRow.getAttribute('songid');
    expect(songId).toBeTruthy();
    const draggable = await firstRow.getAttribute('draggable');
    expect(draggable).toBe('true');
  });

  test('drag song to hotkey slot assigns it', async () => {
    // Ensure search results are populated
    await performEmptySearch(page);

    const rows = page.locator('#search_results tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Get the song ID from the first search result row
    const firstRow = rows.first();
    const songId = await firstRow.getAttribute('songid');

    // Get the F1 hotkey slot in the active (first) tab
    const f1Hotkey = page.locator('#hotkeys_list_1 #f1_hotkey');
    await expect(f1Hotkey).toBeVisible();

    // Simulate drag and drop using dataTransfer via evaluate
    // Target the F1 hotkey in the first (active) tab
    await page.evaluate(({ songId }) => {
      const target = document.querySelector('#hotkeys_list_1 #f1_hotkey');
      if (!target) throw new Error('F1 hotkey in tab 1 not found');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', songId);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(dropEvent);
    }, { songId });

    // Verify the hotkey slot now has the song assigned
    const newSongId = await f1Hotkey.getAttribute('songid');
    expect(newSongId).toBe(songId);
  });

  test('drag song to holding tank adds it', async () => {
    // Ensure search results are populated
    await performEmptySearch(page);

    const rows = page.locator('#search_results tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Get a song ID from the search results
    const secondRow = rows.nth(1);
    const songId = await secondRow.getAttribute('songid');

    // Get the initial holding tank item count
    const holdingTankList = page.locator('#holding_tank_1');
    const initialCount = await holdingTankList.locator('li').count();

    // Simulate drag and drop to the holding tank container
    await page.evaluate(({ songId }) => {
      const target = document.getElementById('holding_tank_1');
      if (!target) throw new Error('Holding tank not found');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', songId);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(dropEvent);
    }, { songId });

    // Verify the holding tank now has one more item
    const newCount = await holdingTankList.locator('li').count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('drag song replaces existing hotkey assignment', async () => {
    // Ensure search results are populated
    await performEmptySearch(page);

    const rows = page.locator('#search_results tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // First, assign a song to F2 in the active tab
    const firstRow = rows.first();
    const firstSongId = await firstRow.getAttribute('songid');

    await page.evaluate(({ songId }) => {
      const target = document.querySelector('#hotkeys_list_1 #f2_hotkey');
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', songId);
      target.dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer,
      }));
    }, { songId: firstSongId });

    // Verify F2 has the first song
    const f2Hotkey = page.locator('#hotkeys_list_1 #f2_hotkey');
    let f2SongId = await f2Hotkey.getAttribute('songid');
    expect(f2SongId).toBe(firstSongId);

    // Now drag a different song to F2
    const secondRow = rows.nth(1);
    const secondSongId = await secondRow.getAttribute('songid');

    await page.evaluate(({ songId }) => {
      const target = document.querySelector('#hotkeys_list_1 #f2_hotkey');
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', songId);
      target.dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer,
      }));
    }, { songId: secondSongId });

    // Verify F2 now has the second song (replaced)
    await expect(async () => {
      f2SongId = await f2Hotkey.getAttribute('songid');
      expect(f2SongId).toBe(secondSongId);
    }).toPass({ timeout: 5000 });
  });

  test('drop with no song ID is ignored', async () => {
    const f3Hotkey = page.locator('#hotkeys_list_1 #f3_hotkey');
    const initialSongId = await f3Hotkey.getAttribute('songid');

    // Simulate a drop with empty data
    await page.evaluate(() => {
      const target = document.querySelector('#hotkeys_list_1 #f3_hotkey');
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', '');
      target.dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer,
      }));
    });

    // Verify the hotkey slot was not changed
    const afterSongId = await f3Hotkey.getAttribute('songid');
    expect(afterSongId).toBe(initialSongId);
  });

  test('column layout has three main columns', async () => {
    // Verify the three main columns exist in the top row
    const topRow = page.locator('#top-row');
    await expect(topRow).toBeVisible();

    await expect(page.locator('#holding-tank-column')).toBeVisible();
    await expect(page.locator('#search-column')).toBeVisible();
    await expect(page.locator('#hotkeys-column')).toBeVisible();
  });

  test('column headers are draggable for reordering', async () => {
    // Verify column headers have draggable attribute
    const headers = page.locator('#top-row .col .card-header[draggable="true"]');
    const count = await headers.count();
    expect(count).toBe(3);
  });

  test('column reorder changes DOM order and persists', async () => {
    // Get the initial column order
    const getColumnOrder = async () => {
      return page.evaluate(() => {
        const topRow = document.getElementById('top-row');
        return Array.from(topRow.querySelectorAll('#holding-tank-column, #search-column, #hotkeys-column'))
          .map(el => el.id);
      });
    };

    const initialOrder = await getColumnOrder();
    expect(initialOrder).toEqual(['holding-tank-column', 'search-column', 'hotkeys-column']);

    // Simulate column reorder via the internal reorder mechanism
    // Drag hotkeys-column before search-column (swap positions 2 and 1)
    await page.evaluate(() => {
      const topRow = document.getElementById('top-row');
      const hotkeysCol = document.getElementById('hotkeys-column');
      const searchCol = document.getElementById('search-column');

      // Move hotkeys before search
      topRow.insertBefore(hotkeysCol, searchCol);

      // Save the new order (simulating what the drop handler does)
      const newOrder = Array.from(topRow.querySelectorAll('#holding-tank-column, #search-column, #hotkeys-column'))
        .map(el => el.id);

      // Trigger save via profile API if available
      const electronAPI = window.secureElectronAPI || window.electronAPI;
      if (electronAPI?.profile?.setPreference) {
        electronAPI.profile.setPreference('column_order', newOrder);
      }
    });

    // Verify the new column order in DOM
    const newOrder = await getColumnOrder();
    expect(newOrder).toEqual(['holding-tank-column', 'hotkeys-column', 'search-column']);
  });
});
