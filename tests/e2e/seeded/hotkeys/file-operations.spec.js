import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, performEmptySearch } from '../../../utils/seeded-launch.js';
import { TEST_CONFIG } from '../../../config/test-environment.js';
import fs from 'fs';
import path from 'node:path';
import os from 'os';
import { fileURLToPath } from 'node:url';
import { loadTabFromFile } from '../../../utils/tab-actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Hotkeys - file operations', () => {
  let app; let page; let suiteMusicDir; let suiteRoot;
  let tempDir;

  test.beforeAll(async () => {
    ({ app, page, suiteMusicDir, suiteRoot } = await launchSeededApp(electron, 'hotkey-fileops'));

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

    // Wait for function registry to be properly set up for hotkey loading
    await page.waitForFunction(
      () => window.moduleRegistry?.hotkeys && typeof window.moduleRegistry.hotkeys.populateHotkeys === 'function',
      { timeout: 15000 }
    );

    // Create a temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-hotkey-test-'));
  });

  test.afterAll(async () => {
    await closeApp(app);
    if (tempDir && fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });

  test('load hotkeys from .mrv file populates hotkey slots', async () => {
    // Create a test .mrv file with known song IDs from seeded DB
    const mrvContent = [
      'f1::1001',  // Got The Time
      'f2::1003',  // Greatest American Hero
      'f3::',
      'f4::1005',  // Eat It
      'f5::',
      'f6::',
      'f7::',
      'f8::',
      'f9::',
      'f10::',
      'f11::',
      'f12::',
      'tab_name::Test_Tab'
    ].join('\n');

    const mrvPath = path.join(tempDir, 'test-hotkeys.mrv');
    fs.writeFileSync(mrvPath, mrvContent);

    // Stub dialog.showOpenDialog to return our test file
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showOpenDialog;
      globalThis.__restoreHotkeyOpenDialog = () => (dialog.showOpenDialog = original);
    });
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [filePath],
      });
    }, mrvPath);

    // ⋯ > Load Tab from File…
    await loadTabFromFile(page, 'hotkeys');

    // Wait for the load to be processed
    const f1Hotkey = page.locator('#hotkeys_list_1 #f1_hotkey');
    await expect(f1Hotkey).toHaveAttribute('songid', '1001', { timeout: 5000 });
    const f1SongId = await f1Hotkey.getAttribute('songid');
    expect(f1SongId).toBe('1001');

    // Verify F2 has song 1003 assigned
    const f2SongId = await page.locator('#hotkeys_list_1 #f2_hotkey').getAttribute('songid');
    expect(f2SongId).toBe('1003');

    // Verify F4 has song 1005 assigned
    const f4SongId = await page.locator('#hotkeys_list_1 #f4_hotkey').getAttribute('songid');
    expect(f4SongId).toBe('1005');

    // Verify F3 is empty (no songid or empty)
    const f3SongId = await page.locator('#hotkeys_list_1 #f3_hotkey').getAttribute('songid');
    expect(!f3SongId || f3SongId === '' || f3SongId === 'undefined').toBe(true);

    // Restore dialog
    await app.evaluate(() => { globalThis.__restoreHotkeyOpenDialog?.(); });
  });

  test('cancel load dialog leaves hotkeys unchanged', async () => {
    // Get current F1 songid
    const f1Before = await page.locator('#hotkeys_list_1 #f1_hotkey').getAttribute('songid');

    // Stub dialog to return canceled
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showOpenDialog;
      globalThis.__restoreHotkeyCancelDialog = () => (dialog.showOpenDialog = original);
    });
    await app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async () => ({
        canceled: true,
        filePaths: [],
      });
    });

    // ⋯ > Load Tab from File…; the canceled dialog asks nothing
    await loadTabFromFile(page, 'hotkeys', { confirm: 'none' });

    // Verify F1 is unchanged
    const f1After = await page.locator('#hotkeys_list_1 #f1_hotkey').getAttribute('songid');
    expect(f1After).toBe(f1Before);

    // Restore dialog
    await app.evaluate(() => { globalThis.__restoreHotkeyCancelDialog?.(); });
  });
});
