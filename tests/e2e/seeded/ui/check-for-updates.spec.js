import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';

// Messages the main process would have shown in native message boxes
async function updateMessages(app) {
  return app.evaluate(() => (globalThis.__e2eUpdateMessages ?? []).map(({ message, detail, buttons }) => ({ message, detail, buttons })));
}

test.describe('Check for Updates', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'check-for-updates'));
    await waitForAppReady(page, app);
  });

  test.beforeEach(async () => {
    await app.evaluate(() => { globalThis.__e2eUpdateMessages = []; });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('the menu item runs a check; a build that is not installed says it cannot update', async () => {
    const clicked = await app.evaluate(({ Menu }) => {
      const find = (items) => {
        for (const item of items) {
          if (item.label === 'Check for Updates…') return item;
          const inner = item.submenu && find(item.submenu.items);
          if (inner) return inner;
        }
        return null;
      };
      const item = find(Menu.getApplicationMenu().items);
      item?.click();
      return !!item;
    });
    expect(clicked).toBe(true);

    await expect.poll(() => updateMessages(app)).toEqual([
      expect.objectContaining({ message: "Can't check for updates" }),
    ]);
  });

  test('says the user is up to date when no newer version is offered', async () => {
    const version = await app.evaluate(({ app: electronApp }) => electronApp.getVersion());

    await expect(app.evaluate(() => globalThis.__e2eManualUpdate(null))).resolves.toBe('up-to-date');

    expect(await updateMessages(app)).toEqual([
      expect.objectContaining({ message: "You're up to date", detail: `Mx. Voice ${version} is the newest version available.` }),
    ]);
    await expect(page.locator('#newReleaseModal')).not.toBeVisible();
  });

  test('a found update opens the release-notes modal, not the quiet indicator', async () => {
    await expect(app.evaluate(() => globalThis.__e2eManualUpdate({
      version: '9.9.20', releaseName: '9.9.20', releaseNotes: '<h2>Manual notes</h2>',
    }))).resolves.toBe('available');

    const modal = page.locator('#newReleaseModal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('.modal-title')).toHaveText('Update Available: 9.9.20');
    await expect(modal.locator('.modal-body')).toContainText('Manual notes');
    await expect(page.locator('#update_available_button')).toBeHidden();
    expect(await updateMessages(app)).toEqual([]);

    await modal.locator('.btn-close').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('a downloaded update is offered for install, and Later keeps the app running', async () => {
    await app.evaluate(() => globalThis.__e2eUpdateDownloaded({ version: '9.9.20' }));

    await expect(app.evaluate(() => globalThis.__e2eManualUpdate(null))).resolves.toBe('downloaded');

    expect(await updateMessages(app)).toEqual([
      expect.objectContaining({ message: 'Mx. Voice 9.9.20 is ready to install', buttons: ['Restart and Install', 'Later'] }),
    ]);
    await expect(page.locator('#newReleaseModal')).not.toBeVisible();
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBeGreaterThan(0);
  });
});
