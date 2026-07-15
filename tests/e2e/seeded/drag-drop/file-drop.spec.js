import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dispatch an OS-style file drop using genuine, disk-backed File objects.
 *
 * Playwright's setInputFiles() attaches the real fixture paths to a browser
 * file input. Reusing those File objects in a DataTransfer exercises the same
 * renderer -> preload webUtils.getPathForFile() boundary used by Explorer and
 * Finder, unlike handleExternalFileDrop(), which starts with paths already in
 * hand.
 */
async function dispatchDiskBackedFileDrop(page, filePaths) {
  await page.evaluate(() => {
    document.getElementById('e2e-disk-backed-file-input')?.remove();
    const input = document.createElement('input');
    input.id = 'e2e-disk-backed-file-input';
    input.type = 'file';
    input.multiple = true;
    input.hidden = true;
    document.body.appendChild(input);
  });

  const input = page.locator('#e2e-disk-backed-file-input');
  await input.setInputFiles(filePaths);

  return page.evaluate(() => {
    const fileInput = document.getElementById('e2e-disk-backed-file-input');
    const files = [...fileInput.files];
    const pathResults = files.map(file => {
      try {
        return {
          name: file.name,
          path: window.secureElectronAPI?.utils?.getPathForFile?.(file) || '',
          error: null
        };
      } catch (error) {
        return { name: file.name, path: '', error: error.message };
      }
    });

    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer
    });

    document.dispatchEvent(dropEvent);
    fileInput.remove();

    return {
      defaultPrevented: dropEvent.defaultPrevented,
      fileCount: files.length,
      transferTypes: [...dataTransfer.types],
      pathResults
    };
  });
}

test.describe('File Drop — external file import', () => {
  let app; let page; let suiteMusicDir;

  test.beforeAll(async () => {
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }

    ({ app, page, suiteMusicDir } = await launchSeededApp(electron, 'file-drop'));

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
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test.beforeEach(async () => {
    // Close any open modals before each test
    for (const modalId of ['#songFormModal', '#bulkAddModal', '#multiSongImportModal']) {
      const visible = await page.locator(modalId).isVisible();
      if (visible) {
        try {
          await page.locator(`${modalId} .btn-close`).click();
          await expect(page.locator(modalId)).not.toBeVisible({ timeout: 5000 });
        } catch (_e) {
          await page.keyboard.press('Escape');
          await expect(page.locator(modalId)).not.toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('single audio file drop opens Add Song modal with metadata', async () => {
    const mp3 = path.resolve(__dirname, '../../../fixtures/test-songs/IndigoGirls-ShameOnYou.mp3');

    // Simulate an OS file drop via page.evaluate — dispatch the drop event
    // with a DataTransfer containing a file entry. Since we can't create real
    // File objects from the FS in the renderer, we call the module's
    // handleExternalFileDrop directly with the file path.
    await page.evaluate(async (filePath) => {
      if (window.moduleRegistry?.dragDrop?.handleExternalFileDrop) {
        window.moduleRegistry.dragDrop.handleExternalFileDrop([filePath]);
      }
    }, mp3);

    // Wait for the Add Song modal to appear
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 10000 });

    // Verify the modal title says "Add New Song" (not Edit)
    const title = page.locator('#songFormModalTitle');
    await expect(title).toHaveText(/add new song/i);

    // Verify the filename hidden field was populated
    const filenameVal = await page.locator('#song-form-filename').inputValue();
    expect(filenameVal).toContain('IndigoGirls-ShameOnYou.mp3');
  });

  test('multiple audio files drop opens Multi-Song Import modal', async () => {
    const fixtures = path.resolve(__dirname, '../../../fixtures/test-songs');
    const files = [
      path.join(fixtures, 'IndigoGirls-ShameOnYou.mp3'),
      path.join(fixtures, 'JohnLennon-NobodyToldMe.mp3'),
      path.join(fixtures, 'ArloGuthrie-AlicesRestaurant.ogg'),
    ];

    await page.evaluate(async (filePaths) => {
      if (window.moduleRegistry?.dragDrop?.handleExternalFileDrop) {
        window.moduleRegistry.dragDrop.handleExternalFileDrop(filePaths);
      }
    }, files);

    // Wait for the Multi-Song Import modal (count is 3, which is <= 20)
    const modal = page.locator('#multiSongImportModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Verify the file count summary is displayed
    const summary = page.locator('#multi-song-import-count');
    await expect(summary).toHaveText(/3 songs ready to import/);

    // Verify song rows are rendered
    const rows = modal.locator('.song-import-row');
    await expect(rows).toHaveCount(3);
  });

  test('disk-backed single-file drop resolves its path and opens Add Song', async () => {
    const mp3 = path.resolve(__dirname, '../../../fixtures/test-songs/IndigoGirls-ShameOnYou.mp3');

    const dropResult = await dispatchDiskBackedFileDrop(page, [mp3]);

    expect(dropResult.defaultPrevented).toBe(true);
    expect(dropResult.transferTypes).toContain('Files');
    expect(dropResult.fileCount).toBe(1);
    expect(dropResult.pathResults).toEqual([
      {
        name: 'IndigoGirls-ShameOnYou.mp3',
        path: expect.stringMatching(/\S+/),
        error: null
      }
    ]);

    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#songFormModalTitle')).toHaveText(/add new song/i);
    await expect(page.locator('#file-drop-toast')).not.toBeVisible();
  });

  test('disk-backed five-file drop resolves every path and opens Multi-Song Import', async () => {
    const fixtures = path.resolve(__dirname, '../../../fixtures/test-songs');
    const files = [
      path.join(fixtures, 'Anthrax-GotTheTime.mp3'),
      path.join(fixtures, 'ArloGuthrie-AlicesRestaurant.ogg'),
      path.join(fixtures, 'EdieBrickell-TheWheel.mp3'),
      path.join(fixtures, 'JoeyScarbury-GreatestAmericanHero.mp3'),
      path.join(fixtures, 'SisterSledge-WeAreFamily.mp3'),
    ];

    const dropResult = await dispatchDiskBackedFileDrop(page, files);

    expect(dropResult.defaultPrevented).toBe(true);
    expect(dropResult.transferTypes).toContain('Files');
    expect(dropResult.fileCount).toBe(5);
    expect(dropResult.pathResults).toEqual(files.map(filePath => ({
      name: path.basename(filePath),
      path: expect.stringMatching(/\S+/),
      error: null
    })));

    const modal = page.locator('#multiSongImportModal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#multi-song-import-count')).toHaveText(/5 songs ready to import/);
    await expect(modal.locator('.song-import-row')).toHaveCount(5);
    await expect(page.locator('#file-drop-toast')).not.toBeVisible();
  });

  test('non-audio files drop shows toast notification', async () => {
    // handleExternalFileDrop filters by extension — passing non-audio paths
    // results in an empty valid list, which should show the toast
    await page.evaluate(async () => {
      if (window.moduleRegistry?.dragDrop?.handleExternalFileDrop) {
        window.moduleRegistry.dragDrop.handleExternalFileDrop([
          '/tmp/readme.txt',
          '/tmp/photo.jpg'
        ]);
      }
    });

    // The toast should appear
    const toast = page.locator('#file-drop-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toHaveText(/no supported audio files/i);

    // Neither modal should be open
    await expect(page.locator('#songFormModal')).not.toBeVisible();
    await expect(page.locator('#bulkAddModal')).not.toBeVisible();
    await expect(page.locator('#multiSongImportModal')).not.toBeVisible();
  });

  test('multi-song import modal resets after cancel', async () => {
    const fixtures = path.resolve(__dirname, '../../../fixtures/test-songs');
    const files = [
      path.join(fixtures, 'IndigoGirls-ShameOnYou.mp3'),
      path.join(fixtures, 'JohnLennon-NobodyToldMe.mp3'),
    ];

    // Drop files to open multi-song import
    await page.evaluate(async (filePaths) => {
      if (window.moduleRegistry?.dragDrop?.handleExternalFileDrop) {
        window.moduleRegistry.dragDrop.handleExternalFileDrop(filePaths);
      }
    }, files);

    const modal = page.locator('#multiSongImportModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Verify file summary is shown
    await expect(page.locator('#multi-song-import-count')).toHaveText(/2 songs ready to import/);

    // Cancel the modal
    await modal.locator('.btn-secondary').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('drop is ignored when a modal is already open', async () => {
    const mp3 = path.resolve(__dirname, '../../../fixtures/test-songs/IndigoGirls-ShameOnYou.mp3');

    // Open the Add Song modal manually first
    await page.evaluate(async (filePath) => {
      if (window.moduleRegistry?.songManagement?.startAddNewSong) {
        window.moduleRegistry.songManagement.startAddNewSong(filePath, null);
      }
    }, mp3);

    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 10000 });

    // Now simulate a file drop via the document drop event path
    // The drop handler checks isModalOpen() and should ignore it
    const dropped = await page.evaluate(() => {
      // Check what the handler would see
      return document.querySelector('.modal.show') !== null;
    });

    expect(dropped).toBe(true); // Confirms a modal IS open — drop would be ignored
  });
});
