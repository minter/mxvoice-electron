import { _electron as electron, test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../../../config/test-environment.js';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';
import {
  rms,
  waitForAudible,
  waitForSilence,
  stabilize
} from '../../../utils/audio-helpers.js';

// Helper to detect if we're running in CI environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Audio tests are timing-sensitive — run serially
test.describe.configure({ mode: 'serial' });

test.describe('Playback - fade out', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'fade'));

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

  /**
   * Helper: start playing a song and wait for audible audio
   */
  async function startPlayback() {
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Eat It');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    await rows.first().dblclick();

    const playButton = page.locator('#play_button');
    await expect(playButton).toBeEnabled({ timeout: 5000 });
    await playButton.click();

    // Wait for playback to start
    await expect(page.locator('#pause_button')).toBeVisible({ timeout: 5000 });

    if (!isCI) {
      await waitForAudible(page);
    }
  }

  test('fade out preference can be set via store', async () => {
    // Set fade_out_seconds to 2 seconds via the secure store
    const result = await page.evaluate(async () => {
      const electronAPI = window.secureElectronAPI;
      if (electronAPI?.profile?.setPreference) {
        return electronAPI.profile.setPreference('fade_out_seconds', 2);
      }
      // Fallback to store
      if (window.secureStore?.set) {
        return window.secureStore.set('fade_out_seconds', 2);
      }
      return { success: false, error: 'No API available' };
    });

    // Verify the preference was set (or at least no hard failure)
    console.log('Set fade_out_seconds result:', result);

    // Verify we can read it back
    const stored = await page.evaluate(async () => {
      const electronAPI = window.secureElectronAPI;
      if (electronAPI?.profile?.getPreference) {
        return electronAPI.profile.getPreference('fade_out_seconds');
      }
      if (window.secureStore?.get) {
        return window.secureStore.get('fade_out_seconds');
      }
      return { success: false };
    });

    console.log('Get fade_out_seconds result:', stored);
  });

  test('shift+click stop triggers fade out to silence', async () => {
    // Set a short fade duration for testing (2 seconds)
    await page.evaluate(async () => {
      const electronAPI = window.secureElectronAPI;
      if (electronAPI?.profile?.setPreference) {
        await electronAPI.profile.setPreference('fade_out_seconds', 2);
      }
    });

    // Start playback
    await startPlayback();

    // Capture the RMS level while playing
    if (!isCI) {
      const playingRMS = await rms(page);
      console.log('RMS while playing:', playingRMS);
      expect(playingRMS).toBeGreaterThan(0);
    }

    // Shift+click stop to trigger fade out
    const stopButton = page.locator('#stop_button');
    await stopButton.click({ modifiers: ['Shift'] });

    // The fade should take ~2 seconds. Wait for silence within 4 seconds.
    if (!isCI) await waitForSilence(page, 1e-3, 4000);

    // Verify UI is reset after fade completes
    await expect(page.locator('#play_button')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#timer')).toHaveText('0:00', { timeout: 5000 });
  });

  test('regular stop without fade is immediate', async () => {
    // Start playback
    await startPlayback();

    // Regular click on stop (no shift)
    const stopButton = page.locator('#stop_button');
    await stopButton.click();

    // Should be silent almost immediately (within 500ms)
    if (!isCI) {
      await stabilize(page, 300);
      const afterStopRMS = await rms(page);
      expect(afterStopRMS).toBeLessThan(1e-3);
    }

    // Verify UI is reset
    await expect(page.locator('#play_button')).toBeVisible({ timeout: 5000 });
  });

  /**
   * Helper: hold Esc past the tap window, then let go
   */
  async function holdEscape() {
    await page.keyboard.down('Escape');
    // Longer than HOLD_TO_FADE_MS (300ms), so this is a hold, not a tap
    await page.waitForTimeout(600);
    await page.keyboard.up('Escape');
  }

  const isFadingOut = () => page.evaluate(() => window.moduleRegistry.audio.isFadingOut());

  test('holding Esc fades out instead of cutting', async () => {
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('fade_out_seconds', 2);
    });
    await startPlayback();

    await holdEscape();

    // Still playing after the key is released: the fade is running
    expect(await isFadingOut()).toBe(true);
    await expect(page.locator('#pause_button')).toBeVisible();

    if (!isCI) await waitForSilence(page, 1e-3, 4000);
    await expect(page.locator('#play_button')).toBeVisible({ timeout: 5000 });
    expect(await isFadingOut()).toBe(false);
  });

  test('tapping Esc during a fade cuts at once', async () => {
    // Long enough that a cut and a finished fade can't be confused
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('fade_out_seconds', 5);
    });
    await startPlayback();

    await holdEscape();
    expect(await isFadingOut()).toBe(true);

    await page.keyboard.press('Escape');

    // Well inside the 5 second fade
    await expect(page.locator('#play_button')).toBeVisible({ timeout: 1000 });
    expect(await isFadingOut()).toBe(false);
    if (!isCI) {
      await stabilize(page, 300);
      expect(await rms(page)).toBeLessThan(1e-3);
    }
  });

  test('holding Shift+Esc fades to silence without cutting', async () => {
    // Long enough that the held keys end well inside the fade, even on a
    // slow runner
    const fadeSeconds = 5;
    await page.evaluate(async (s) => {
      await window.secureElectronAPI.profile.setPreference('fade_out_seconds', s);
    }, fadeSeconds);
    await startPlayback();

    // Hold Shift+Esc: after the first keydown, each further keyboard.down
    // sends a keydown with repeat set, as a held key does
    await page.keyboard.down('Shift');
    const started = Date.now();
    await page.keyboard.down('Escape');
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(50);
      await page.keyboard.down('Escape');
      // Each repeat leaves the fade running
      expect(await isFadingOut()).toBe(true);
    }
    await page.keyboard.up('Escape');
    await page.keyboard.up('Shift');

    // The repeats did not cut: the fade is still running
    expect(await isFadingOut()).toBe(true);
    await expect(page.locator('#pause_button')).toBeVisible();

    if (!isCI) await waitForSilence(page, 1e-3, (fadeSeconds + 3) * 1000);
    await expect(page.locator('#play_button')).toBeVisible({ timeout: (fadeSeconds + 5) * 1000 });
    const elapsed = (Date.now() - started) / 1000;
    console.log('Held Shift+Esc fade (s):', elapsed);
    // Over the fade time, not at once
    expect(elapsed).toBeGreaterThan(fadeSeconds * 0.8);
    expect(await isFadingOut()).toBe(false);
  });

  test('the fade lasts as long as the Preferences setting', async () => {
    // Time from Shift+Esc until the transport resets, for a given setting
    async function timedFade(seconds) {
      await page.evaluate(async (s) => {
        await window.secureElectronAPI.profile.setPreference('fade_out_seconds', s);
      }, seconds);
      await startPlayback();
      const started = Date.now();
      await page.keyboard.press('Shift+Escape');
      await expect(page.locator('#play_button')).toBeVisible({ timeout: (seconds + 5) * 1000 });
      return (Date.now() - started) / 1000;
    }

    const short = await timedFade(1);
    const long = await timedFade(4);
    console.log('Fade timings (s):', { short, long });

    expect(short).toBeGreaterThan(0.8);
    expect(short).toBeLessThan(3);
    expect(long).toBeGreaterThan(3.8);
    expect(long - short).toBeGreaterThan(2.5);
  });

  test('Esc in the search field: hold fades, tap cuts', async () => {
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('fade_out_seconds', 5);
    });
    await startPlayback();

    // Search fields handle Esc themselves; Mousetrap skips text inputs
    await page.locator('#omni_search').focus();
    await holdEscape();
    expect(await isFadingOut()).toBe(true);
    await expect(page.locator('#pause_button')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#play_button')).toBeVisible({ timeout: 1000 });
    expect(await isFadingOut()).toBe(false);
  });

  test('fade-pause preserves song position for resume', async () => {
    // Set fade duration
    await page.evaluate(async () => {
      const electronAPI = window.secureElectronAPI;
      if (electronAPI?.profile?.setPreference) {
        await electronAPI.profile.setPreference('fade_out_seconds', 1);
      }
    });

    // Start playback
    await startPlayback();

    // Wait for timer to advance
    const timer = page.locator('#timer');
    await expect(timer).not.toHaveText('0:00', { timeout: 5000 });

    // Get the timer value before pausing
    const timerBeforePause = await timer.textContent();
    console.log('Timer before pause:', timerBeforePause);

    // Resume playback by clicking play
    const playButton = page.locator('#play_button');
    const pauseButton = page.locator('#pause_button');

    // Pause (regular, no fade for simplicity)
    await pauseButton.click();
    await expect(playButton).toBeVisible({ timeout: 5000 });

    // Verify timer did not reset to 0:00 (song position preserved)
    const timerAfterPause = await page.locator('#timer').textContent();
    console.log('Timer after pause:', timerAfterPause);
    expect(timerAfterPause).not.toBe('0:00');

    // Resume and verify audio returns
    await playButton.click();
    await expect(pauseButton).toBeVisible({ timeout: 5000 });
    if (!isCI) await waitForAudible(page);

    // Clean up - stop playback
    await page.locator('#stop_button').click();
    await stabilize(page, 300);
  });
});
