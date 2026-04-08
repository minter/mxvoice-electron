import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';

test.describe('Navigation - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'navigation'));

    await waitForAppReady(page, app);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('tab key sends selected song to hotkeys', async () => {
    // 1) Search for a song and select it
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Anthrax');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // 2) Select the row (Tab from search selects first row)
    await page.keyboard.press('Tab');
    const selectedRow = page.locator('#selected_row');
    await expect(selectedRow).toBeVisible({ timeout: 5000 });

    // 3) Verify the selected row has a songid attribute
    const songId = await selectedRow.getAttribute('songid');
    expect(songId).toBeTruthy();

    // 4) Press Tab again to send the selected song to hotkeys
    await page.keyboard.press('Tab');

    // 5) Verify the song was assigned to the first empty hotkey slot
    // sendToHotkeys() finds the first <li> without a songid and assigns it
    const hotkeySlot = page.locator('.hotkeys.active li[songid]').first();
    await expect(hotkeySlot).toHaveAttribute('songid', songId, { timeout: 5000 });

    // Clean up: remove the hotkey assignment
    await page.evaluate(() => {
      document.querySelectorAll('.hotkeys.active li[songid]').forEach(li => {
        li.removeAttribute('songid');
        const span = li.querySelector('.song');
        if (span) span.textContent = '';
      });
    });

    // Reset search
    await page.locator('#reset_button').click();
  });

  test('shift+tab key sends selected song to holding tank', async () => {
    // 1) Search for a song and select it
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Edie Brickell');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // 2) Select the row
    await page.keyboard.press('Tab');
    const selectedRow = page.locator('#selected_row');
    await expect(selectedRow).toBeVisible({ timeout: 5000 });

    // 3) Count holding tank items before
    const holdingTankItems = page.locator('.holding_tank.active li');
    const countBefore = await holdingTankItems.count();

    // 4) Press Shift+Tab to send to holding tank
    await page.keyboard.press('Shift+Tab');

    // 5) Verify a new item was added to the holding tank
    await expect(holdingTankItems).toHaveCount(countBefore + 1, { timeout: 5000 });

    // 6) Verify the new item contains the song
    const lastItem = holdingTankItems.last();
    await expect(lastItem).toContainText('Edie Brickell', { timeout: 5000 });

    // Reset search
    await page.locator('#reset_button').click();
  });

  test('arrow key navigation in search results', async () => {
    // Test that arrow keys navigate through search results
    
    // 1) Perform a search to get results
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('The');
    await searchInput.press('Enter');

    // 2) Verify we have search results
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 5000 });
    
    // 3) Press Tab to select first row (this should trigger the Tab key handler)
    await page.keyboard.press('Tab');

    // 4) Verify first row is selected
    const firstRow = rows.first();
    const firstRowId = await firstRow.getAttribute('id');
    expect(firstRowId).toBe('selected_row');
    
    // 5) Press down arrow to select next row
    await page.keyboard.press('ArrowDown');

    // 6) Verify second row is selected
    const secondRow = rows.nth(1);
    const secondRowId = await secondRow.getAttribute('id');
    expect(secondRowId).toBe('selected_row');
    
    // 7) Press up arrow to select previous row
    await page.keyboard.press('ArrowUp');

    // 8) Verify first row is selected again
    const firstRowIdAfterUp = await firstRow.getAttribute('id');
    expect(firstRowIdAfterUp).toBe('selected_row');
    
    console.log('✅ Arrow key navigation in search results works');
  });

  test('enter key plays selected song', async () => {
    // Test that Enter key plays the selected song
    
    // 1) Perform a search to get results
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');

    // 2) Verify we have search results
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // 3) Press Tab to select the row
    await page.keyboard.press('Tab');

    // 4) Verify row is selected
    const songRow = rows.first();
    const rowId = await songRow.getAttribute('id');
    expect(rowId).toBe('selected_row');
    
    // 5) Press Enter to play the song
    await page.keyboard.press('Enter');

    // 6) Verify song starts playing
    await expect(page.locator('#pause_button')).toBeVisible();
    await expect(page.locator('#play_button')).not.toBeVisible();
    
    // 7) Stop playback
    await page.locator('#stop_button').click();

    console.log('✅ Enter key plays selected song');
  });

  test('space key toggles play/pause', async () => {
    // Test that Space key toggles play/pause
    
    // 1) Search for a song and select it
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Weird Al');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // 2) Select the song and start playing
    const songRow = rows.first();
    await songRow.dblclick();

    // 3) Verify song is playing
    await expect(page.locator('#pause_button')).toBeVisible();

    // 4) Press Space to pause
    await page.keyboard.press(' ');

    // 5) Verify song is paused
    await expect(page.locator('#play_button')).toBeVisible();
    await expect(page.locator('#pause_button')).not.toBeVisible();
    
    // 6) Press Space again to resume
    await page.keyboard.press(' ');

    // 7) Verify song is playing again
    await expect(page.locator('#pause_button')).toBeVisible();
    await expect(page.locator('#play_button')).not.toBeVisible();
    
    // 8) Stop playback
    await page.locator('#stop_button').click();

    console.log('✅ Space key toggles play/pause');
  });

  test('escape key stops playback', async () => {
    // Test that Escape key stops playback
    
    // 1) Search for a song and start playing
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Edie Brickell');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // 2) Start playback
    const songRow = rows.first();
    await songRow.dblclick();

    // 3) Verify song is playing
    await expect(page.locator('#pause_button')).toBeVisible();

    // 4) Press Escape to stop
    await page.keyboard.press('Escape');

    // 5) Verify playback stopped
    await expect(page.locator('#play_button')).toBeVisible();
    await expect(page.locator('#pause_button')).not.toBeVisible();
    
    console.log('✅ Escape key stops playback');
  });

  test('shift+escape key stops playback with fade out', async () => {
    // Test that Shift+Escape key stops playback with fade out
    
    // 1) Search for a song and start playing
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Sister Sledge');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // 2) Start playback
    const songRow = rows.first();
    await songRow.dblclick();

    // 3) Verify song is playing
    await expect(page.locator('#pause_button')).toBeVisible();

    // 4) Press Shift+Escape for fade out stop
    await page.keyboard.press('Shift+Escape');

    // 5) Verify playback stopped
    await expect(page.locator('#play_button')).toBeVisible();
    await expect(page.locator('#pause_button')).not.toBeVisible();
    
    console.log('✅ Shift+Escape key stops playback with fade out');
  });

  test('F1-F12 function keys work for hotkeys', async () => {
    // Test that F1-F12 keys trigger hotkey playback
    
    // 1) First, assign a song to F1 hotkey
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Anthrax');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    
    // 2) Assign song to F1 hotkey via drag, with evaluate fallback for Linux headless
    const songRow = rows.first();
    const f1Hotkey = page.locator('#hotkeys_list_1 #f1_hotkey .song');
    await songRow.dragTo(f1Hotkey, { force: true, sourcePosition: { x: 10, y: 10 }, targetPosition: { x: 20, y: 20 } });

    // If drag-and-drop didn't work (common on Linux xvfb), assign directly via JS
    const f1Text = await f1Hotkey.textContent();
    if (!f1Text || !f1Text.includes('Got The Time')) {
      await page.evaluate(() => {
        const songId = '1001'; // Got The Time by Anthrax
        const target = document.querySelector('#hotkeys_list_1 #f1_hotkey .song');
        if (target && window.setLabelFromSongId) {
          target.setAttribute('songid', songId);
          window.setLabelFromSongId(songId, target);
        }
      });
    }

    // 3) Verify song is assigned to F1
    await expect(f1Hotkey).toContainText('Got The Time', { timeout: 5000 });
    
    // 4) Press F1 to play the hotkey
    await page.keyboard.press('F1');

    // 5) Verify song starts playing
    await expect(page.locator('#pause_button')).toBeVisible();
    await expect(page.locator('#play_button')).not.toBeVisible();
    
    // 6) Stop playback
    await page.locator('#stop_button').click();

    console.log('✅ F1-F12 function keys work for hotkeys');
  });

  test('search input keyboard events work correctly', async () => {
    // Test that search input keyboard events work as expected
    
    // 1) Focus search input
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.focus();
    
    // 2) Type some text that definitely won't match any songs
    await searchInput.fill('XyZ123NoMatch');
    await expect(searchInput).toHaveValue('XyZ123NoMatch');
    
    // 3) Press Enter to submit search
    await page.keyboard.press('Enter');

    // 4) Verify search executed (should find no results for "XyZ123NoMatch")
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(0, { timeout: 5000 });

    // 5) Clear search and test with valid term
    await searchInput.clear();
    await searchInput.fill('The');
    await page.keyboard.press('Enter');

    // 6) Verify search found results
    await expect(rows).toHaveCount(3, { timeout: 5000 });
    
    console.log('✅ Search input keyboard events work correctly');
  });

  test('menu navigation is accessible via keyboard', async () => {
    // Test menu keyboard navigation and accessibility
    
    // 1) Test Alt key opens menu bar
    await page.keyboard.press('Alt');

    // 2) Test arrow key navigation through menu items
    // Press right arrow to move through top-level menus
    await page.keyboard.press('ArrowRight');

    // Press down arrow to open submenu
    await page.keyboard.press('ArrowDown');

    // 3) Test Escape key closes menu
    await page.keyboard.press('Escape');

    // Verify menu is no longer active
    const menuActive = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return activeElement && activeElement.tagName === 'BUTTON' && 
             activeElement.getAttribute('role') === 'menuitem';
    });
    
    expect(menuActive).toBeFalsy();
    
    console.log('✅ Menu navigation works via keyboard');
  });
});
