import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';

test.describe("What's New Tour", () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'whats-new-tour'));
    await waitForAppReady(page, app);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test("What's New module is loaded in module registry", async () => {
    const hasModule = await page.evaluate(() => !!window.moduleRegistry?.whatsNew);
    expect(hasModule).toBe(true);
  });

  test('Tour can be launched on demand via showWhatsNew', async () => {
    // Clear tours_seen so the tour will run
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('tours_seen', []);
    });

    // Launch tour via module registry
    const launched = await page.evaluate(async () => {
      if (window.moduleRegistry?.whatsNew?.showWhatsNew) {
        await window.moduleRegistry.whatsNew.showWhatsNew();
        return true;
      }
      return false;
    });

    expect(launched).toBe(true);

    // Driver.js overlay should be visible
    const overlay = page.locator('.driver-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Popover should show the first step
    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });
  });

  test('Tour can be dismissed with close button', async () => {
    // Launch a fresh tour
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('tours_seen', []);
      if (window.moduleRegistry?.whatsNew?.showWhatsNew) {
        await window.moduleRegistry.whatsNew.showWhatsNew();
      }
    });

    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    const closeBtn = page.locator('.driver-popover-close-btn');
    await closeBtn.click();

    const overlay = page.locator('.driver-overlay');
    await expect(overlay).not.toBeVisible({ timeout: 3000 });
  });

  test('Tour steps can be navigated with Next button', async () => {
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('tours_seen', []);
    });

    await page.evaluate(async () => {
      if (window.moduleRegistry.whatsNew?.showWhatsNew) {
        await window.moduleRegistry.whatsNew.showWhatsNew();
      }
    });

    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    const nextBtn = page.locator('.driver-popover-next-btn');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await expect(popover).toBeVisible();
    }

    const closeBtn = page.locator('.driver-popover-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('Adaptive theming applies correct class', async () => {
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('tours_seen', []);
      if (window.moduleRegistry.whatsNew?.showWhatsNew) {
        await window.moduleRegistry.whatsNew.showWhatsNew();
      }
    });

    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    const hasThemeClass = await page.evaluate(() => {
      const el = document.querySelector('.driver-popover');
      return el?.classList.contains('driver-popover-dark') || el?.classList.contains('driver-popover-light');
    });
    expect(hasThemeClass).toBe(true);

    const closeBtn = page.locator('.driver-popover-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('tour-opened preferences preserve shared directory settings on save', async () => {
    const originalDirectories = await page.evaluate(async () => {
      const [database, music, hotkey] = await Promise.all([
        window.secureElectronAPI.store.get('database_directory'),
        window.secureElectronAPI.store.get('music_directory'),
        window.secureElectronAPI.store.get('hotkey_directory')
      ]);

      return {
        database: database.value,
        music: music.value,
        hotkey: hotkey.value
      };
    });

    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('tours_seen', []);
      // The 4.3.0 tour is the one with a step that opens Preferences
      await window.moduleRegistry.whatsNew.tourManager.launchTour('4.3.0', { markSeen: false });
    });

    // Advance through the tour until the Preferences modal opens. Each "Next"
    // click kicks off an async transition (modal open/close + DOM-settle waits)
    // during which Driver.js keeps the Next button clickable and the popover on
    // the *current* step. A fixed delay races under CI load: if the transition
    // outlasts the delay, the loop clicks Next again and overshoots the
    // preferences step (eventually tearing the tour down, which closes the
    // modal). Instead, wait for a deterministic signal that the transition
    // finished — the popover title advancing, or the modal appearing — before
    // re-evaluating, so we never click Next mid-transition.
    const popoverTitle = page.locator('.driver-popover-title');
    for (let step = 0; step < 8; step += 1) {
      if (await page.locator('#preferencesModal').isVisible()) {
        break;
      }

      const previousTitle = await popoverTitle.textContent();
      const nextBtn = page.locator('.driver-popover-next-btn');
      await expect(nextBtn).toBeVisible({ timeout: 5000 });
      await nextBtn.click();

      await expect
        .poll(async () => {
          if (await page.locator('#preferencesModal').isVisible()) return '__modal__';
          return popoverTitle.textContent();
        }, { timeout: 15_000 })
        .not.toBe(previousTitle);
    }

    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#preferences-database-directory')).toHaveValue(originalDirectories.database, { timeout: 5000 });
    await expect(page.locator('#preferences-song-directory')).toHaveValue(originalDirectories.music, { timeout: 5000 });
    await expect(page.locator('#preferences-hotkey-directory')).toHaveValue(originalDirectories.hotkey, { timeout: 5000 });

    const closeBtn = page.locator('.driver-popover-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(page.locator('.driver-overlay')).not.toBeVisible({ timeout: 5000 });
    }

    await page.locator('#preferencesSubmitButton').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible({ timeout: 5000 });

    const savedDirectories = await page.evaluate(async () => {
      const [database, music, hotkey] = await Promise.all([
        window.secureElectronAPI.store.get('database_directory'),
        window.secureElectronAPI.store.get('music_directory'),
        window.secureElectronAPI.store.get('hotkey_directory')
      ]);

      return {
        database: database.value,
        music: music.value,
        hotkey: hotkey.value
      };
    });

    expect(savedDirectories).toEqual(originalDirectories);

  });

  test('blank directory inputs do not wipe shared settings on save', async () => {
    const originalDirectories = await page.evaluate(async () => {
      const [database, music, hotkey] = await Promise.all([
        window.secureElectronAPI.store.get('database_directory'),
        window.secureElectronAPI.store.get('music_directory'),
        window.secureElectronAPI.store.get('hotkey_directory')
      ]);

      return {
        database: database.value,
        music: music.value,
        hotkey: hotkey.value
      };
    });

    await page.evaluate(async () => {
      if (typeof window.moduleRegistry.preferences.openPreferencesModal === 'function') {
        await window.moduleRegistry.preferences.openPreferencesModal();
      } else if (window.moduleRegistry?.preferences?.openPreferencesModal) {
        await window.moduleRegistry.preferences.openPreferencesModal();
      }
    });

    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#preferences-database-directory')).toHaveValue(originalDirectories.database, { timeout: 5000 });

    await page.locator('#preferences-database-directory').evaluate((el) => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.locator('#preferences-song-directory').evaluate((el) => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.locator('#preferences-hotkey-directory').evaluate((el) => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.locator('#preferencesSubmitButton').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible({ timeout: 5000 });

    const savedDirectories = await page.evaluate(async () => {
      const [database, music, hotkey] = await Promise.all([
        window.secureElectronAPI.store.get('database_directory'),
        window.secureElectronAPI.store.get('music_directory'),
        window.secureElectronAPI.store.get('hotkey_directory')
      ]);

      return {
        database: database.value,
        music: music.value,
        hotkey: hotkey.value
      };
    });

    expect(savedDirectories).toEqual(originalDirectories);
  });

});

// Its own app: the tours above leave dialogs and tour actions in flight, and
// Switch Profile (correctly) won't open over another dialog
test.describe("What's New Tour: next release", () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'whats-new-tour-next'));
    await waitForAppReady(page, app);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('next release tour shows the Switch Profile dialog, then the quit confirmation note', async () => {
    // With one other profile, the real dialog would preselect it
    await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Tour Other', ''));
    await page.evaluate(() => { window.__e2eSessionMarker = 'still-here'; });
    await page.evaluate(() => window.moduleRegistry.whatsNew.tourManager.launchTour('4.4.0', { markSeen: false }));

    const title = page.locator('.driver-popover-title');
    await expect(title).toHaveText('Switch Profiles Instantly', { timeout: 5000 });
    await expect(page.locator('#profileSwitchModal')).toBeVisible();
    // The tour ignores Next while a step's open/close action is still running
    await page.waitForFunction(() => !window.moduleRegistry.whatsNew.tourManager._transitioning);

    // A preview: nothing selected, and Enter during the tour can't switch
    // profiles. The tour focuses Next, so Enter advances it instead.
    await expect(page.locator('#profileSwitchModal #launch-btn')).toHaveText('Switch');
    await expect(page.locator('.driver-popover-next-btn')).toBeFocused({ timeout: 5000 });
    await page.keyboard.press('Enter');
    await expect(title).toHaveText('Closing the Window Asks First', { timeout: 5000 });
    expect(await page.evaluate(() => window.__e2eSessionMarker)).toBe('still-here');
    await expect(page.locator('#profileSwitchModal')).toBeHidden();

    for (const expected of ['Your Layout Is Now a Show', 'The Shows Menu', 'Which Show Is Loaded', 'Color-Code Your Shows', "See What You've Played", "Copy Someone's Show", 'Tab Actions Moved']) {
      await page.waitForFunction(() => !window.moduleRegistry.whatsNew.tourManager._transitioning);
      await page.locator('.driver-popover-next-btn').click();
      await expect(title).toHaveText(expected, { timeout: 5000 });
    }

    await page.locator('.driver-popover-close-btn').click();
    await expect(page.locator('.driver-overlay')).not.toBeVisible({ timeout: 3000 });
  });
});
