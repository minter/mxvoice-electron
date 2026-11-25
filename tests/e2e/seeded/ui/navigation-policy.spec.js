import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

// The main window carries the preload bridge, so it must never leave the
// packaged page. Remote links go to the system browser instead.
test.describe('Main window navigation policy', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'navigation-policy'));
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 20000 });
    // Record what would reach the system browser instead of opening it
    await app.evaluate(({ shell }) => {
      globalThis.__opened = [];
      shell.openExternal = async (url) => { globalThis.__opened.push(url); };
    });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  const opened = () => app.evaluate(() => globalThis.__opened);

  test('a remote link opens in the system browser and the window stays put', async () => {
    const before = page.url();
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = 'https://example.com/release-notes';
      a.textContent = 'notes';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    await expect.poll(opened).toContain('https://example.com/release-notes');
    expect(page.url()).toBe(before);
    expect(app.windows()).toHaveLength(1);
  });

  test('window.open never makes a child window; only http(s) and mailto leave the app', async () => {
    await page.evaluate(() => {
      window.open('https://example.com/popup');
      window.open('javascript:alert(1)');
      window.open('file:///etc/hosts');
      window.open('data:text/html,<script>alert(1)</script>');
      window.open('vbscript:msgbox(1)');
    });
    await expect.poll(opened).toContain('https://example.com/popup');
    // An allowlist, not a list of bad schemes: whatever else was tried, only
    // these schemes may have reached the system browser
    const urls = await opened();
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).toMatch(/^(https?|mailto):/);
    expect(app.windows()).toHaveLength(1);
  });

  test('the page can still reload, even with a fragment in its URL', async () => {
    await page.evaluate(() => { window.__survives = true; location.hash = '#anchor'; });
    await page.evaluate(() => window.location.reload());
    await expect.poll(() => page.evaluate(() => window.__survives ?? 'reloaded').catch(() => 'reloading'))
      .toBe('reloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 20000 });
    expect(page.url()).toMatch(/index\.html/);
  });
});
