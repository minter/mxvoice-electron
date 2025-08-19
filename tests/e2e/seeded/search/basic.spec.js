import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, performEmptySearch } from '../../../utils/seeded-launch.js';
import { TEST_CONFIG } from '../../../config/test-environment.js';

test.describe('Search - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for search tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'search'));
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('keyboard accelerator toggles Advanced Search panel', async () => {
    // Ensure window is visible and focused
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    await page.bringToFront();
    await page.click('body');
    
    // Wait for the page to be fully ready
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  
    // Optional: make animations instant in tests (prevents flakiness)
    await page.addStyleTag({ content: `
      #advanced-search, #advanced_search_button, * {
        animation-duration: 1ms !important;
        transition-duration: 1ms !important;
      }
    `});
  
    const btn = page.locator('#advanced_search_button');
    const panel = page.locator('#advanced-search');
  
    // Wait for the button to be ready
    await expect(btn).toBeVisible({ timeout: 5000 });
    
    const before = (await btn.getAttribute('aria-expanded')) ?? 'false';
    console.log(`Initial aria-expanded state: ${before}`);
  
    // Helper: invoke the menu item exactly like the accelerator
    const triggerMenuItem = async () => {
      const res = await app.evaluate(async ({ Menu, BrowserWindow }) => {
        const menu = Menu.getApplicationMenu();
        const item = menu?.getMenuItemById?.('toggle_advanced_search');
        if (!item) return { ok: false, reason: 'Menu item not found' };
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
        if (!win) return { ok: false, reason: 'No focused window' };
        const wc = win.webContents;
        // click(event, focusedWindow, focusedWebContents)
        // @ts-ignore
        item.click({}, win, wc);
        if (win.isMinimized()) { win.restore(); win.focus(); }
        return { ok: true };
      });
      if (!res.ok) throw new Error(`Menu item trigger failed: ${res.reason || 'Unknown error'}`);
      
      // Wait a moment for the click to be processed
      await page.waitForTimeout(500);
    };
  
    // First toggle
    console.log('Triggering first menu item click...');
    await triggerMenuItem();
    
    // Wait for the attribute to change with retry logic
    let attempts = 0;
    const maxAttempts = 5;
    let attributeChanged = false;
    
    while (!attributeChanged && attempts < maxAttempts) {
      attempts++;
      try {
        const expectedValue = before === 'true' ? 'false' : 'true';
        console.log(`Attempt ${attempts}: Waiting for aria-expanded to change to ${expectedValue}...`);
        await expect(btn).toHaveAttribute('aria-expanded', expectedValue, { timeout: 2000 });
        attributeChanged = true;
        console.log(`✅ aria-expanded changed to ${expectedValue}`);
      } catch (error) {
        console.log(`Attempt ${attempts} failed: ${error.message}`);
        if (attempts < maxAttempts) {
          console.log('Retrying menu trigger...');
          await triggerMenuItem();
          await page.waitForTimeout(1000);
        } else {
          throw new Error(`aria-expanded failed to change after ${maxAttempts} attempts: ${error.message}`);
        }
      }
    }
  
    // (Optional) double-check panel visibility matches aria-expanded
    const visibleNow = (await btn.getAttribute('aria-expanded')) === 'true';
    console.log(`Panel should be visible: ${visibleNow}`);
    
    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const el = document.querySelector('#advanced-search');
          if (!el) return false;
          const cs = getComputedStyle(el), r = el.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' &&
                 parseFloat(cs.opacity || '1') > 0 && r.width > 0 && r.height > 0 &&
                 el.getClientRects().length > 0;
        });
      }, { timeout: 5000 })
      .toBe(visibleNow);
  
    // Second toggle (revert)
    console.log('Triggering second menu item click to revert...');
    await triggerMenuItem();
    
    // Wait for the attribute to revert
    await expect(btn).toHaveAttribute('aria-expanded', before, { timeout: 5000 });
    console.log(`✅ aria-expanded reverted to ${before}`);
  });
  
    
  
  test('returns seeded songs on empty search', async () => {
    await performEmptySearch(page);
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(TEST_CONFIG.schema.songs.length, { timeout: 5000 });
  });

  test('filters by title term', async () => {
    const sample = TEST_CONFIG.schema.songs[0];
    const term = sample.title.split(' ')[0];
    await page.locator('#omni_search').fill(term);
    await page.locator('#omni_search').press('Enter');

    const expectedCount = TEST_CONFIG.schema.songs.filter(s => (s.title || '').toLowerCase().includes(term.toLowerCase())).length;
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(expectedCount, { timeout: 5000 });
    await expect(page.locator('#search_results')).toContainText(sample.title);
    // reset
    await page.locator('#reset_button').click();
  });

  test('filters by artist term', async () => {
    const sample = TEST_CONFIG.schema.songs.find(s => s.artist);
    const term = (sample?.artist || '').split(' ')[0];
    await page.locator('#omni_search').fill(term);
    await page.locator('#omni_search').press('Enter');

    const expectedCount = TEST_CONFIG.schema.songs.filter(s => (s.artist || '').toLowerCase().includes(term.toLowerCase())).length;
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(expectedCount, { timeout: 5000 });
    // reset
    await page.locator('#reset_button').click();
  });

  test('filters by category selection', async () => {
    // choose a category present in dataset
    const chosenCategory = TEST_CONFIG.schema.songs[0].category;
    await page.locator('#category_select').selectOption(chosenCategory);
    await page.locator('#omni_search').fill('');
    await page.locator('#omni_search').press('Enter');

    const expectedCount = TEST_CONFIG.schema.songs.filter(s => s.category === chosenCategory).length;
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(expectedCount, { timeout: 5000 });

    // reset category to All (value '*')
    await page.locator('#category_select').selectOption('*');
    await page.locator('#reset_button').click();
  });

  test('advanced search by artist', async () => {
    // 1) Click advanced search button
    await page.locator('#advanced_search_button').click();
    // 2) Wait 2 seconds for animation/DOM stabilization
    await page.waitForTimeout(2000);
    // 3) Ensure artist field is visible
    const artistInput = page.locator('#artist-search');
    await expect(artistInput).toBeVisible();
    // 4) Type Anthrax into artist field (live search should filter results)
    await artistInput.click();
    await artistInput.fill('');
    await artistInput.type('Anthrax', { delay: 50 });

    const expectedCount = 1;
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(expectedCount, { timeout: 8000 });

    // close advanced search and reset
    await page.locator('#advanced_search_button').click();
    await page.locator('#reset_button').click();
  });

  test('reset with X and filter by Game category → 2 results', async () => {
    // Click the X reset button to clear any prior filters
    await page.locator('#reset_button').click();
    // Human-ish pacing
    await page.waitForTimeout(250);

    // Select the Game category (try by visible label first, then by value)
    const catSelect = page.locator('#category_select');
    await catSelect.selectOption({ label: 'Game' }).catch(async () => {
      await catSelect.selectOption('GAME');
    });

    // Expect two results in our seeded dataset
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 5000 });

    // Reset back to all
    await catSelect.selectOption('*');
    await page.locator('#reset_button').click();
  });

  test('with Game selected, typing "Brickell" reduces results to 1', async () => {
    // Reset first
    await page.locator('#reset_button').click();
    await page.waitForTimeout(250);

    // Select Game category
    const catSelect = page.locator('#category_select');
    await catSelect.selectOption({ label: 'Game' }).catch(async () => {
      await catSelect.selectOption('GAME');
    });

    // Confirm two results
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 5000 });

    // Type Brickell into omni search at human-ish speed
    const omni = page.locator('#omni_search');
    await omni.click();
    await omni.fill('');
    await omni.type('Brickell', { delay: 50 });
    await omni.press('Enter');

    // Expect one result (Edie Brickell)
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('#search_results')).toContainText('Edie Brickell');

    // Reset back to all for subsequent tests
    await catSelect.selectOption('*');
    await page.locator('#reset_button').click();
  });

  test('advanced date filter: past week → 4, past 3 months → 5', async () => {
    // Reset to a clean state
    await page.locator('#reset_button').click();
    await page.waitForTimeout(250);

    // Open advanced search
    await page.locator('#advanced_search_button').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#advanced-search')).toBeVisible();

    // Choose "Added Past Week" (value 7)
    const dateSelect = page.locator('#date-search');
    await dateSelect.selectOption('7');
    // Expect 4 songs (all but the one set ~60 days ago)
    await expect(page.locator('#search_results tbody tr')).toHaveCount(4, { timeout: 5000 });

    // Now choose "Added Past 3 Months" (value 90) → expect all 5
    await dateSelect.selectOption('90');
    await expect(page.locator('#search_results tbody tr')).toHaveCount(5, { timeout: 5000 });

    // Close advanced and reset
    await page.locator('#advanced_search_button').click();
    await page.locator('#reset_button').click();
  });

  test('live search with keystrokes', async () => {
    // Reset to a clean state
    await page.locator('#reset_button').click();
    await page.waitForTimeout(250);

    // Go to the search bar
    const searchBar = page.locator('#omni_search');
    await searchBar.click();
    await searchBar.fill('');

    // Send keystrokes "T", "h", "e" one by one
    await searchBar.type('T', { delay: 100 });
    await page.waitForTimeout(200); // Wait for live search to process
    
    await searchBar.type('h', { delay: 100 });
    await page.waitForTimeout(200); // Wait for live search to process
    
    await searchBar.type('e', { delay: 100 });
    await page.waitForTimeout(500); // Wait for live search to process

    // Validate that there are three songs returned
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 5000 });
    
    // Verify the specific songs are present
    await expect(page.locator('#search_results')).toContainText('The Wheel (Back And Forth)');
    await expect(page.locator('#search_results')).toContainText('Theme From The Greatest American Hero');
    await expect(page.locator('#search_results')).toContainText('Got The Time');

    // Add an additional "m" keystroke (giving "Them")
    await searchBar.type('m', { delay: 100 });
    await page.waitForTimeout(500); // Wait for live search to process

    // Validate that there is now one result
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    
    // Verify the remaining song is "Theme From The Greatest American Hero"
    await expect(page.locator('#search_results')).toContainText('Theme From The Greatest American Hero');
    await expect(page.locator('#search_results')).not.toContainText('The Wheel (Back And Forth)');

    // Reset for subsequent tests
    await page.locator('#reset_button').click();
  });

  test('live search with category filter', async () => {
    // Reset to a clean state
    await page.locator('#reset_button').click();
    await page.waitForTimeout(250);

    // Start with a blank search
    const searchBar = page.locator('#omni_search');
    await searchBar.click();
    await searchBar.fill('');

    // Select category "GAME"
    const catSelect = page.locator('#category_select');
    await catSelect.selectOption({ label: 'Game' }).catch(async () => {
      await catSelect.selectOption('GAME');
    });
    await page.waitForTimeout(500); // Wait for category filter to apply

    // Send keystrokes "T", "h", "e" into the search bar
    await searchBar.type('T', { delay: 100 });
    await page.waitForTimeout(200); // Wait for live search to process
    
    await searchBar.type('h', { delay: 100 });
    await page.waitForTimeout(200); // Wait for live search to process
    
    await searchBar.type('e', { delay: 100 });
    await page.waitForTimeout(500); // Wait for live search to process

    // Validate that there are two results: Got The Time, and The Wheel (Back And Forth)
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(2, { timeout: 5000 });
    
    // Verify the specific songs are present
    await expect(page.locator('#search_results')).toContainText('Got The Time');
    await expect(page.locator('#search_results')).toContainText('The Wheel (Back And Forth)');

    // Add the keystrokes " ", "w" (giving "The w")
    await searchBar.type(' ', { delay: 100 });
    await page.waitForTimeout(200); // Wait for live search to process
    
    await searchBar.type('w', { delay: 100 });
    await page.waitForTimeout(500); // Wait for live search to process

    // Validate that there is one result - The Wheel (Back And Forth)
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('#search_results')).toContainText('The Wheel (Back And Forth)');
    await expect(page.locator('#search_results')).not.toContainText('Got The Time');

    // Reset for subsequent tests
    await page.locator('#reset_button').click();
  });
});


