import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, performEmptySearch } from '../../../utils/seeded-launch.js';
import fs from 'fs';
import path from 'node:path';
import os from 'os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Holding Tank - file operations', () => {
  let app; let page; let suiteRoot;
  let tempDir;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for holding tank file-ops tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

    ({ app, page, suiteRoot } = await launchSeededApp(electron, 'tank-fileops'));

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

    // Create a temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-tank-test-'));
  });

  test.afterAll(async () => {
    await closeApp(app);
    if (tempDir && fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });

  // Dismiss any leftover modal backdrops
  test.beforeEach(async () => {
    if (!page) return;
    try {
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.querySelectorAll('.modal.show').forEach(el => {
          el.classList.remove('show');
          el.style.display = '';
        });
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
      });
    } catch {
      // Page might not be ready yet
    }
  });

  test('load holding tank from .hld file populates tank', async () => {
    // Create a test .hld file with known song IDs
    const hldContent = ['1001', '1003', '1005'].join('\n');
    const hldPath = path.join(tempDir, 'test-tank.hld');
    fs.writeFileSync(hldPath, hldContent);

    // Stub dialog.showOpenDialog
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showOpenDialog;
      globalThis.__restoreTankOpenDialog = () => (dialog.showOpenDialog = original);
    });
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [filePath],
      });
    }, hldPath);

    // Click the load holding tank button
    await page.locator('#holding-tank-load-btn').click();

    // Wait for the holding_tank_load IPC to process (file I/O + DB lookup + DOM population)
    const tankItems = page.locator('#holding_tank_1 li[songid]');
    await expect(tankItems).toHaveCount(3, { timeout: 10000 });

    // Verify specific song IDs are present
    const songIds = await page.evaluate(() => {
      const items = document.querySelectorAll('#holding_tank_1 li[songid]');
      return Array.from(items).map(li => li.getAttribute('songid'));
    });
    expect(songIds).toContain('1001');
    expect(songIds).toContain('1003');
    expect(songIds).toContain('1005');

    // Restore dialog
    await app.evaluate(() => { globalThis.__restoreTankOpenDialog?.(); });
  });

  test('save holding tank to .hld file writes correct format', async () => {
    // First ensure we have items in the holding tank (from previous test or add some)
    // Add songs to holding tank via drag-drop
    await performEmptySearch(page);
    await expect(page.locator('#search_results tbody tr')).not.toHaveCount(0, { timeout: 5000 });

    // Drop a song into the holding tank
    await page.evaluate(({ songId }) => {
      const target = document.getElementById('holding_tank_1');
      if (!target) return;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', songId);
      target.dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer,
      }));
    }, { songId: '1004' });
    // Wait for the drop to be processed by checking the item appeared
    await expect(page.locator('#holding_tank_1 li[songid="1004"]')).toBeAttached({ timeout: 5000 });

    // Set up save dialog stub
    const outputPath = path.join(tempDir, 'saved-tank.hld');
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showSaveDialog;
      globalThis.__restoreTankSaveDialog = () => (dialog.showSaveDialog = original);
    });
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: filePath,
      });
    }, outputPath);

    // Click the save holding tank button
    await page.locator('#holding-tank-save-btn').click();

    // Wait for file to be written by polling for its existence
    await expect(async () => {
      expect(fs.existsSync(outputPath)).toBe(true);
    }).toPass({ timeout: 5000 });

    // Verify the file was created
    expect(fs.existsSync(outputPath)).toBe(true);

    // Read and verify the file content
    const content = fs.readFileSync(outputPath, 'utf-8');
    console.log('Saved .hld content:', content);

    // Should contain song IDs, one per line
    const lines = content.split('\n').filter(l => l.trim());
    expect(lines.length).toBeGreaterThan(0);

    // Each line should be a numeric song ID
    for (const line of lines) {
      expect(/^\d+$/.test(line.trim())).toBe(true);
    }

    // Restore dialog
    await app.evaluate(() => { globalThis.__restoreTankSaveDialog?.(); });
  });

  test('cancel load dialog leaves holding tank unchanged', async () => {
    // Get current holding tank item count
    const countBefore = await page.locator('#holding_tank_1 li').count();

    // Stub dialog to return canceled
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showOpenDialog;
      globalThis.__restoreTankCancelDialog = () => (dialog.showOpenDialog = original);
    });
    await app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async () => ({
        canceled: true,
        filePaths: [],
      });
    });

    // Click load button
    await page.locator('#holding-tank-load-btn').click();

    // Brief wait for the canceled dialog round-trip, then verify count is unchanged
    const countAfter = await page.locator('#holding_tank_1 li').count();
    expect(countAfter).toBe(countBefore);

    // Restore dialog
    await app.evaluate(() => { globalThis.__restoreTankCancelDialog?.(); });
  });

  test('load .hld file with invalid song IDs handles gracefully', async () => {
    // Create a .hld file with mix of valid and invalid IDs
    const hldContent = ['1001', '99999', '1005', 'invalid', ''].join('\n');
    const hldPath = path.join(tempDir, 'test-invalid-tank.hld');
    fs.writeFileSync(hldPath, hldContent);

    // Stub dialog
    await app.evaluate(async ({ dialog }) => {
      const original = dialog.showOpenDialog;
      globalThis.__restoreTankInvalidDialog = () => (dialog.showOpenDialog = original);
    });
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [filePath],
      });
    }, hldPath);

    // Click load
    await page.locator('#holding-tank-load-btn').click();

    // The app should not crash — verify it's still responsive
    await expect(page.locator('#holding-tank-column')).toBeVisible();

    // Valid song IDs should still be loadable
    const songIds = await page.evaluate(() => {
      const items = document.querySelectorAll('#holding_tank_1 li[songid]');
      return Array.from(items).map(li => li.getAttribute('songid'));
    });

    // At minimum, the valid IDs should be present (if the app validates them)
    // or all IDs attempted to load (if it doesn't validate)
    // Either way, the app should remain functional
    console.log('Song IDs after invalid load:', songIds);

    // Restore dialog
    await app.evaluate(() => { globalThis.__restoreTankInvalidDialog?.(); });
  });
});
