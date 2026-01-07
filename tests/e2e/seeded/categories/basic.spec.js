import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';
import { TEST_CONFIG } from '../../../config/test-environment.js';

test.describe('Categories - management', () => {
  test('category selector displays correct options in correct order', async () => {
    // Launch a fresh app instance for this test to ensure clean state
    let testApp, testPage;
    try {
      ({ app: testApp, page: testPage } = await launchSeededApp(electron, 'categories'));
    } catch (error) {
      // Note: Debug logging would be available here if needed
    }
    
    try {
      // Wait for the page to be fully loaded
      await testPage.waitForLoadState('networkidle');
      
      // Locate the category selector
      const categorySelect = testPage.locator('#category_select');
      await expect(categorySelect).toBeVisible();
      
      // Click on the category selector to open the dropdown
      await categorySelect.click();
      
      // Wait a moment for the dropdown to fully open
      await testPage.waitForTimeout(500);
      
      // Get all option elements
      const options = categorySelect.locator('option');
      
      // Verify we have the expected number of options (1 for "All Categories" + 5 seeded categories)
      const expectedOptionCount = 1 + TEST_CONFIG.schema.categories.length;
      await expect(options).toHaveCount(expectedOptionCount);
      
      // Verify "All Categories" is the first option
      const firstOption = options.nth(0);
      await expect(firstOption).toHaveAttribute('value', '*');
      await expect(firstOption).toHaveText('All Categories');
      
      // Verify the seeded categories are present in the correct order
      for (let i = 0; i < TEST_CONFIG.schema.categories.length; i++) {
        const category = TEST_CONFIG.schema.categories[i];
        const optionIndex = i + 1; // +1 because "All Categories" is at index 0
        
        const option = options.nth(optionIndex);
        await expect(option).toHaveAttribute('value', category.code);
        await expect(option).toHaveText(category.description);
      }
      
      // Verify the complete list of options in order
      const allOptionTexts = await options.allTextContents();
      const expectedTexts = [
        'All Categories',
        'Game',
        'Groaner', 
        'Running In',
        'Running Out',
        'Show Ending'
      ];
      
      expect(allOptionTexts).toEqual(expectedTexts);
      
      // Verify the complete list of option values in order
      const allOptionValues = await Promise.all(
        Array.from({ length: expectedOptionCount }, (_, i) => 
          options.nth(i).getAttribute('value')
        )
      );
      
      const expectedValues = [
        '*',
        'GAME',
        'GROAN',
        'RNIN',
        'RNOUT',
        'END'
      ];
      
      expect(allOptionValues).toEqual(expectedValues);
      
      // Verify that the dropdown is still visible after clicking
      await expect(categorySelect).toBeVisible();
      
      // Click outside to close the dropdown (optional cleanup)
      await testPage.locator('body').click();
    } finally {
      // Always close the test app instance
      if (testApp) {
        await closeApp(testApp);
      }
    }
  });

  test('category management modal opens via menu and displays seeded categories', async () => {
    // Launch a fresh app instance for this test to ensure clean state
    let testApp, testPage;
    try {
      ({ app: testApp, page: testPage } = await launchSeededApp(electron, 'categories'));
    } catch (error) {
      // Note: Debug logging would be available here if needed
    }
    
    try {
      // Wait for the page to be fully loaded
      await testPage.waitForLoadState('networkidle');
      
      // Call the openCategoriesModal function directly through the page context
      // This simulates what happens when the menu is selected
      await testPage.evaluate(() => {
        if (typeof window.openCategoriesModal === 'function') {
          window.openCategoriesModal();
        } else {
          throw new Error('openCategoriesModal function not available');
        }
      });
      
      // Wait for the modal to appear
      await testPage.waitForTimeout(1000);
      
      // Verify the modal appears
      const modal = testPage.locator('#categoryManagementModal');
      await expect(modal).toBeVisible();
      
      // Verify the modal title is correct
      const modalTitle = modal.locator('.modal-title');
      await expect(modalTitle).toHaveText('Manage Categories');
      
      // Wait for the categories to be populated and verify they exist
      const categoryList = modal.locator('#categoryList');
      await expect(categoryList).toBeVisible();
      
      // Wait for the expected number of category rows to appear
      const categoryRows = categoryList.locator('.row');
      await expect(categoryRows).toHaveCount(TEST_CONFIG.schema.categories.length, { timeout: 10000 });
      
      // Additional wait to ensure all elements are fully rendered
      await testPage.waitForTimeout(2000);
      
      // Verify each seeded category is present with correct description
      for (let i = 0; i < TEST_CONFIG.schema.categories.length; i++) {
        const category = TEST_CONFIG.schema.categories[i];
        const row = categoryRows.nth(i);
        
        // Check that the category description is visible
        const descriptionElement = row.locator('.category-description');
        await expect(descriptionElement).toBeVisible({ timeout: 5000 });
        await expect(descriptionElement).toHaveText(category.description);
        
        // Check that the category code attribute is correct
        await expect(descriptionElement).toHaveAttribute('catcode', category.code);
        
        // Verify edit and delete buttons are present
        // The buttons have data-event-setup="true" instead of onclick attributes
        const editButton = row.locator('a.btn-primary[data-event-setup="true"]');
        await expect(editButton).toBeVisible({ timeout: 5000 });
        await expect(editButton).toHaveText('Edit');
        
        const deleteButton = row.locator('a.btn-danger[data-event-setup="true"]');
        await expect(deleteButton).toBeVisible({ timeout: 5000 });
        await expect(deleteButton).toHaveText('Delete');
      }
      
      // Verify the add new category form is present
      const addForm = modal.locator('form[onsubmit="addNewCategory(event)"]');
      await expect(addForm).toBeVisible();
      
      const newCategoryInput = modal.locator('#newCategoryDescription');
      await expect(newCategoryInput).toBeVisible();
      
      // Use a more specific selector for the Add button (first submit button in the add form)
      const addButton = addForm.locator('button[type="submit"]');
      await expect(addButton).toBeVisible();
      await expect(addButton).toHaveText('Add');
      
      // Verify the Save Changes button exists but is initially hidden
      const saveChangesButton = modal.locator('#categoryEditSubmitButton');
      await expect(saveChangesButton).toHaveCount(1);
      await expect(saveChangesButton).toHaveText('Save Changes');
      // Note: This button is initially hidden and only becomes visible when editing
      
      // Close the modal using the close button
      const closeButton = modal.locator('button.btn-secondary[data-bs-dismiss="modal"]');
      await expect(closeButton).toBeVisible();
      await expect(closeButton).toHaveText('Close');
      
      await closeButton.click();
      
      // Verify the modal is no longer visible
      await expect(modal).not.toBeVisible();
    } finally {
      // Always close the test app instance
      if (testApp) {
        await closeApp(testApp);
      }
    }
  });

  test('add new category functionality works correctly', async () => {
    // Launch a fresh app instance for this test to ensure clean state
    let testApp, testPage;
    try {
      ({ app: testApp, page: testPage } = await launchSeededApp(electron, 'categories'));
    } catch (error) {
      // Note: Debug logging would be available here if needed
    }
    
    try {
      // Wait for the page to be fully loaded
      await testPage.waitForLoadState('networkidle');
      
      // Open the categories management modal
      await testPage.evaluate(() => {
        if (typeof window.openCategoriesModal === 'function') {
          window.openCategoriesModal();
        } else {
          throw new Error('openCategoriesModal function not available');
        }
      });
      
      // Wait for the modal to appear
      await testPage.waitForTimeout(1000);
      
      // Verify the modal appears
      const modal = testPage.locator('#categoryManagementModal');
      await expect(modal).toBeVisible();
      
      // Locate the new category input field and add button
      const newCategoryInput = modal.locator('#newCategoryDescription');
      const addButton = modal.locator('form[onsubmit="addNewCategory(event)"] button[type="submit"]');
      
      // Click into the text field
      await newCategoryInput.click();
      
      // Type "Hello World" into the input field
      await newCategoryInput.fill('Hello World');
      
      // Click the Add button
      await addButton.click();
      
      // Wait for the category to be added and the modal to refresh
      await testPage.waitForTimeout(2000);
      
      // Re-read the list of categories in the modal
      const categoryList = modal.locator('#categoryList');
      const categoryRows = categoryList.locator('.row');
      
      // We should now have 6 categories (5 original + 1 new)
      await expect(categoryRows).toHaveCount(6, { timeout: 10000 });
      
      // Find the "Hello World" category and verify its position
      let helloWorldFound = false;
      let helloWorldPosition = -1;
      
      for (let i = 0; i < 6; i++) {
        const row = categoryRows.nth(i);
        const descriptionElement = row.locator('.category-description');
        const descriptionText = await descriptionElement.textContent();
        
        if (descriptionText === 'Hello World') {
          helloWorldFound = true;
          helloWorldPosition = i;
          break;
        }
      }
      
      // Verify "Hello World" was found
      expect(helloWorldFound).toBe(true);
      expect(helloWorldPosition).toBeGreaterThanOrEqual(0);
      
      // Verify "Hello World" appears between "Groaner" and "Running In"
      // Expected order: All Categories, Game, Groaner, Hello World, Running In, Running Out, Show Ending
      // In the modal (without "All Categories"): Game, Groaner, Hello World, Running In, Running Out, Show Ending
      // So "Hello World" should be at index 2 (between Groaner at index 1 and Running In at index 3)
      expect(helloWorldPosition).toBe(2);
      
      // Verify the categories around "Hello World" are correct
      const beforeHelloWorld = await categoryRows.nth(1).locator('.category-description').textContent();
      const afterHelloWorld = await categoryRows.nth(3).locator('.category-description').textContent();
      
      expect(beforeHelloWorld).toBe('Groaner');
      expect(afterHelloWorld).toBe('Running In');
      
      // Close the modal using the Close button
      const closeButton = modal.locator('button.btn-secondary[data-bs-dismiss="modal"]');
      await closeButton.click();
      
      // Verify the modal is no longer visible
      await expect(modal).not.toBeVisible();
      
      // Click the category selector in the search area
      const categorySelect = testPage.locator('#category_select');
      await categorySelect.click();
      
      // Wait a moment for the dropdown to fully open
      await testPage.waitForTimeout(500);
      
      // Get all option elements
      const options = categorySelect.locator('option');
      
      // We should now have 7 options (1 for "All Categories" + 6 categories)
      await expect(options).toHaveCount(7, { timeout: 10000 });
      
      // Verify "Hello World" appears in the select options between "Groaner" and "Running In"
      const allOptionTexts = await options.allTextContents();
      const expectedTexts = [
        'All Categories',
        'Game',
        'Groaner',
        'Hello World',
        'Running In',
        'Running Out',
        'Show Ending'
      ];
      
      expect(allOptionTexts).toEqual(expectedTexts);
      
      // Verify the complete list of option values in order
      const allOptionValues = await Promise.all(
        Array.from({ length: 7 }, (_, i) => 
          options.nth(i).getAttribute('value')
        )
      );
      
      // The new category should have a generated code, so we'll check the structure
      // First 3 values should be: '*', 'GAME', 'GROAN'
      // Then the new category with some generated code
      // Then: 'RNIN', 'RNOUT', 'END'
      expect(allOptionValues[0]).toBe('*'); // All Categories
      expect(allOptionValues[1]).toBe('GAME'); // Game
      expect(allOptionValues[2]).toBe('GROAN'); // Groaner
      expect(allOptionValues[3]).toMatch(/^[A-Z]+$/); // New category should have uppercase code
      expect(allOptionValues[4]).toBe('RNIN'); // Running In
      expect(allOptionValues[5]).toBe('RNOUT'); // Running Out
      expect(allOptionValues[6]).toBe('END'); // Show Ending
      
      // Click outside to close the dropdown
      await testPage.locator('body').click();
    } finally {
      // Always close the test app instance
      if (testApp) {
        await closeApp(testApp);
      }
    }
  });

  test('category deletion functionality', async () => {
    // Launch a fresh app instance for this test to ensure clean state
    let testApp, testPage;
    try {
      ({ app: testApp, page: testPage } = await launchSeededApp(electron, 'categories'));
    } catch (error) {
      // Note: Debug logging would be available here if needed
    }
    
    try {
      // Wait for the page to be fully loaded
      await testPage.waitForLoadState('networkidle');
      
      // Open the categories management modal
      await testPage.evaluate(() => {
        if (typeof window.openCategoriesModal === 'function') {
          window.openCategoriesModal();
        } else {
          throw new Error('openCategoriesModal function not available');
        }
      });
      
      // Wait for the modal to appear
      await testPage.waitForTimeout(1000);
      
      // Verify the modal appears
      const modal = testPage.locator('#categoryManagementModal');
      await expect(modal).toBeVisible();
      
      // Verify the modal title is correct
      const modalTitle = modal.locator('.modal-title');
      await expect(modalTitle).toHaveText('Manage Categories');
      
      // Wait for the categories to be populated
      await testPage.waitForTimeout(1000);
      
      // Verify the category list container exists
      const categoryList = modal.locator('#categoryList');
      await expect(categoryList).toBeVisible();
      
      // Verify we have exactly 5 category rows (the seeded categories)
      const categoryRows = categoryList.locator('.row');
      await expect(categoryRows).toHaveCount(5, { timeout: 10000 });
      
      // Verify each seeded category is present with correct description
      for (let i = 0; i < TEST_CONFIG.schema.categories.length; i++) {
        const category = TEST_CONFIG.schema.categories[i];
        const row = categoryRows.nth(i);
        
        // Check that the category description is visible
        const descriptionElement = row.locator('.category-description');
        await expect(descriptionElement).toBeVisible({ timeout: 5000 });
        await expect(descriptionElement).toHaveText(category.description);
        
        // Check that the category code attribute is correct
        await expect(descriptionElement).toHaveAttribute('catcode', category.code);
        
        // Verify edit and delete buttons are present
        const editButton = row.locator('a.btn-primary[data-event-setup="true"]');
        await expect(editButton).toBeVisible({ timeout: 5000 });
        await expect(editButton).toHaveText('Edit');
        
        const deleteButton = row.locator('a.btn-danger[data-event-setup="true"]');
        await expect(deleteButton).toBeVisible({ timeout: 5000 });
        await expect(deleteButton).toHaveText('Delete');
      }
      
      // Find the "Running In" category row and click its Delete button
      let runningInRow = null;
      let runningInDeleteButton = null;
      
      for (let i = 0; i < TEST_CONFIG.schema.categories.length; i++) {
        const row = categoryRows.nth(i);
        const descriptionElement = row.locator('.category-description');
        const descriptionText = await descriptionElement.textContent();
        
        if (descriptionText === 'Running In') {
          runningInRow = row;
          runningInDeleteButton = row.locator('a.btn-danger[data-event-setup="true"]');
          break;
        }
      }
      
      // Verify we found the "Running In" category
      expect(runningInRow).not.toBeNull();
      expect(runningInDeleteButton).not.toBeNull();
      
      // Click the Delete button for "Running In"
      await runningInDeleteButton.click();
      
      // Wait for the confirmation modal to appear
      await testPage.waitForTimeout(500);
      
      // Look for the dynamically created confirmation modal
      const confirmationModal = testPage.locator('.modal').filter({ hasText: 'Are you sure you want to delete "Running In"' }).first();
      
      // Verify the confirmation modal is visible
      await expect(confirmationModal).toBeVisible();
      
      // Get the confirmation text
      const confirmationText = await confirmationModal.textContent();
      
      // Verify the confirmation text contains the expected message
      expect(confirmationText).toContain('Are you sure you want to delete "Running In" from Mx. Voice permanently?');
      expect(confirmationText).toContain('All songs in this category will be changed to the category "Uncategorized."');
      
      // Look for the Confirm button in the confirmation modal
      const confirmButton = confirmationModal.locator('button').filter({ hasText: 'Confirm' });
      
      // Verify the Confirm button is visible
      await expect(confirmButton).toBeVisible();
      
      // Click the Confirm button
      await confirmButton.click();
      
      // Wait for the confirmation modal to close and the category list to refresh
      await testPage.waitForTimeout(2000);
      
      // Verify the confirmation modal is no longer visible
      await expect(confirmationModal).not.toBeVisible();
      
      // Verify the Manage Categories modal is still visible
      await expect(modal).toBeVisible();
      
      // Verify that there are now only 4 categories listed
      const updatedCategoryRows = categoryList.locator('.row');
      await expect(updatedCategoryRows).toHaveCount(5, { timeout: 10000 });
      
      // Verify that "Running In" is no longer in the list and "Uncategorized" is present at the bottom
      const updatedCount = await updatedCategoryRows.count();
      let runningInStillExists = false;
      let uncategorizedFound = false;
      for (let i = 0; i < updatedCount; i++) {
        const row = updatedCategoryRows.nth(i);
        const descriptionElement = row.locator('.category-description');
        const descriptionText = await descriptionElement.textContent();
        if (descriptionText === 'Running In') runningInStillExists = true;
        if (descriptionText === 'Uncategorized') uncategorizedFound = true;
      }
      expect(runningInStillExists).toBe(false);
      expect(uncategorizedFound).toBe(true);
      // Ensure "Uncategorized" is the last item
      const lastDescription = await updatedCategoryRows
        .nth(updatedCount - 1)
        .locator('.category-description')
        .textContent();
      expect(lastDescription).toBe('Uncategorized');
      
      // Close the Manage Categories modal using the close button
      const closeButton = modal.locator('button.btn-secondary[data-bs-dismiss="modal"]');
      await closeButton.click();
      
      // Verify the modal is no longer visible
      await expect(modal).not.toBeVisible();
      
      // Click the category selector in the search area
      const categorySelect = testPage.locator('#category_select');
      await categorySelect.click();
      
      // Wait a moment for the dropdown to fully open
      await testPage.waitForTimeout(500);
      
      // Get all option elements
      const options = categorySelect.locator('option');
      
      // We should now have 6 options (1 for "All Categories" + 4 remaining categories)
      await expect(options).toHaveCount(6, { timeout: 10000 });
      
      // Verify "Running In" is no longer in the dropdown options
      const allOptionTexts = await options.allTextContents();
      expect(allOptionTexts).not.toContain('Running In');
      
      // Verify the expected categories are still present
      const expectedTexts = [
        'All Categories',
        'Game',
        'Groaner',
        'Running Out',
        'Show Ending',
        'Uncategorized'
      ];
      
      expect(allOptionTexts).toEqual(expectedTexts);
      
      // Click outside to close the dropdown
      await testPage.locator('body').click();
      
      // Now reopen the manage categories modal to delete another category
      await testPage.evaluate(() => {
        if (typeof window.openCategoriesModal === 'function') {
          window.openCategoriesModal();
        } else {
          throw new Error('openCategoriesModal function not available');
        }
      });
      
      // Wait for the modal to appear
      await testPage.waitForTimeout(1000);
      
      // Verify the modal appears
      await expect(modal).toBeVisible();
      
      // Wait for the categories to be populated
      await testPage.waitForTimeout(1000);
      
      // Verify the category list container exists
      await expect(categoryList).toBeVisible();
      
      // We should now have 5 categories (4 original + 1 Uncategorized)
      const reopenedCategoryRows = categoryList.locator('.row');
      await expect(reopenedCategoryRows).toHaveCount(5, { timeout: 10000 });
      
      // Find the "Running Out" category row and click its Delete button
      let runningOutRow = null;
      let runningOutDeleteButton = null;
      
      for (let i = 0; i < 5; i++) {
        const row = reopenedCategoryRows.nth(i);
        const descriptionElement = row.locator('.category-description');
        const descriptionText = await descriptionElement.textContent();
        
        if (descriptionText === 'Running Out') {
          runningOutRow = row;
          runningOutDeleteButton = row.locator('a.btn-danger[data-event-setup="true"]');
          break;
        }
      }
      
      // Verify we found the "Running Out" category
      expect(runningOutRow).not.toBeNull();
      expect(runningOutDeleteButton).not.toBeNull();
      
      // Click the Delete button for "Running Out"
      await runningOutDeleteButton.click();
      
      // Wait for the confirmation modal to appear
      await testPage.waitForTimeout(500);
      
      // Look for the dynamically created confirmation modal
      const runningOutConfirmationModal = testPage.locator('.modal').filter({ hasText: 'Are you sure you want to delete "Running Out"' }).first();
      
      // Verify the confirmation modal is visible
      await expect(runningOutConfirmationModal).toBeVisible();
      
      // Get the confirmation text
      const runningOutConfirmationText = await runningOutConfirmationModal.textContent();
      
      // Verify the confirmation text contains the expected message
      expect(runningOutConfirmationText).toContain('Are you sure you want to delete "Running Out" from Mx. Voice permanently?');
      expect(runningOutConfirmationText).toContain('All songs in this category will be changed to the category "Uncategorized."');
      
      // Look for the Confirm button in the confirmation modal
      const runningOutConfirmButton = runningOutConfirmationModal.locator('button').filter({ hasText: 'Confirm' });
      
      // Verify the Confirm button is visible
      await expect(runningOutConfirmButton).toBeVisible();
      
      // Click the Confirm button
      await runningOutConfirmButton.click();
      
      // Wait for the confirmation modal to close and the category list to refresh
      await testPage.waitForTimeout(2000);
      
      // Verify the confirmation modal is no longer visible
      await expect(runningOutConfirmationModal).not.toBeVisible();
      
      // Verify the Manage Categories modal is still visible
      await expect(modal).toBeVisible();
      
      // Verify that there are now only 4 categories listed
      const finalCategoryRows = categoryList.locator('.row');
      await expect(finalCategoryRows).toHaveCount(4, { timeout: 10000 });
      
      // Verify that both "Running In" and "Running Out" are no longer in the list
      // and that there is exactly one "Uncategorized" category
      const finalCount = await finalCategoryRows.count();
      let runningInStillExistsFinal = false;
      let runningOutStillExistsFinal = false;
      let uncategorizedCount = 0;
      
      for (let i = 0; i < finalCount; i++) {
        const row = finalCategoryRows.nth(i);
        const descriptionElement = row.locator('.category-description');
        const descriptionText = await descriptionElement.textContent();
        if (descriptionText === 'Running In') runningInStillExistsFinal = true;
        if (descriptionText === 'Running Out') runningOutStillExistsFinal = true;
        if (descriptionText === 'Uncategorized') uncategorizedCount++;
      }
      
      expect(runningInStillExistsFinal).toBe(false);
      expect(runningOutStillExistsFinal).toBe(false);
      expect(uncategorizedCount).toBe(1);
      
      // Close the Manage Categories modal using the close button
      const finalCloseButton = modal.locator('button.btn-secondary[data-bs-dismiss="modal"]');
      await finalCloseButton.click();
      
      // Verify the modal is no longer visible
      await expect(modal).not.toBeVisible();
      
      // Click the category selector in the search area
      const finalCategorySelect = testPage.locator('#category_select');
      await finalCategorySelect.click();
      
      // Wait a moment for the dropdown to fully open
      await testPage.waitForTimeout(500);
      
      // Get all option elements
      const finalOptions = finalCategorySelect.locator('option');
      
      // We should now have 5 options (1 for "All Categories" + 4 remaining categories)
      await expect(finalOptions).toHaveCount(5, { timeout: 10000 });
      
      // Verify both "Running In" and "Running Out" are no longer in the dropdown options
      // and that there is exactly one "Uncategorized"
      const finalAllOptionTexts = await finalOptions.allTextContents();
      expect(finalAllOptionTexts).not.toContain('Running In');
      expect(finalAllOptionTexts).not.toContain('Running Out');
      
      // Count "Uncategorized" occurrences
      const uncategorizedInDropdown = finalAllOptionTexts.filter(text => text === 'Uncategorized').length;
      expect(uncategorizedInDropdown).toBe(1);
      
      // Verify the expected categories are present
      const finalExpectedTexts = [
        'All Categories',
        'Game',
        'Groaner',
        'Show Ending',
        'Uncategorized'
      ];
      
      expect(finalAllOptionTexts).toEqual(finalExpectedTexts);
      
      // Click outside to close the dropdown
      await testPage.locator('body').click();
      
      // Now test that songs were moved to Uncategorized by selecting it from the category selector
      // and verifying that "Theme From The Greatest American Hero" appears in search results
      const finalCategorySelectForSearch = testPage.locator('#category_select');
      
      // Select "Uncategorized" by value on the native select (fires change event)
      await finalCategorySelectForSearch.selectOption('UNC');
      
      // Wait for the search to execute and results to appear
      await testPage.waitForTimeout(1000);
      
      // Verify that the search results area shows one song
      const searchResults = testPage.locator('#search_results tbody tr');
      await expect(searchResults).toHaveCount(1, { timeout: 10000 });
      
      // Verify that the row contains the expected song title
      const firstRow = searchResults.nth(0);
      await expect(firstRow).toContainText('Theme From The Greatest American Hero');
      
      // Click outside to close the dropdown
      await testPage.locator('body').click();
    } finally {
      // Always close the test app instance
      if (testApp) {
        await closeApp(testApp);
      }
    }
  });

  test('category edit functionality', async () => {
    // Launch a fresh app instance for this test to ensure clean state
    let testApp, testPage;
    try {
      ({ app: testApp, page: testPage } = await launchSeededApp(electron, 'categories'));
    } catch (error) {
      // Note: Debug logging would be available here if needed
    }
    
    try {
      // Wait for the page to be fully loaded
      await testPage.waitForLoadState('networkidle');
      
      // Open the categories management modal
      await testPage.evaluate(() => {
        if (typeof window.openCategoriesModal === 'function') {
          window.openCategoriesModal();
        } else {
          throw new Error('openCategoriesModal function not available');
        }
      });
      
      // Wait for the modal to appear
      await testPage.waitForTimeout(1000);
      
      // Verify the modal appears
      const modal = testPage.locator('#categoryManagementModal');
      await expect(modal).toBeVisible();
      
      // Verify the modal title is correct
      const modalTitle = modal.locator('.modal-title');
      await expect(modalTitle).toHaveText('Manage Categories');
      
      // Wait for the categories to be populated
      await testPage.waitForTimeout(1000);
      
      // Verify the category list container exists
      const categoryList = modal.locator('#categoryList');
      await expect(categoryList).toBeVisible();
      
      // Verify we have exactly 5 category rows (the seeded categories)
      const categoryRows = categoryList.locator('.row');
      await expect(categoryRows).toHaveCount(5, { timeout: 10000 });
      
      // Find the "Running In" category row and click its Edit button
      let runningInRow = null;
      let runningInEditButton = null;
      
      for (let i = 0; i < TEST_CONFIG.schema.categories.length; i++) {
        const row = categoryRows.nth(i);
        const descriptionElement = row.locator('.category-description');
        const descriptionText = await descriptionElement.textContent();
        
        if (descriptionText === 'Running In') {
          runningInRow = row;
          runningInEditButton = row.locator('a.btn-primary[data-event-setup="true"]');
          break;
        }
      }
      
      // Verify we found the "Running In" category
      expect(runningInRow).not.toBeNull();
      expect(runningInEditButton).not.toBeNull();
      
      // Click the Edit button for "Running In"
      await runningInEditButton.click();
      
      // Wait for the edit mode to activate
      await testPage.waitForTimeout(500);
      
      // The description should now be hidden and an input field should be visible
      const descriptionElement = runningInRow.locator('.category-description');
      await expect(descriptionElement).not.toBeVisible();
      
      // Find the input field that should now be visible
      const editInput = runningInRow.locator('input.categoryDescription');
      await expect(editInput).toBeVisible();
      
      // Verify the input field contains "Running In"
      await expect(editInput).toHaveValue('Running In');
      
      // Clear the input field and type "Edited Running In" - click first to ensure focus
      await editInput.click();
      await editInput.clear();
      await editInput.fill('Edited Running In');
      
      // The edit is not automatically saved by pressing Enter
      // We need to submit the form to save the changes
      // Look for the form that contains the category list
      const categoryForm = modal.locator('#currentCategoriesForm');
      await expect(categoryForm).toBeVisible();
      
      // Submit the form to save the changes
      await categoryForm.evaluate(form => form.dispatchEvent(new Event('submit')));
      
      // Wait for the save to complete and UI to refresh
      await testPage.waitForTimeout(2000);
      
      // Re-read the modal DOM after save to avoid stale references
      const refreshedCategoryList = modal.locator('#categoryList');
      const refreshedRows = refreshedCategoryList.locator('.row');
      await expect(refreshedRows).toHaveCount(5, { timeout: 10000 });

      // Verify that "Edited Running In" is present and now at the top due to alphabetical ordering
      const firstCategory = refreshedRows.nth(0).locator('.category-description');
      await expect(firstCategory).toHaveText('Edited Running In');

      // Verify that "Running In" is no longer in the list
      const refreshedDescriptions = await Promise.all(
        Array.from({ length: 5 }, (_, i) => refreshedRows.nth(i).locator('.category-description').textContent())
      );
      expect(refreshedDescriptions).toContain('Edited Running In');
      expect(refreshedDescriptions).not.toContain('Running In');
      
      // Close the modal using the close button
      const closeButton = modal.locator('button.btn-secondary[data-bs-dismiss="modal"]');
      await closeButton.click();
      
      // Verify the modal is no longer visible
      await expect(modal).not.toBeVisible();
      
      // Click the category selector in the search area
      const categorySelect = testPage.locator('#category_select');
      await categorySelect.click();
      
      // Wait a moment for the dropdown to fully open
      await testPage.waitForTimeout(500);
      
      // Get all option elements
      const options = categorySelect.locator('option');
      
      // We should still have 6 options (1 for "All Categories" + 5 categories)
      await expect(options).toHaveCount(6, { timeout: 10000 });
      
      // Verify "Edited Running In" is in the dropdown options and "Running In" is not
      const allOptionTexts = await options.allTextContents();
      expect(allOptionTexts).toContain('Edited Running In');
      expect(allOptionTexts).not.toContain('Running In');
      
      // Verify the expected categories are present
      const expectedTexts = [
        'All Categories',
        'Edited Running In',
        'Game',
        'Groaner',
        'Running Out',
        'Show Ending'
      ];
      
      expect(allOptionTexts).toEqual(expectedTexts);
      
      // Click outside to close the dropdown
      await testPage.locator('body').click();
    } finally {
      // Always close the test app instance
      if (testApp) {
        await closeApp(testApp);
      }
    }
  });
});


