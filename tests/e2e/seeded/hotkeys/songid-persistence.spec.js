import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

/**
 * Regression Test for Hotkey songid Attribute Loss Bug
 *
 * Bug: When setLabelFromSongId() is called with a song that already exists
 * on another hotkey in the same tab, the swap logic incorrectly reads the
 * songid attribute from the span element instead of the li element.
 * Since spans never have songid attributes, this causes the other hotkey
 * to lose its songid, resulting in playback failures.
 *
 * This test verifies:
 * 1. Duplicate song assignments within same tab preserve songid on both hotkeys
 * 2. Swap operations correctly transfer songid attributes
 * 3. songid attributes persist after profile state save/restore
 */

test.describe('Hotkeys - songid Persistence Bug Regression', () => {
  let app;
  let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'hotkeys-songid'));

    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    });

    await page.bringToFront();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    await closeApp(app, page);
  });

  test.beforeEach(async () => {
    // Ensure Tab 1 is active
    const tab1 = page.locator('#hotkey_tabs a[href="#hotkeys_list_1"]');
    await tab1.click();
    await page.waitForTimeout(500);

    // Clear all hotkeys in Tab 1
    await page.evaluate(() => {
      for (let key = 1; key <= 12; key++) {
        const tabContent = document.getElementById('hotkeys_list_1');
        const hotkey = tabContent?.querySelector(`#f${key}_hotkey`);
        if (hotkey) {
          hotkey.removeAttribute('songid');
          const span = hotkey.querySelector('span');
          if (span) span.textContent = '';
        }
      }
    });

    await page.waitForTimeout(500);
  });

  test('songid should persist when assigning duplicate songs in same tab', async () => {
    console.log('\n🧪 TEST: Duplicate song assignment should not lose songid');

    // Step 1: Assign song 100 to F6
    console.log('📌 Step 1: Assigning song 100 to F6');
    await page.evaluate(() => {
      const hotkeysModule = window.moduleRegistry?.hotkeys;
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');

      if (f6 && hotkeysModule?.setLabelFromSongId) {
        hotkeysModule.setLabelFromSongId('100', f6);
      }
    });

    await page.waitForTimeout(500);

    // Verify F6 has songid
    const f6SongIdAfterFirst = await page.evaluate(() => {
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');
      return f6?.getAttribute('songid');
    });

    console.log(`✅ F6 songid after first assignment: ${f6SongIdAfterFirst}`);
    expect(f6SongIdAfterFirst).toBe('100');

    // Step 2: Assign the SAME song (100) to F1 - this triggers the swap logic
    console.log('📌 Step 2: Assigning same song 100 to F1 (triggers swap logic)');
    await page.evaluate(() => {
      const hotkeysModule = window.moduleRegistry?.hotkeys;
      const f1 = document.querySelector('#hotkeys_list_1 #f1_hotkey');

      if (f1 && hotkeysModule?.setLabelFromSongId) {
        hotkeysModule.setLabelFromSongId('100', f1);
      }
    });

    await page.waitForTimeout(500);

    // Step 3: Verify BOTH F1 and F6 maintain their songid attributes
    const results = await page.evaluate(() => {
      const f1 = document.querySelector('#hotkeys_list_1 #f1_hotkey');
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');

      return {
        f1_songid: f1?.getAttribute('songid'),
        f1_text: f1?.querySelector('span')?.textContent || '',
        f6_songid: f6?.getAttribute('songid'),
        f6_text: f6?.querySelector('span')?.textContent || '',
      };
    });

    console.log('📊 Results after duplicate assignment:');
    console.log(`   F1 songid: ${results.f1_songid} (text: "${results.f1_text}")`);
    console.log(`   F6 songid: ${results.f6_songid} (text: "${results.f6_text}")`);

    // CRITICAL ASSERTIONS: Both should have songid attributes
    expect(results.f1_songid).toBeTruthy();
    expect(results.f6_songid).toBeTruthy();
    expect(results.f1_text).toBeTruthy(); // Should have song title
    expect(results.f6_text).toBeTruthy(); // Should have song title

    // F6 should NOT lose its songid (this was the bug)
    expect(results.f6_songid).not.toBeNull();

    console.log('✅ TEST PASSED: Both hotkeys retain songid attributes');
  });

  test('songid should persist through drag-and-drop duplicate operations', async () => {
    console.log('\n🧪 TEST: Drag-and-drop with duplicates should preserve songid');

    // Setup: Assign song to F6
    await page.evaluate(() => {
      const hotkeysModule = window.moduleRegistry?.hotkeys;
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');
      if (f6 && hotkeysModule?.setLabelFromSongId) {
        hotkeysModule.setLabelFromSongId('200', f6);
      }
    });

    await page.waitForTimeout(500);

    // Search for the same song
    await page.fill('#omni_search', 'test');
    await page.waitForTimeout(500);

    // Get the first search result (assuming it has songid 200)
    const firstResult = page.locator('#search_results .list-group-item').first();

    // Drag it to F1
    const f1Hotkey = page.locator('#hotkeys_list_1 #f1_hotkey');
    await firstResult.dragTo(f1Hotkey);
    await page.waitForTimeout(500);

    // Verify F6 still has its songid
    const f6SongId = await page.evaluate(() => {
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');
      return f6?.getAttribute('songid');
    });

    console.log(`F6 songid after drag operation: ${f6SongId}`);
    expect(f6SongId).toBeTruthy();
    expect(f6SongId).not.toBeNull();

    console.log('✅ TEST PASSED: songid preserved through drag-and-drop');
  });

  test('songid should persist after profile state save and restore', async () => {
    console.log('\n🧪 TEST: songid should survive profile state save/restore cycle');

    // Step 1: Assign songs to multiple hotkeys
    await page.evaluate(() => {
      const hotkeysModule = window.moduleRegistry?.hotkeys;
      const assignments = [
        { key: 'f1', songId: '100' },
        { key: 'f6', songId: '200' },
        { key: 'f12', songId: '300' }
      ];

      assignments.forEach(({ key, songId }) => {
        const element = document.querySelector(`#hotkeys_list_1 #${key}_hotkey`);
        if (element && hotkeysModule?.setLabelFromSongId) {
          hotkeysModule.setLabelFromSongId(songId, element);
        }
      });
    });

    await page.waitForTimeout(500);

    // Step 2: Trigger profile state save
    await page.evaluate(async () => {
      if (window.moduleRegistry?.profileState?.saveProfileState) {
        await window.moduleRegistry.profileState.saveProfileState();
        console.log('✅ Profile state saved');
      }
    });

    await page.waitForTimeout(500);

    // Step 3: Clear hotkeys manually (simulating corruption)
    await page.evaluate(() => {
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');
      if (f6) {
        f6.removeAttribute('songid');
        console.log('❌ Manually removed F6 songid to simulate corruption');
      }
    });

    // Step 4: Restore from profile state
    await page.evaluate(async () => {
      if (window.moduleRegistry?.profileState?.loadProfileState) {
        await window.moduleRegistry.profileState.loadProfileState();
        console.log('✅ Profile state restored');
      }
    });

    await page.waitForTimeout(500);

    // Step 5: Verify all songids were restored
    const songIds = await page.evaluate(() => {
      const f1 = document.querySelector('#hotkeys_list_1 #f1_hotkey');
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');
      const f12 = document.querySelector('#hotkeys_list_1 #f12_hotkey');

      return {
        f1: f1?.getAttribute('songid'),
        f6: f6?.getAttribute('songid'),
        f12: f12?.getAttribute('songid')
      };
    });

    console.log('📊 Restored songIds:', songIds);

    expect(songIds.f1).toBe('100');
    expect(songIds.f6).toBe('200'); // This was the problematic one
    expect(songIds.f12).toBe('300');

    console.log('✅ TEST PASSED: All songids restored correctly');
  });

  test('REGRESSION: swap with both hotkeys populated should preserve songid', async () => {
    console.log('\n🧪 REGRESSION TEST: Verify fix for swap when both hotkeys have songs');

    // This test reproduces the ACTUAL bug scenario:
    // Before fix: const destId = elemSpan?.getAttribute?.('songid'); // WRONG - reads null
    // After fix:  const destId = element?.getAttribute?.('songid');   // CORRECT - reads F1's songid
    //
    // Bug scenario:
    // 1. F6 has Song A (id=songA)
    // 2. F1 has Song B (id=songB) - CRITICAL: F1 must have a different song!
    // 3. Assign Song A to F1 (overwrite Song B)
    // 4. Expected: F6 gets Song B with songid=songB
    // 5. Bug: F6 gets Song B text but songid=null (because destId read from span)

    // Use known seeded test songs from TEST_CONFIG.schema.songs
    // Song A: 1001 - "Got The Time" by Anthrax
    // Song B: 1002 - "The Wheel" by Edie Brickell
    const songA = '1001';
    const songB = '1002';
    console.log(`Using seeded test songs: Song A (id=${songA}), Song B (id=${songB})`);

    // Step 1: Setup F6 with Song A
    console.log(`📌 Step 1: Assigning Song A (id=${songA}) to F6`);
    await page.evaluate(({ songId }) => {
      const hotkeysModule = window.moduleRegistry?.hotkeys;
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');
      if (f6 && hotkeysModule?.setLabelFromSongId) {
        hotkeysModule.setLabelFromSongId(songId, f6);
      }
    }, { songId: songA });

    await page.waitForTimeout(1000);

    // Step 2: Setup F1 with Song B - DIFFERENT song!
    console.log(`📌 Step 2: Assigning Song B (id=${songB}) to F1`);
    await page.evaluate(({ songId }) => {
      const hotkeysModule = window.moduleRegistry?.hotkeys;
      const f1 = document.querySelector('#hotkeys_list_1 #f1_hotkey');
      if (f1 && hotkeysModule?.setLabelFromSongId) {
        hotkeysModule.setLabelFromSongId(songId, f1);
      }
    }, { songId: songB });

    await page.waitForTimeout(1000);

    // Verify both hotkeys have songs before the swap
    const beforeSwap = await page.evaluate(() => {
      const f1 = document.querySelector('#hotkeys_list_1 #f1_hotkey');
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');
      return {
        f1_songid: f1?.getAttribute('songid'),
        f6_songid: f6?.getAttribute('songid')
      };
    });

    console.log(`Before swap: F1=${beforeSwap.f1_songid}, F6=${beforeSwap.f6_songid}`);
    expect(beforeSwap.f1_songid).toBe(songB);
    expect(beforeSwap.f6_songid).toBe(songA);

    // Step 3: Assign Song A to F1 (overwriting Song B) - TRIGGERS THE BUG!
    console.log(`📌 Step 3: Assigning Song A (id=${songA}) to F1 (overwriting Song B)`);
    await page.evaluate(({ songId }) => {
      const hotkeysModule = window.moduleRegistry?.hotkeys;
      const f1 = document.querySelector('#hotkeys_list_1 #f1_hotkey');

      if (f1 && hotkeysModule?.setLabelFromSongId) {
        // This triggers swap logic because F6 already has songid=songA
        hotkeysModule.setLabelFromSongId(songId, f1);
      }
    }, { songId: songA });

    await page.waitForTimeout(1000);

    // Step 4: Verify swap completed correctly
    const afterSwap = await page.evaluate(() => {
      const f1 = document.querySelector('#hotkeys_list_1 #f1_hotkey');
      const f6 = document.querySelector('#hotkeys_list_1 #f6_hotkey');

      return {
        f1_songid: f1?.getAttribute('songid'),
        f1_text: f1?.querySelector('span')?.textContent || '',
        f6_songid: f6?.getAttribute('songid'),
        f6_text: f6?.querySelector('span')?.textContent || ''
      };
    });

    console.log('📊 After swap:');
    console.log(`   F1: songid=${afterSwap.f1_songid}, text="${afterSwap.f1_text}"`);
    console.log(`   F6: songid=${afterSwap.f6_songid}, text="${afterSwap.f6_text}"`);

    // CRITICAL ASSERTIONS: This is THE bug scenario!
    // After assigning Song A to F1, which already had Song B:
    // - F1 should have Song A (songid=songA)
    // - F6 should have Song B (songid=songB) - swapped from F1
    //
    // THE BUG: F6 would have Song B text but songid=null
    // THE FIX: F6 should have Song B text AND songid=songB

    // F1 should have Song A
    expect(afterSwap.f1_songid).toBe(songA);
    expect(afterSwap.f1_text).toBeTruthy();

    // F6 should have Song B WITH SONGID (this was the bug!)
    expect(afterSwap.f6_songid).toBe(songB);  // CRITICAL: Should be Song B's ID, not null!
    expect(afterSwap.f6_text).toBeTruthy();    // Should have Song B's text

    // Explicit check: F6 must not have null songid
    expect(afterSwap.f6_songid).not.toBeNull();
    expect(afterSwap.f6_songid).not.toBe('');

    console.log('✅ REGRESSION TEST PASSED: Swap preserved songid correctly');
    console.log(`   F6 correctly received Song B (id=${songB}) with proper songid attribute`);
  });
});
