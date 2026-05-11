import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Songs - Multi-Song Import', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'songs'));
    
    // Use the standard wait for app ready helper to ensure focus and module initialization
    await waitForAppReady(page, app);

    // Capture browser console logs
    page.on('console', msg => {
      console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.log(`BROWSER ERROR: ${error.message}`);
    });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('Drop 2 files → Multi-Song Import modal shows with metadata', async () => {
    const song1 = path.resolve(__dirname, '../../../fixtures/test-songs/IndigoGirls-ShameOnYou.mp3');
    const song2 = path.resolve(__dirname, '../../../fixtures/test-songs/BlueBucksClan-LilWhip.mp3');

    // Simulate file drop using evaluate (Playwright doesn't support real file drags easily)
    await page.evaluate(async (files) => {
      // Mock the DataTransfer object
      const dataTransfer = {
        types: ['Files'],
        files: files.map(f => {
          // In Electron with webUtils.getPathForFile enabled (which we assume here)
          // we just need an object that looks like a File
          return {
            name: f.split('/').pop(),
            path: f
          };
        }),
        dropEffect: 'copy'
      };

      // Create and dispatch the drop event
      const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
      // @ts-ignore
      dropEvent.dataTransfer = dataTransfer;
      document.dispatchEvent(dropEvent);
    }, [song1, song2]);

    // 1) Verify modal appears
    const modal = page.locator('#multiSongImportModal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('.modal-title')).toHaveText('Multi-Song Import');

    // 2) Verify metadata was parsed for both songs
    // Song 1
    const row1 = modal.locator('.song-import-row').nth(0);
    await expect(row1.locator('.song-title-input')).toHaveValue('Shame On You');
    await expect(row1.locator('.song-artist-input')).toHaveValue('Indigo Girls');

    // Song 2
    const row2 = modal.locator('.song-import-row').nth(1);
    // It might be "Lil Whip" (metadata) or "BlueBucksClan-LilWhip" (filename fallback)
    const song2Title = await row2.locator('.song-title-input').inputValue();
    expect(['Lil Whip', 'BlueBucksClan-LilWhip']).toContain(song2Title);
    
    const song2Artist = await row2.locator('.song-artist-input').inputValue();
    expect(['BlueBucksClan', '']).toContain(song2Artist);

    // 3) Test Global Category selection
    const globalCatSelect = page.locator('#multi-import-global-category');
    await globalCatSelect.selectOption({ label: 'Running In' });

    // Verify both rows updated
    await expect(row1.locator('.song-category-select')).toHaveValue('RNIN');
    await expect(row2.locator('.song-category-select')).toHaveValue('RNIN');

    // 4) Individual override
    await row2.locator('.song-title-input').fill('Custom Lil Whip');
    await row2.locator('.song-artist-input').fill('Custom Artist');
    await row2.locator('.song-info-input').fill('Import Note');
    await row2.locator('.song-category-select').selectOption({ label: 'Game' });
    
    await expect(row2.locator('.song-category-select')).toHaveValue('GAME');
    await expect(row1.locator('.song-category-select')).toHaveValue('RNIN'); // Still Running In

    // 5) Submit and verify import
    const submitBtn = page.locator('#multiSongImportSubmitButton');
    await submitBtn.click();

    // Modal should hide
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verify songs appear in search results
    const resultsTbody = page.locator('#search_results tbody');
    
    // Verify first song (original metadata + global category)
    const song1Row = resultsTbody.locator('tr.song').filter({ hasText: 'Shame On You' });
    await expect(song1Row).toBeVisible();
    await expect(song1Row.locator('td').nth(0)).toHaveText('Running In');
    await expect(song1Row.locator('td').nth(3)).toHaveText('Indigo Girls');

    // Verify second song (custom metadata + individual category)
    const song2Row = resultsTbody.locator('tr.song').filter({ hasText: 'Custom Lil Whip' });
    await expect(song2Row).toBeVisible();
    await expect(song2Row.locator('td').nth(0)).toHaveText('Game');
    await expect(song2Row.locator('td').nth(1)).toHaveText('Import Note');
    await expect(song2Row.locator('td').nth(3)).toHaveText('Custom Artist');
    
    console.log('✅ Multi-Song Import persistence verification completed successfully');
  });

  test('Global Category selection propagates to all song rows', async () => {
    const song1 = path.resolve(__dirname, '../../../fixtures/test-songs/Anthrax-GotTheTime.mp3');
    const song2 = path.resolve(__dirname, '../../../fixtures/test-songs/EdieBrickell-TheWheel.mp3');
    const song3 = path.resolve(__dirname, '../../../fixtures/test-songs/SisterSledge-WeAreFamily.mp3');

    // Simulate drop of 3 files using evaluate
    await page.evaluate(async (files) => {
      const dataTransfer = {
        types: ['Files'],
        files: files.map(f => ({
          name: f.split('/').pop(),
          path: f
        })),
        dropEffect: 'copy'
      };

      const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
      // @ts-ignore
      dropEvent.dataTransfer = dataTransfer;
      document.dispatchEvent(dropEvent);
    }, [song1, song2, song3]);

    const modal = page.locator('#multiSongImportModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    const globalCatSelect = page.locator('#multi-import-global-category');
    const rowSelects = modal.locator('.song-category-select');
    
    // Wait for rows to be rendered and categories to be populated
    await expect(rowSelects).toHaveCount(3, { timeout: 10000 });

    // 1) Set to "Game"
    await globalCatSelect.selectOption({ label: 'Game' });
    await expect(rowSelects.nth(0)).toHaveValue('GAME');
    await expect(rowSelects.nth(1)).toHaveValue('GAME');
    await expect(rowSelects.nth(2)).toHaveValue('GAME');

    // 2) Change to "Groaner"
    await globalCatSelect.selectOption({ label: 'Groaner' });
    await expect(rowSelects.nth(0)).toHaveValue('GROAN');
    await expect(rowSelects.nth(1)).toHaveValue('GROAN');
    await expect(rowSelects.nth(2)).toHaveValue('GROAN');

    // 3) Change to "Running In"
    await globalCatSelect.selectOption({ label: 'Running In' });
    await expect(rowSelects.nth(0)).toHaveValue('RNIN');
    await expect(rowSelects.nth(1)).toHaveValue('RNIN');
    await expect(rowSelects.nth(2)).toHaveValue('RNIN');
    
    console.log('✅ Global category propagation verification completed successfully');
  });

  test('Global category with individual override persists correctly', async () => {
    const song1 = path.resolve(__dirname, '../../../fixtures/test-songs/Anthrax-GotTheTime.mp3');
    const song2 = path.resolve(__dirname, '../../../fixtures/test-songs/EdieBrickell-TheWheel.mp3');
    const song3 = path.resolve(__dirname, '../../../fixtures/test-songs/SisterSledge-WeAreFamily.mp3');

    // Simulate drop of 3 files
    await page.evaluate(async (files) => {
      const dataTransfer = {
        types: ['Files'],
        files: files.map(f => ({
          name: f.split('/').pop(),
          path: f
        })),
        dropEffect: 'copy'
      };

      const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
      // @ts-ignore
      dropEvent.dataTransfer = dataTransfer;
      document.dispatchEvent(dropEvent);
    }, [song1, song2, song3]);

    const modal = page.locator('#multiSongImportModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // 1) Set global category to 'Groaner' (GROAN)
    const globalCatSelect = page.locator('#multi-import-global-category');
    await globalCatSelect.selectOption({ label: 'Groaner' });

    // 2) Override the second song to 'Show Ending' (END)
    const row2 = modal.locator('.song-import-row').nth(1);
    const row2Select = row2.locator('.song-category-select');
    // Ensure the rows are rendered before trying to select
    await expect(row2Select).toBeVisible();
    await row2Select.selectOption({ label: 'Show Ending' });

    // 3) Submit
    await page.locator('#multiSongImportSubmitButton').click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // 4) Verify in search results
    const resultsTbody = page.locator('#search_results tbody');
    
    const row1Result = resultsTbody.locator('tr.song').filter({ hasText: 'Got The Time' });
    await expect(row1Result.locator('td').nth(0)).toHaveText('Groaner');

    const row2Result = resultsTbody.locator('tr.song').filter({ hasText: /The Wheel/ });
    await expect(row2Result.locator('td').nth(0)).toHaveText('Show Ending');

    const row3Result = resultsTbody.locator('tr.song').filter({ hasText: 'We Are Family' });
    await expect(row3Result.locator('td').nth(0)).toHaveText('Groaner');
    
    console.log('✅ Global category with individual override persisted successfully');
  });

  test('Validation prevents import of incomplete data and shows visual feedback', async () => {
    const song1 = path.resolve(__dirname, '../../../fixtures/test-songs/Anthrax-GotTheTime.mp3');
    const song2 = path.resolve(__dirname, '../../../fixtures/test-songs/EdieBrickell-TheWheel.mp3');

    // Simulate drop
    await page.evaluate(async (files) => {
      const dataTransfer = {
        types: ['Files'],
        files: files.map(f => ({ name: f.split('/').pop(), path: f })),
        dropEffect: 'copy'
      };
      const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
      // @ts-ignore
      dropEvent.dataTransfer = dataTransfer;
      document.dispatchEvent(dropEvent);
    }, [song1, song2]);

    const modal = page.locator('#multiSongImportModal');
    await expect(modal).toBeVisible();

    const submitBtn = page.locator('#multiSongImportSubmitButton');

    // 1) Try to submit with no categories selected
    await submitBtn.click();
    
    // Custom UI alert should appear
    const alertModal = page.locator('.modal:has-text("Please ensure all songs have a title and a category selected")');
    await expect(alertModal).toBeVisible();
    await alertModal.locator('button:has-text("OK")').click();
    await expect(alertModal).not.toBeVisible();
    
    // Verify categories are marked as invalid
    const catSelects = modal.locator('.song-category-select');
    await expect(catSelects.nth(0)).toHaveClass(/is-invalid/);
    await expect(catSelects.nth(1)).toHaveClass(/is-invalid/);

    // 2) Clear a title and try again
    const title1 = modal.locator('.song-title-input').first();
    await title1.fill('');
    await submitBtn.click();
    
    await expect(alertModal).toBeVisible();
    await alertModal.locator('button:has-text("OK")').click();
    await expect(alertModal).not.toBeVisible();
    
    await expect(title1).toHaveClass(/is-invalid/);

    // 3) Fix title, invalid stays until focus/input? 
    // In our implementation, we remove is-invalid on input.
    await title1.fill('Fixed Title');
    await expect(title1).not.toHaveClass(/is-invalid/);

    // 4) Apply global category - should clear category invalid states
    const globalCatSelect = page.locator('#multi-import-global-category');
    await globalCatSelect.selectOption({ label: 'Game' });
    await expect(catSelects.nth(0)).not.toHaveClass(/is-invalid/);
    await expect(catSelects.nth(1)).not.toHaveClass(/is-invalid/);

    // 5) Final valid submit
    await submitBtn.click();
    await expect(modal).not.toBeVisible();
    
    console.log('✅ Validation and visual feedback verification completed successfully');
  });

  test('Threshold routing handles all three modes correctly', async () => {
    // 1. Lower threshold to 3 for this test instance via the registry setter
    await page.evaluate(() => {
      if (window.moduleRegistry?.bulkOperations?.setMultiSongThreshold) {
        window.moduleRegistry.bulkOperations.setMultiSongThreshold(3);
      }
    });

    const fixtures = path.resolve(__dirname, '../../../fixtures/test-songs');
    const songFiles = [
      path.join(fixtures, 'Anthrax-GotTheTime.mp3'),
      path.join(fixtures, 'EdieBrickell-TheWheel.mp3'),
      path.join(fixtures, 'SisterSledge-WeAreFamily.mp3'),
      path.join(fixtures, 'WeirdAl-EatIt.mp3')
    ];

    const dropFiles = async (count) => {
      const files = songFiles.slice(0, count);
      await page.evaluate(async (f) => {
        if (window.moduleRegistry?.dragDrop?.handleExternalFileDrop) {
          window.moduleRegistry.dragDrop.handleExternalFileDrop(f);
        }
      }, files);
    };

    // 1) Test 1 file -> Individual Add Modal (#songFormModal)
    console.log('Testing 1 file drop...');
    await dropFiles(1);
    await expect(page.locator('#songFormModal')).toBeVisible({ timeout: 10000 });
    await page.locator('#songFormModal .btn-close').click();
    await expect(page.locator('#songFormModal')).not.toBeVisible();

    // 2) Test 2 files -> Multi-Song Import Modal (within new threshold of 3)
    console.log('Testing 2 file drop...');
    await dropFiles(2);
    await expect(page.locator('#multiSongImportModal')).toBeVisible({ timeout: 10000 });
    await page.locator('#multiSongImportModal .btn-close').click();
    await expect(page.locator('#multiSongImportModal')).not.toBeVisible();

    // 3) Test 4 files -> Traditional Bulk Add Modal (above new threshold of 3)
    console.log('Testing 4 file drop...');
    await dropFiles(4);
    await expect(page.locator('#bulkAddModal')).toBeVisible({ timeout: 10000 });
    // In bulk mode from files, the file summary should be visible
    await expect(page.locator('#bulk-add-file-count')).toBeVisible();
    await expect(page.locator('#bulk-add-file-count')).toHaveText(/4 audio files/);
    await page.locator('#bulkAddModal .btn-close').click();
    await expect(page.locator('#bulkAddModal')).not.toBeVisible();
    
    // Restore threshold for any subsequent tests
    await page.evaluate(() => {
      if (window.moduleRegistry?.bulkOperations?.setMultiSongThreshold) {
        window.moduleRegistry.bulkOperations.setMultiSongThreshold(20);
      }
    });

    console.log('✅ Threshold routing verification completed successfully');
  });
});
