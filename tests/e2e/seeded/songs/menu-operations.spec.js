import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, performEmptySearch, clearModalBackdrop } from '../../../utils/seeded-launch.js';

test.describe('Songs - menu operations', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'menu-ops'));

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

  // Dismiss any leftover modals between tests
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
      // Page might not be ready
    }
  });

  /**
   * Helper: trigger a menu item from the Songs submenu
   */
  async function triggerSongsMenuItem(label) {
    return app.evaluate(async ({ Menu, BrowserWindow }, menuLabel) => {
      const menu = Menu.getApplicationMenu();
      const songsMenu = menu?.items?.find(i => i.label === 'Songs');
      const item = songsMenu?.submenu?.items?.find(i => i.label === menuLabel);
      if (!item) return { ok: false, reason: `"${menuLabel}" menu item not found` };

      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      if (!win) return { ok: false, reason: 'No focused window' };
      item.click({}, win, win.webContents);
      return { ok: true };
    }, label);
  }

  test('edit selected song via menu opens edit modal', async () => {
    // Populate search results and select a song
    await performEmptySearch(page);

    const rows = page.locator('#search_results tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Click a song row to select it
    const targetRow = rows.filter({ hasText: 'Got The Time' });
    await targetRow.click();

    // Verify it's selected
    const selectedId = await targetRow.getAttribute('id');
    expect(selectedId).toBe('selected_row');

    // Trigger Edit Selected Song from menu
    const result = await triggerSongsMenuItem('Edit Selected Song');
    expect(result.ok).toBe(true);

    // Wait for the edit modal to appear
    const modal = page.locator('#songFormModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Verify the form is populated with the correct song data
    const titleInput = page.locator('#song-form-title');
    await expect(titleInput).toHaveValue('Got The Time');

    // Verify the artist field
    const artistInput = page.locator('#song-form-artist');
    await expect(artistInput).toHaveValue('Anthrax');

    // Close the modal without saving
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 5000 }).catch(async () => {
      await clearModalBackdrop(page);
    });
    await clearModalBackdrop(page);
  });

  test('edit via menu with no selection does nothing', async () => {
    // Clear any selection
    await page.evaluate(() => {
      const selected = document.getElementById('selected_row');
      if (selected) selected.removeAttribute('id');
    });

    // Trigger Edit Selected Song
    await triggerSongsMenuItem('Edit Selected Song');

    // Modal should NOT appear (no song selected)
    const modal = page.locator('#songFormModal');
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test('edit via menu and save changes persists', async () => {
    // Search and select Edie Brickell song
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Edie Brickell');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    await rows.first().click();

    // Trigger Edit from menu
    await triggerSongsMenuItem('Edit Selected Song');

    const modal = page.locator('#songFormModal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Change the artist name
    const artistInput = page.locator('#song-form-artist');
    await artistInput.clear();
    await artistInput.fill('Edie Brickell (Edited)');

    // Submit the form
    const submitBtn = page.locator('#songFormSubmitButton');
    await submitBtn.click();

    // Wait for modal to close
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Search again to verify the change persisted
    await searchInput.fill('Edie Brickell');
    await searchInput.press('Enter');

    // Verify the updated artist name appears
    await expect(page.locator('#search_results')).toContainText('Edie Brickell (Edited)');
  });

  test('delete selected song via menu removes it', async () => {
    // Search for a specific song to delete
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Joey Scarbury');
    await searchInput.press('Enter');

    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });

    // Select the song
    await rows.first().click();

    // Trigger Delete Selected Song from menu
    await triggerSongsMenuItem('Delete Selected Song');

    // Wait for the confirmation modal (same pattern as delete.spec.js)
    const confirmationModal = page.locator('.modal').filter({ hasText: 'Are you sure you want to delete' }).first();
    await expect(confirmationModal).toBeVisible({ timeout: 5000 });

    // Click Confirm button
    const confirmButton = confirmationModal.locator('button').filter({ hasText: /Confirm|Delete|Yes|OK/ }).first();
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Wait for modal to close and backdrop to clear
    await expect(confirmationModal).not.toBeVisible({ timeout: 5000 });

    // Verify the song is gone by searching again
    await searchInput.fill('Joey Scarbury');
    await searchInput.press('Enter');

    // Should have 0 results
    const resultsAfter = page.locator('#search_results tbody tr');
    const count = await resultsAfter.count();
    expect(count).toBe(0);
  });
});
