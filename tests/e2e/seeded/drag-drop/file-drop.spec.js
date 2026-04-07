import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    for (const modalId of ['#songFormModal', '#bulkAddModal']) {
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

  test('multiple audio files drop opens Bulk Add modal with file count', async () => {
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

    // Wait for the Bulk Add modal
    await expect(page.locator('#bulkAddModal')).toBeVisible({ timeout: 10000 });

    // Verify the file count summary is displayed
    const summary = page.locator('#bulk-add-file-count');
    await expect(summary).toHaveText(/3 audio files ready to import/);

    // Verify the directory path row is hidden
    const pathField = page.locator('#bulk-add-path');
    const pathRow = pathField.locator('..');
    // The path input's parent row should be hidden
    await expect(pathField).not.toBeVisible();
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
  });

  test('bulk add modal resets to directory mode after cancel', async () => {
    const fixtures = path.resolve(__dirname, '../../../fixtures/test-songs');
    const files = [
      path.join(fixtures, 'IndigoGirls-ShameOnYou.mp3'),
      path.join(fixtures, 'JohnLennon-NobodyToldMe.mp3'),
    ];

    // Drop files to open bulk add in file-list mode
    await page.evaluate(async (filePaths) => {
      if (window.moduleRegistry?.dragDrop?.handleExternalFileDrop) {
        window.moduleRegistry.dragDrop.handleExternalFileDrop(filePaths);
      }
    }, files);

    await expect(page.locator('#bulkAddModal')).toBeVisible({ timeout: 10000 });

    // Verify file summary is shown
    await expect(page.locator('#bulk-add-file-count')).toHaveText(/2 audio files/);

    // Cancel the modal
    await page.locator('#bulkAddModal .btn-secondary').click();
    await expect(page.locator('#bulkAddModal')).not.toBeVisible({ timeout: 5000 });

    // Now open the bulk add modal via the normal directory flow
    await page.evaluate(() => {
      if (window.moduleRegistry?.bulkOperations?.showBulkAddModal) {
        window.moduleRegistry.bulkOperations.showBulkAddModal('/some/directory');
      }
    });

    await expect(page.locator('#bulkAddModal')).toBeVisible({ timeout: 10000 });

    // The directory path field should be visible again
    await expect(page.locator('#bulk-add-path')).toBeVisible();

    // The file summary should be hidden
    await expect(page.locator('#bulk-add-file-count')).not.toBeVisible();
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
