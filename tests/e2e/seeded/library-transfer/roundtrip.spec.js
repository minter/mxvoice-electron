import { _electron as electron, test, expect } from '@playwright/test';
import electronPath from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  launchSeededApp,
  closeApp,
  waitForAppReady
} from '../../../utils/seeded-launch.js';

test.describe('Library transfer - real archive round trip', () => {
  let app; let page; let userDataDir; let suiteRoot; let suiteMusicDir;
  const replacementHomes = [];

  async function launchReplacementProcess() {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-library-home-'));
    replacementHomes.push(fakeHome);

    app = await electron.launch({
      executablePath: electronPath,
      args: ['.', '--profile=Default User'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        APP_TEST_MODE: '1',
        DISABLE_HARDWARE_ACCELERATION: '1',
        AUTO_UPDATE: '0',
        E2E_USER_DATA_DIR: userDataDir,
        HOME: fakeHome,
        APPDATA: fakeHome,
      },
    });

    page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page, app);
  }

  async function chooseLibraryPaths({ savePath, openPath } = {}) {
    await app.evaluate(({ dialog }, paths) => {
      if (paths.savePath) {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.savePath });
      }
      if (paths.openPath) {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.openPath] });
      }
    }, { savePath, openPath });
  }

  test.beforeEach(async () => {
    ({ app, page, userDataDir, suiteRoot, suiteMusicDir } = await launchSeededApp(
      electron,
      'library-transfer'
    ));
    await waitForAppReady(page, app);
  });

  test.afterEach(async () => {
    await closeApp(app).catch(() => {});
    app = null;
    for (const home of replacementHomes.splice(0)) {
      fs.rmSync(home, { recursive: true, force: true });
    }
    fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  test('exports, imports, restarts, and restores database, music, and profile data', async () => {
    const archivePath = path.join(suiteRoot, 'roundtrip.mxvlib');
    await page.evaluate(() => (
      window.secureElectronAPI.profile.setPreference('e2e_library_marker', 'exported-state')
    ));
    await page.evaluate(() => {
      window.__libraryExportProgress = [];
      window.secureElectronAPI.library.onExportProgress((progress) => {
        window.__libraryExportProgress.push(progress);
      });
    });

    await chooseLibraryPaths({ savePath: archivePath });
    await page.evaluate(() => window.moduleRegistry.libraryTransfer.startExport());

    const transferModal = page.locator('#libraryTransferModal');
    await expect(transferModal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#libraryTransferTitle')).toHaveText('Exporting Library');
    await expect(page.locator('#library-transfer-message')).toContainText('Export complete!', { timeout: 15000 });
    await expect(page.locator('#library-transfer-percent')).toHaveText('100%');
    expect(fs.statSync(archivePath).size).toBeGreaterThan(0);
    const exportProgress = await page.evaluate(() => window.__libraryExportProgress);
    expect(exportProgress[0]).toMatchObject({ percent: 0 });
    expect(exportProgress.at(-1)).toMatchObject({ percent: 100 });
    expect(exportProgress.some(({ percent }) => percent > 0 && percent < 100)).toBe(true);

    await transferModal.getByRole('button', { name: 'Close' }).click();
    await expect(transferModal).not.toBeVisible({ timeout: 5000 });

    const deletedSongId = 1001;
    const deletedFilename = 'Anthrax-GotTheTime.mp3';
    const deleteResult = await page.evaluate((songId) => (
      window.secureElectronAPI.database.deleteSong(songId)
    ), deletedSongId);
    expect(deleteResult.success).toBe(true);
    fs.rmSync(path.join(suiteMusicDir, deletedFilename), { force: true });
    await page.evaluate(() => (
      window.secureElectronAPI.profile.setPreference('e2e_library_marker', 'mutated-state')
    ));

    const mutatedCount = await page.evaluate(() => window.secureElectronAPI.database.countSongs());
    expect(mutatedCount.data[0].count).toBe(4);
    expect(fs.existsSync(path.join(suiteMusicDir, deletedFilename))).toBe(false);

    await chooseLibraryPaths({ openPath: archivePath });
    await page.evaluate(() => window.moduleRegistry.libraryTransfer.startImport());

    const confirmModal = page.locator('#libraryImportConfirmModal');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    await expect(confirmModal.locator('#library-import-manifest-info')).toContainText('Music Files');
    await expect(confirmModal.locator('#library-import-manifest-info')).toContainText('5');

    await app.evaluate(({ app: electronApp }) => {
      electronApp.relaunch = () => {};
    });
    await page.evaluate(() => {
      window.__libraryImportProgress = [];
      window.secureElectronAPI.library.onImportProgress((progress) => {
        window.__libraryImportProgress.push(progress);
      });
    });
    const processClosed = app.waitForEvent('close', { timeout: 20000 });
    await confirmModal.locator('#libraryImportConfirmBtn').click();

    await expect(page.locator('#libraryTransferTitle')).toHaveText('Importing Library');
    await expect(page.locator('#library-transfer-message')).toContainText('Import complete!', { timeout: 15000 });
    await expect(page.locator('#library-transfer-percent')).toHaveText('100%');
    const importProgress = await page.evaluate(() => window.__libraryImportProgress);
    expect(importProgress[0]).toMatchObject({ percent: 0 });
    expect(importProgress.at(-1)).toMatchObject({ percent: 100 });
    expect(importProgress.some(({ percent }) => percent >= 50 && percent < 100)).toBe(true);
    await processClosed;
    app = null;

    await launchReplacementProcess();

    const restoredCount = await page.evaluate(() => window.secureElectronAPI.database.countSongs());
    expect(restoredCount.data[0].count).toBe(5);
    expect(await page.evaluate((songId) => (
      window.secureElectronAPI.database.getSongById(songId)
    ), deletedSongId)).toMatchObject({ success: true });

    const restoredMusicDir = path.join(userDataDir, 'mp3');
    expect(fs.existsSync(path.join(restoredMusicDir, deletedFilename))).toBe(true);
    expect(await page.evaluate(async () => (
      await window.secureElectronAPI.profile.getPreference('e2e_library_marker')
    ))).toMatchObject({ success: true, value: 'exported-state' });

    const importedConfig = JSON.parse(fs.readFileSync(path.join(userDataDir, 'config.json'), 'utf8'));
    expect(importedConfig.database_directory).toBe(userDataDir);
    expect(importedConfig.music_directory).toBe(restoredMusicDir);
    expect(importedConfig.hotkey_directory).toBe(path.join(userDataDir, 'hotkeys'));
  });

  test('rejects a corrupt archive before changing the active library', async () => {
    const corruptPath = path.join(suiteRoot, 'corrupt.mxvlib');
    fs.writeFileSync(corruptPath, 'not a zip archive');
    const databasePath = path.join(userDataDir, 'db', 'mxvoice.db');
    const databaseBefore = fs.readFileSync(databasePath);
    const musicBefore = fs.readdirSync(suiteMusicDir).sort();

    await chooseLibraryPaths({ openPath: corruptPath });
    await page.evaluate(() => window.moduleRegistry.libraryTransfer.startImport());

    const transferModal = page.locator('#libraryTransferModal');
    await expect(transferModal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#libraryTransferTitle')).toHaveText('Import Error');
    await expect(page.locator('#library-transfer-message')).toContainText('Invalid archive');

    expect(fs.readFileSync(databasePath)).toEqual(databaseBefore);
    expect(fs.readdirSync(suiteMusicDir).sort()).toEqual(musicBefore);
    const count = await page.evaluate(() => window.secureElectronAPI.database.countSongs());
    expect(count.data[0].count).toBe(5);
  });
});
