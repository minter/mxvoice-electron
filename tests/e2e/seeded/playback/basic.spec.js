import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';
import { 
  rms, 
  waitForAudible, 
  waitForSilence, 
  stabilize
} from '../../../utils/audio-helpers.js';

test.describe('Playback - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for playback tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'playback'));
    
    // Ensure window is visible and focused for reliable input
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    await page.bringToFront();
    await page.click('body');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Give app time to initialize
    await page.waitForTimeout(1500);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  // test('can see audio controls', async () => {
  //   await expect(page.locator('#play_button')).toBeVisible();
  //   await expect(page.locator('#stop_button')).toBeVisible();
  //   await expect(page.locator('#mute_button')).toBeVisible();
  // });

  test('play button starts playback', async () => {
    // Search for "Eat It" song using the correct selector
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Eat It');
    await searchInput.press('Enter'); // Submit the search
    
    // Wait for search results to appear
    await page.waitForTimeout(1000);
    
    // Wait for a single result and double-click it to play via event delegation
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    const songRow = rows.first();
    await songRow.dblclick();
    
    // Wait for the play button to become enabled
    const playButton = page.locator('#play_button');
    await expect(playButton).toBeEnabled({ timeout: 5000 });
    
    // Also click play button (redundant but harmless) in case UI requires it
    if (await playButton.isEnabled()) {
      await playButton.click();
    }
    // Wait a bit for playback to start and UI to update
    await page.waitForTimeout(800);

    // Wait for audio probe to be available
    await page.waitForTimeout(500);

    // Wait for the audio probe to be available (created by the audio module)
    await page.waitForTimeout(1000); // Give time for probe to be created
    
    // Verify audio becomes audible via probe
    await waitForAudible(page);

    // Verify UI reflects playback state
    await expect(page.locator('#pause_button')).toBeVisible();
    await expect(page.locator('#stop_button')).toBeEnabled();
    
    // Mute → silence
    await page.locator('#mute_button').click();
    await stabilize(page, 150);
    await waitForSilence(page);
    
    // Unmute → audible again
    await page.locator('#mute_button').click();
    await waitForAudible(page);
    
    // Volume relationships
    const volumeSlider = page.locator('#volume');
    await volumeSlider.fill('50');
    await stabilize(page, 250);
    const mid = await rms(page);
    await volumeSlider.fill('90');
    await stabilize(page, 250);
    const high = await rms(page);
    await volumeSlider.fill('10');
    await stabilize(page, 250);
    const low = await rms(page);
    expect(high).toBeGreaterThan(mid * 1.1);
    expect(low).toBeLessThan(mid * 0.9);
    
    // Stop playback → silence
    const stopButton = page.locator('#stop_button');
    await stopButton.click();
    await stabilize(page, 150);
    await waitForSilence(page);
  });

  // test('stop button stops playback', async () => {
  //   ...
  // });

  // test('mute button toggles mute state', async () => {
  //   ...
  // });

  // test('volume slider can be adjusted', async () => {
  //   ...
  // });

  // test('audio probe detects audio during playback (diagnostic)', async () => {
  //   ...
  // });
});


