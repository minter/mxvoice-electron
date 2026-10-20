import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, performEmptySearch } from '../../../utils/seeded-launch.js';
import fs from 'fs';
import path from 'node:path';
import os from 'os';
import { fileURLToPath } from 'node:url';
import { importHoldingTankFile } from '../../../utils/show-e2e.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Holding Tank - file operations', () => {
  let app; let page; let suiteRoot;
  let tempDir;

  test.beforeAll(async () => {
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
    await importHoldingTankFile(app);

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
    await importHoldingTankFile(app);

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
    await importHoldingTankFile(app);

    // Non-numeric lines are ignored and ids missing from the library are dropped
    await expect(page.locator('#holding_tank_1 li[songid]')).toHaveCount(2, { timeout: 5000 });
    const songIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#holding_tank_1 li[songid]')).map(li => li.getAttribute('songid'))
    );
    expect(songIds).toEqual(['1001', '1005']);
    await expect(page.locator('#file-drop-toast')).toHaveText("1 song in this file isn't in your library.");

    // Restore dialog
    await app.evaluate(() => { globalThis.__restoreTankInvalidDialog?.(); });
  });
});
