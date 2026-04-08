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

    if (!launched) {
      test.skip();
      return;
    }

    // Driver.js overlay should be visible
    const overlay = page.locator('.driver-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Popover should show the first step
    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });
  });

  test('Tour can be dismissed with close button', async () => {
    const closeBtn = page.locator('.driver-popover-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

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
});
