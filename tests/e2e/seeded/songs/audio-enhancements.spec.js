import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

// Audio enhancement tests run serially to avoid contention
test.describe.configure({ mode: 'serial' });

test.describe('Audio Enhancements - song edit fields', () => {
  let app; let page;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for audio enhancement tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

    ({ app, page } = await launchSeededApp(electron, 'audio-enhancements'));

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  /**
   * Helper: search for a song and open the edit modal
   */
  async function openEditModal(searchTerm) {
    // Clear any stuck modal state
    await page.evaluate(() => {
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
    });

    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.fill(searchTerm);
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Select the row first
    await rows.first().click();
    await page.waitForTimeout(200);

    // Use direct function call to open edit modal (more reliable than context menu)
    await page.evaluate(() => {
      if (typeof window.editSelectedSong === 'function') {
        window.editSelectedSong();
      } else if (window.moduleRegistry?.songManagement?.editSelectedSong) {
        window.moduleRegistry.songManagement.editSelectedSong();
      }
    });

    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#songFormModalTitle')).toContainText('Edit This Song');
  }

  test('edit modal shows volume, start time, and end time fields', async () => {
    await openEditModal('Anthrax');

    // Verify new fields are present
    await expect(page.locator('#song-form-volume')).toBeVisible();
    await expect(page.locator('#song-form-volume-display')).toBeVisible();
    await expect(page.locator('#song-form-start-time')).toBeVisible();
    await expect(page.locator('#song-form-end-time')).toBeVisible();

    // Volume should default to 100 for unedited songs
    await expect(page.locator('#song-form-volume')).toHaveValue('100');
    await expect(page.locator('#song-form-volume-display')).toHaveText('100');

    // Start and end should be empty for unedited songs
    await expect(page.locator('#song-form-start-time')).toHaveValue('');
    await expect(page.locator('#song-form-end-time')).toHaveValue('');

    // End time placeholder should show the track duration
    const placeholder = await page.locator('#song-form-end-time').getAttribute('placeholder');
    expect(placeholder).toMatch(/\d+:\d{2}/);

    console.log('✅ New audio enhancement fields present with correct defaults');

    // Close modal
    await page.locator('#songFormModal .btn-close').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('volume slider updates display in real time', async () => {
    await openEditModal('Anthrax');

    const volumeSlider = page.locator('#song-form-volume');
    const volumeDisplay = page.locator('#song-form-volume-display');

    // Set volume to 50 using evaluate (range inputs need direct manipulation)
    await volumeSlider.evaluate((el) => {
      el.value = 50;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(volumeDisplay).toHaveText('50');
    console.log('✅ Volume slider updates display in real time');

    // Close modal
    await page.locator('#songFormModal .btn-close').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('volume and time fields persist after save and re-edit', async () => {
    await openEditModal('Anthrax');

    // Set volume to 75
    await page.locator('#song-form-volume').evaluate((el) => {
      el.value = 75;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Set start time to 0:02
    const startInput = page.locator('#song-form-start-time');
    await startInput.click();
    await startInput.fill('0:02');

    // Set end time to 0:05
    const endInput = page.locator('#song-form-end-time');
    await endInput.click();
    await endInput.fill('0:05');

    // Save
    await page.locator('#songFormSubmitButton').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });

    console.log('✅ Saved song with volume=75, start=0:02, end=0:05');

    // Re-open edit modal and verify values persisted
    await openEditModal('Anthrax');

    await expect(page.locator('#song-form-volume')).toHaveValue('75');
    await expect(page.locator('#song-form-volume-display')).toHaveText('75');
    await expect(page.locator('#song-form-start-time')).toHaveValue('0:02');
    await expect(page.locator('#song-form-end-time')).toHaveValue('0:05');

    console.log('✅ Volume and time fields persisted correctly after save');

    // Clean up: reset values back to defaults
    await page.locator('#song-form-volume').evaluate((el) => {
      el.value = 100;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await startInput.click();
    await startInput.fill('');
    await endInput.click();
    await endInput.fill('');
    await page.locator('#songFormSubmitButton').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('start time >= end time shows validation error', async () => {
    await openEditModal('Anthrax');

    // Set start and end to the same value
    const startInput = page.locator('#song-form-start-time');
    await startInput.click();
    await startInput.fill('0:10');

    const endInput = page.locator('#song-form-end-time');
    await endInput.click();
    await endInput.fill('0:10');

    // Try to save
    await page.locator('#songFormSubmitButton').click();

    // Modal should still be visible (save was blocked)
    await expect(page.locator('#songFormModal')).toBeVisible();

    // Validation error should appear
    await expect(page.locator('#song-form-time-feedback')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('#song-form-time-feedback')).toContainText('Start time must be before end time');

    // Both fields should have is-invalid class
    await expect(page.locator('#song-form-start-time')).toHaveClass(/is-invalid/);
    await expect(page.locator('#song-form-end-time')).toHaveClass(/is-invalid/);

    console.log('✅ Validation error shown when start >= end');

    // Close modal
    await page.locator('#songFormModal .btn-close').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('start time > end time is also rejected', async () => {
    await openEditModal('Anthrax');

    const startInput = page.locator('#song-form-start-time');
    await startInput.click();
    await startInput.fill('0:20');

    const endInput = page.locator('#song-form-end-time');
    await endInput.click();
    await endInput.fill('0:10');

    await page.locator('#songFormSubmitButton').click();

    // Modal should still be open
    await expect(page.locator('#songFormModal')).toBeVisible();
    await expect(page.locator('#song-form-time-feedback')).toBeVisible({ timeout: 2000 });

    console.log('✅ Validation error shown when start > end');

    await page.locator('#songFormModal .btn-close').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('bare number input normalizes to MM:SS on blur', async () => {
    await openEditModal('Anthrax');

    const startInput = page.locator('#song-form-start-time');
    await startInput.click();
    await startInput.fill('45');
    // Trigger blur by clicking elsewhere
    await page.locator('#song-form-title').click();

    // Should normalize to 0:45
    await expect(startInput).toHaveValue('0:45');

    // Test larger number
    const endInput = page.locator('#song-form-end-time');
    await endInput.click();
    await endInput.fill('90');
    await page.locator('#song-form-title').click();

    // Should normalize to 1:30
    await expect(endInput).toHaveValue('1:30');

    console.log('✅ Bare number inputs normalize to MM:SS on blur');

    await page.locator('#songFormModal .btn-close').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('seconds > 59 auto-corrects on blur', async () => {
    await openEditModal('Anthrax');

    const startInput = page.locator('#song-form-start-time');
    await startInput.click();
    await startInput.fill('1:75');
    await page.locator('#song-form-title').click();

    // 1:75 = 135 seconds = 2:15
    await expect(startInput).toHaveValue('2:15');

    console.log('✅ Seconds > 59 auto-corrects on blur');

    await page.locator('#songFormModal .btn-close').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Audio Enhancements - playback with trim points', () => {
  let app; let page;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

    ({ app, page } = await launchSeededApp(electron, 'audio-trim'));

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('playback with start point seeks to correct position', async () => {
    // First, set a start time on a song via the edit modal
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // Edit song via direct function call
    await rows.first().click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      if (typeof window.editSelectedSong === 'function') {
        window.editSelectedSong();
      } else if (window.moduleRegistry?.songManagement?.editSelectedSong) {
        window.moduleRegistry.songManagement.editSelectedSong();
      }
    });
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 5000 });

    const startInput = page.locator('#song-form-start-time');
    await startInput.click();
    await startInput.fill('0:02');
    await page.locator('#songFormSubmitButton').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });

    // Search again and play
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // Double-click to play
    await rows.first().dblclick();

    // Wait for playback to start
    await expect(page.locator('#pause_button')).toBeVisible({ timeout: 5000 });

    // Verify the seek position is at or near the start time
    // The timer should show a small number (near 0:00) since we just started from the start point
    await page.waitForTimeout(500);
    const timerText = await page.locator('#timer').textContent();
    console.log(`Timer after start with start_time=2s: ${timerText}`);

    // Timer shows elapsed time relative to trim point, should be small
    const elapsed = timerText.split(':').reduce((a, b) => a * 60 + parseInt(b), 0);
    expect(elapsed).toBeLessThan(3); // Should be 0-2 seconds of elapsed time

    // Stop playback
    await page.locator('#stop_button').click();
    console.log('✅ Playback with start point seeks correctly');

    // Clean up: remove start time
    await rows.first().click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      if (typeof window.editSelectedSong === 'function') window.editSelectedSong();
      else if (window.moduleRegistry?.songManagement?.editSelectedSong) window.moduleRegistry.songManagement.editSelectedSong();
    });
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 5000 });
    const startInput2 = page.locator('#song-form-start-time');
    await startInput2.click();
    await startInput2.fill('');
    await page.locator('#songFormSubmitButton').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('playback with end point stops at correct position', async () => {
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // Edit song to set end time to 0:02 (should stop after ~2 seconds)
    await rows.first().click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      if (typeof window.editSelectedSong === 'function') window.editSelectedSong();
      else if (window.moduleRegistry?.songManagement?.editSelectedSong) window.moduleRegistry.songManagement.editSelectedSong();
    });
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 5000 });

    const endInput = page.locator('#song-form-end-time');
    await endInput.click();
    await endInput.fill('0:02');
    await page.locator('#songFormSubmitButton').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });

    // Search and play
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    await rows.first().dblclick();

    // Wait for playback to start
    await expect(page.locator('#pause_button')).toBeVisible({ timeout: 5000 });

    // Wait for playback to stop (end point should trigger stop within ~3 seconds)
    await expect(page.locator('#play_button')).toBeVisible({ timeout: 8000 });

    console.log('✅ Playback stopped at end point');

    // Clean up: remove end time
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    await rows.first().click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      if (typeof window.editSelectedSong === 'function') window.editSelectedSong();
      else if (window.moduleRegistry?.songManagement?.editSelectedSong) window.moduleRegistry.songManagement.editSelectedSong();
    });
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 5000 });
    const endInput2 = page.locator('#song-form-end-time');
    await endInput2.click();
    await endInput2.fill('');
    await page.locator('#songFormSubmitButton').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('per-track volume affects playback volume', async () => {
    // Set volume to 50% and verify it's stored in shared state during playback
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // Edit song to set volume to 50
    await rows.first().click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      if (typeof window.editSelectedSong === 'function') window.editSelectedSong();
      else if (window.moduleRegistry?.songManagement?.editSelectedSong) window.moduleRegistry.songManagement.editSelectedSong();
    });
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 5000 });

    await page.locator('#song-form-volume').evaluate((el) => {
      el.value = 50;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#songFormSubmitButton').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });

    // Play the song and check trackVolume in shared state
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    await rows.first().dblclick();

    await expect(page.locator('#pause_button')).toBeVisible({ timeout: 5000 });

    // Verify trackVolume was set in shared state
    const trackVolume = await page.evaluate(() => {
      return window.sharedState?.get('trackVolume');
    });
    expect(trackVolume).toBe(0.5);

    console.log('✅ Per-track volume correctly set to 0.5 during playback');

    // Stop and clean up
    await page.locator('#stop_button').click();

    // Reset volume to 100
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    await rows.first().click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      if (typeof window.editSelectedSong === 'function') window.editSelectedSong();
      else if (window.moduleRegistry?.songManagement?.editSelectedSong) window.moduleRegistry.songManagement.editSelectedSong();
    });
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 5000 });
    await page.locator('#song-form-volume').evaluate((el) => {
      el.value = 100;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#songFormSubmitButton').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Audio Enhancements - crossfade preference', () => {
  let app; let page;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

    ({ app, page } = await launchSeededApp(electron, 'audio-crossfade'));

    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    await page.bringToFront();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('crossfade preference field exists in preferences modal', async () => {
    // Open preferences
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });

    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });

    // Verify crossfade field exists
    await expect(page.locator('#preferences-crossfade-seconds')).toBeVisible();

    // Default should be 0 or empty
    const value = await page.locator('#preferences-crossfade-seconds').inputValue();
    expect(value === '' || value === '0').toBeTruthy();

    console.log('✅ Crossfade preference field present in preferences modal');

    await page.locator('#preferencesModal .btn-close').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('crossfade preference persists after save', async () => {
    // Open preferences
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });

    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#preferences-database-directory')).toHaveValue(/.+/, { timeout: 5000 });

    // Set crossfade to 5 seconds
    const crossfadeInput = page.locator('#preferences-crossfade-seconds');
    await crossfadeInput.click();
    await crossfadeInput.evaluate((el) => {
      el.value = '5';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(crossfadeInput).toHaveValue('5');

    // Save
    await page.locator('#preferencesSubmitButton').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible({ timeout: 5000 });

    // Reopen and verify
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });

    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#preferences-database-directory')).toHaveValue(/.+/, { timeout: 5000 });

    await expect(page.locator('#preferences-crossfade-seconds')).toHaveValue('5');

    console.log('✅ Crossfade preference persists after save and reopen');

    await page.locator('#preferencesModal .btn-close').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible({ timeout: 5000 });
  });

  test('crossfade value is cached in shared state on song play', async () => {
    // First set crossfade preference
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });
    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#preferences-database-directory')).toHaveValue(/.+/, { timeout: 5000 });

    const crossfadeInput = page.locator('#preferences-crossfade-seconds');
    await crossfadeInput.click();
    await crossfadeInput.evaluate((el) => {
      el.value = '3';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.locator('#preferencesSubmitButton').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible({ timeout: 5000 });

    // Play a song
    const searchInput = page.locator('#omni_search');
    await searchInput.click();
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    await rows.first().dblclick();

    await expect(page.locator('#pause_button')).toBeVisible({ timeout: 5000 });

    // Verify crossfade seconds cached in shared state
    const cachedCrossfade = await page.evaluate(() => {
      return window.sharedState?.get('crossfadeSeconds');
    });
    expect(cachedCrossfade).toBe(3);

    console.log('✅ Crossfade value cached in shared state on song play');

    await page.locator('#stop_button').click();
  });
});

test.describe('Audio Enhancements - database migration', () => {
  let app; let page;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

    ({ app, page } = await launchSeededApp(electron, 'audio-migration'));

    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('existing songs have new columns with correct defaults', async () => {
    // Verify migration ran by checking that a song has the new columns with defaults
    const song = await page.evaluate(async () => {
      const api = window.secureElectronAPI?.database || window.electronAPI?.database;
      if (!api?.getSongById) return null;
      const result = await api.getSongById('1001');
      if (result?.success && result?.data?.length > 0) {
        const s = result.data[0];
        return {
          hasVolume: 'volume' in s,
          hasStartTime: 'start_time' in s,
          hasEndTime: 'end_time' in s,
          volume: s.volume,
          start_time: s.start_time,
          end_time: s.end_time
        };
      }
      return null;
    });

    expect(song).not.toBeNull();
    expect(song.hasVolume).toBe(true);
    expect(song.hasStartTime).toBe(true);
    expect(song.hasEndTime).toBe(true);
    expect(song.volume).toBe(100);       // Default volume
    expect(song.start_time).toBeNull();   // No start trim
    expect(song.end_time).toBeNull();     // No end trim

    console.log('✅ Database migration verified: new columns exist with correct defaults');
  });
});
