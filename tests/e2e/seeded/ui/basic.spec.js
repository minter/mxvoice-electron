import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

// UI tests: keep to pure UI wiring and states; avoid keyboard/playback/search flows covered elsewhere

test.describe('UI - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
    } catch {}

    ({ app, page } = await launchSeededApp(electron, 'ui'));

    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    await page.bringToFront();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('core layout renders expected regions and controls', async () => {
    await expect(page.locator('#omni_search')).toBeVisible();
    // Table may be hidden until results; just ensure it exists in DOM
    await expect(page.locator('#search_results')).toBeAttached();
    await expect(page.locator('#holding-tank-column')).toBeVisible();
    await expect(page.locator('#hotkeys-column')).toBeVisible();
    await expect(page.locator('#hotkey_tabs')).toBeVisible();
    await expect(page.locator('#advanced_search_button')).toBeVisible();
    // Waveform element present in DOM (may be hidden)
    await expect(page.locator('#waveform')).toBeAttached();
    await expect(page.locator('#play_button')).toBeVisible();
    // Pause button exists but is hidden until playing (Bootstrap d-none class)
    await expect(page.locator('#pause_button')).toBeAttached();
    await expect(page.locator('#stop_button')).toBeVisible();
  });

  test('initial control states (enabled/disabled/visibility)', async () => {
    // Play and Stop should start disabled; Pause is hidden (bootstrap d-none)
    await expect(page.locator('#play_button')).toBeDisabled();
    await expect(page.locator('#stop_button')).toBeDisabled();
    // Pause button exists but is hidden by CSS class d-none until playing
    const pauseHasDNone = await page.locator('#pause_button').evaluate((el) => el.classList.contains('d-none'));
    expect(pauseHasDNone).toBeTruthy();
  });

  test('advanced search toggle updates panel, focus, and aria state', async () => {
    const btn = page.locator('#advanced_search_button');
    const panel = page.locator('#advanced-search');
    const omni = page.locator('#omni_search');
    const title = page.locator('#title-search');

    // Initial: panel hidden, btn aria-expanded=false, omni visible, title hidden
    await expect(panel).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(omni).toBeVisible();
    await expect(title).toBeHidden();

    // Click to open advanced search
    await btn.click();
    await page.waitForTimeout(100);

    // Wait for animation + state
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await expect(omni).toBeHidden();
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();

    // Click to close advanced search
    await btn.click();
    await page.waitForTimeout(100);

    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await expect(omni).toBeVisible();
    await expect(omni).toBeFocused();
    await expect(title).toBeHidden();
  });

  test('waveform toggle shows and hides waveform element', async () => {
    const waveform = page.locator('#waveform');
    const button = page.locator('#waveform_button');

    // Initial state: element exists and is hidden via class 'hidden'
    const initiallyHidden = await waveform.evaluate((el) => el.classList.contains('hidden'));
    console.log('Initial waveform hidden state:', initiallyHidden);
    expect(initiallyHidden).toBe(true); // Should start hidden

    // Toggle ON: should show waveform and button should get 'active' class
    await button.click();
    await page.waitForTimeout(500); // Wait for fade-in animation to complete
    const afterFirstToggleHidden = await waveform.evaluate((el) => el.classList.contains('hidden'));
    const buttonActive = await button.evaluate((el) => el.classList.contains('active'));
    console.log('After first toggle - hidden:', afterFirstToggleHidden, 'button active:', buttonActive);
    expect(afterFirstToggleHidden).toBe(false); // Should be visible
    expect(buttonActive).toBe(true); // Button should be active

    // Toggle OFF: should hide waveform and button should lose 'active' class
    await button.click();
    // Wait much longer for fade-out animation to complete and hidden class to be added
    await page.waitForTimeout(2000); // Increased timeout for fade-out animation
    const afterSecondToggleHidden = await waveform.evaluate((el) => el.classList.contains('hidden'));
    const buttonActiveAfter = await button.evaluate((el) => el.classList.contains('active'));
    console.log('After second toggle - hidden:', afterSecondToggleHidden, 'button active:', buttonActiveAfter);
    expect(afterSecondToggleHidden).toBe(true); // Should be hidden again
    expect(buttonActiveAfter).toBe(false); // Button should not be active

    // Verify we returned to initial state
    expect(afterSecondToggleHidden).toBe(initiallyHidden);
    console.log('Waveform toggle working correctly - shows and hides with proper button state changes');
  });

  test('window resize keeps primary regions visible', async () => {
    // Shrink window
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setSize(900, 600);
    });
    await page.waitForTimeout(200);

    // Assert critical regions still visible/attached
    await expect(page.locator('#omni_search')).toBeVisible();
    await expect(page.locator('#holding-tank-column')).toBeVisible();
    await expect(page.locator('#hotkeys-column')).toBeVisible();
    await expect(page.locator('#search_results')).toBeAttached();

    // Grow window back
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setSize(1200, 800);
    });
    await page.waitForTimeout(200);

    // Regions remain visible/attached
    await expect(page.locator('#omni_search')).toBeVisible();
    await expect(page.locator('#search_results')).toBeAttached();
  });
});


