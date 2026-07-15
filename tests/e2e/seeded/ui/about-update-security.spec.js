import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';

test.describe('About and update security boundaries', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'about-update-security'));
    await waitForAppReady(page, app);
  });

  test.afterAll(async () => {
    await app.evaluate(({ shell }) => {
      if (globalThis.__restoreAboutOpenExternal) globalThis.__restoreAboutOpenExternal();
    }).catch(() => {});
    await closeApp(app);
  });

  test('main renderer exposes only the context-isolated preload API', async () => {
    const boundary = await page.evaluate(() => ({
      requireType: typeof window.require,
      processType: typeof window.process,
      hasSecureApi: !!window.secureElectronAPI,
      hasRawIpcRenderer: !!window.electron?.ipcRenderer
    }));

    expect(boundary).toEqual({
      requireType: 'undefined',
      processType: 'undefined',
      hasSecureApi: true,
      hasRawIpcRenderer: false
    });
  });

  test('About window is sandboxed and only opens allowlisted external URLs', async () => {
    await app.evaluate(({ shell }) => {
      const original = shell.openExternal;
      globalThis.__aboutOpenedUrls = [];
      globalThis.__restoreAboutOpenExternal = () => { shell.openExternal = original; };
      shell.openExternal = async (url) => {
        globalThis.__aboutOpenedUrls.push(url);
      };
    });

    const windowPromise = app.waitForEvent('window', { timeout: 10000 });
    await app.evaluate(() => globalThis.__e2eShowAboutDialog());
    const aboutPage = await windowPromise;
    await aboutPage.waitForLoadState('domcontentloaded');

    await expect(aboutPage.locator('h1')).toContainText('Mx. Voice');
    await expect(aboutPage.locator('.version')).toContainText('Version');

    const security = await app.evaluate(({ BrowserWindow }) => {
      const about = BrowserWindow.getAllWindows().find(win => win.getTitle().startsWith('About '));
      const prefs = about?.webContents.getLastWebPreferences();
      return {
        sandbox: prefs?.sandbox,
        contextIsolation: prefs?.contextIsolation,
        nodeIntegration: prefs?.nodeIntegration
      };
    });
    expect(security).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });

    const rendererBoundary = await aboutPage.evaluate(() => ({
      requireType: typeof window.require,
      processType: typeof window.process,
      apiKeys: Object.keys(window.aboutAPI || {}).sort()
    }));
    expect(rendererBoundary).toEqual({
      requireType: 'undefined',
      processType: 'undefined',
      apiKeys: ['closeWindow', 'openExternal']
    });

    await aboutPage.locator('#website-link').click();
    await expect.poll(() => app.evaluate(() => globalThis.__aboutOpenedUrls)).toEqual([
      'https://mxvoice.app/'
    ]);

    await aboutPage.evaluate(() => window.aboutAPI.openExternal('https://evil.example/phishing'));
    await aboutPage.waitForTimeout(100);
    expect(await app.evaluate(() => globalThis.__aboutOpenedUrls)).toEqual([
      'https://mxvoice.app/'
    ]);

    await aboutPage.locator('#docs-link').click();
    await expect.poll(() => app.evaluate(() => globalThis.__aboutOpenedUrls)).toEqual([
      'https://mxvoice.app/',
      'https://mxvoice.app/docs/'
    ]);

    await aboutPage.locator('#close-btn').click();
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => (
      BrowserWindow.getAllWindows().filter(win => win.getTitle().startsWith('About ')).length
    ))).toBe(0);
  });

  test('release notes cross IPC and are sanitized before rendering', async () => {
    await page.evaluate(() => { delete window.__releaseNotesXss; });
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(candidate => !candidate.getTitle().startsWith('About '));
      win.webContents.send(
        'display_release_notes',
        '9.9.9-test',
        '<h2>Safe heading</h2><img src=x onerror="window.__releaseNotesXss=true"><script>window.__releaseNotesXss=true</script><a href="javascript:alert(1)">unsafe link</a>'
      );
    });

    const modal = page.locator('#newReleaseModal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('.modal-title')).toHaveText('Update Available: 9.9.9-test');
    await expect(modal.locator('.modal-body')).toContainText('Safe heading');
    await expect(modal.locator('.modal-body script, .modal-body img')).toHaveCount(0);
    await expect(modal.locator('.modal-body a')).not.toHaveAttribute('href', /javascript:/i);
    expect(await page.evaluate(() => window.__releaseNotesXss)).toBeUndefined();

    await modal.locator('.btn-close').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('mocked updater states render download, ready, install, and failure feedback', async () => {
    const result = await page.evaluate(async () => {
      const update = await import('./renderer/modules/file-operations/system-operations.js');
      const installButton = document.getElementById('installNowBtn');
      const modalBody = document.querySelector('#newReleaseModal .modal-body');
      installButton.disabled = false;
      installButton.textContent = 'Install Now';
      modalBody.innerHTML = '';

      let installCalls = 0;
      const successfulApi = {
        downloadUpdate: async () => ({ success: true }),
        installUpdate: async () => {
          installCalls += 1;
          return { success: true };
        }
      };

      const started = await update.startUpdateProcess({ fileOperations: successfulApi });
      update.handleDownloadProgress({ percent: 42, transferred: 4 * 1024 * 1024, total: 10 * 1024 * 1024 });
      const progressText = installButton.textContent;
      await update.handleUpdateReady('9.9.9-test', {
        fileOperations: successfulApi,
        countdownSeconds: 0,
        countdownDelayMs: 0
      });
      const readyText = installButton.textContent;

      installButton.disabled = false;
      installButton.textContent = 'Install Now';
      modalBody.innerHTML = '';
      const failed = await update.startUpdateProcess({
        fileOperations: {
          downloadUpdate: async () => ({ success: false, error: 'simulated download failure' })
        }
      });

      return {
        started,
        progressText,
        readyText,
        installCalls,
        failed,
        failureButtonText: installButton.textContent,
        failureText: modalBody.textContent
      };
    });

    expect(result.started).toEqual({ success: true });
    expect(result.progressText).toBe('Downloading... 42% (4.0/10.0 MB)');
    expect(result.readyText).toBe('Restarting now...');
    expect(result.installCalls).toBe(1);
    expect(result.failed).toEqual({ success: false, error: 'simulated download failure' });
    expect(result.failureButtonText).toBe('Try Again');
    expect(result.failureText).toContain('Update failed: simulated download failure');
  });
});
