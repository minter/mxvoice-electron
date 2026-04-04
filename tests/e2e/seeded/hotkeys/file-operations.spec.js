import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, performEmptySearch } from '../../../utils/seeded-launch.js';
import { TEST_CONFIG } from '../../../config/test-environment.js';
import fs from 'fs';
import path from 'node:path';
import os from 'os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Hotkeys - file operations', () => {
  let app; let page; let suiteMusicDir; let suiteRoot;
  let tempDir;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for hotkey file-ops tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

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
      () => window.moduleRegistry?.hotkeys && typeof window.populateHotkeys === 'function',
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

    // Click the load hotkey button
    await page.locator('#hotkey-load-btn').click();

    // Wait for the fkey_load IPC to be processed
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

  test('save hotkeys to .mrv file writes correct format', async () => {
    // First, assign some songs to hotkeys via drag-drop evaluate
    await performEmptySearch(page);

    // Assign song 1002 to F5 in active tab
    await page.evaluate(({ songId }) => {
      const target = document.querySelector('#hotkeys_list_1 #f5_hotkey');
      if (!target) return;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', songId);
      target.dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer,
      }));
    }, { songId: '1002' });

    // Wait for the drop to be processed
    await expect(page.locator('#hotkeys_list_1 #f5_hotkey')).toHaveAttribute('songid', '1002', { timeout: 5000 });

    // Set up save dialog stub
    const outputPath = path.join(tempDir, 'saved-hotkeys.mrv');
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showSaveDialog;
      globalThis.__restoreHotkeySaveDialog = () => (dialog.showSaveDialog = original);
    });
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: filePath,
      });
    }, outputPath);

    // Click the save hotkey button
    await page.locator('#hotkey-save-btn').click();

    // Wait for file to be written
    await expect.poll(() => fs.existsSync(outputPath), { timeout: 10000 }).toBe(true);

    // Read and verify the file content
    const content = fs.readFileSync(outputPath, 'utf-8');
    console.log('Saved .mrv content:', content);

    // Should contain f1:: through f12:: lines
    expect(content).toContain('f1::');
    expect(content).toContain('f5::');
    expect(content).toContain('f12::');

    // F5 should have song 1002
    const lines = content.split('\n').filter(l => l.trim());
    const f5Line = lines.find(l => l.startsWith('f5::'));
    expect(f5Line).toBeTruthy();
    expect(f5Line).toContain('1002');

    // Restore dialog
    await app.evaluate(() => { globalThis.__restoreHotkeySaveDialog?.(); });
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

    // Click load button
    await page.locator('#hotkey-load-btn').click();

    // Verify F1 is unchanged
    const f1After = await page.locator('#hotkeys_list_1 #f1_hotkey').getAttribute('songid');
    expect(f1After).toBe(f1Before);

    // Restore dialog
    await app.evaluate(() => { globalThis.__restoreHotkeyCancelDialog?.(); });
  });
});
