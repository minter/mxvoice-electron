import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

test.describe('Preferences - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for preferences tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'preferences'));
    
    // Ensure window is visible and focused for reliable input
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    await page.bringToFront();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('preferences modal is present in DOM', async () => {
    const count = await page.locator('#preferencesModal').count();
    expect(count).toBeGreaterThan(0);
  });

  test('preferences modal opens and closes properly', async () => {
    // Modal should start hidden
    await expect(page.locator('#preferencesModal')).not.toBeVisible();
    
    // Open preferences via IPC (main process sends show_preferences event)
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });
    
    // Wait for modal to be visible - Playwright's toBeVisible() handles Bootstrap transitions
    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });
    
    // Close modal via close button
    await page.locator('#preferencesModal .btn-close').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible();
  });

  test('preferences form fields are present and populated', async () => {
    // Open preferences via IPC
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });
    
    // Wait for modal to be visible
    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });
    
    // Wait for preferences to be loaded by waiting for a form field to have a value
    await expect(page.locator('#preferences-database-directory')).toHaveValue(/.+/, { timeout: 5000 });
    
    // Check that all form fields exist
    await expect(page.locator('#preferences-database-directory')).toBeVisible();
    await expect(page.locator('#preferences-song-directory')).toBeVisible();
    await expect(page.locator('#preferences-hotkey-directory')).toBeVisible();
    await expect(page.locator('#preferences-fadeout-seconds')).toBeVisible();
    await expect(page.locator('#preferences-debug-log-enabled')).toBeVisible();
    
    // Check that fields have values (should be populated from current config)
    const dbDir = await page.locator('#preferences-database-directory').inputValue();
    const musicDir = await page.locator('#preferences-song-directory').inputValue();
    const hotkeyDir = await page.locator('#preferences-hotkey-directory').inputValue();
    const fadeSeconds = await page.locator('#preferences-fadeout-seconds').inputValue();
    
    // Fields should have values from the test environment config
    expect(dbDir).toBeTruthy();
    expect(musicDir).toBeTruthy();
    expect(hotkeyDir).toBeTruthy();
    expect(fadeSeconds).toBeTruthy();
    
    // Close modal
    await page.locator('#preferencesModal .btn-close').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible();
  });

  test('preferences can be modified and saved', async () => {
    // Open preferences via IPC
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });
    
    // Wait for modal to be visible
    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });
    
    // Wait for preferences to be loaded by waiting for a form field to have a value
    await expect(page.locator('#preferences-database-directory')).toHaveValue(/.+/, { timeout: 5000 });
    
    // Modify fade out seconds
    const fadeInput = page.locator('#preferences-fadeout-seconds');
    const originalValue = await fadeInput.inputValue();
    const newValue = originalValue === '2' ? '3' : '2';
    
    await fadeInput.clear();
    await fadeInput.fill(newValue);
    
    // Verify the value was actually set before saving
    await expect(fadeInput).toHaveValue(newValue);
    
    // Toggle debug logging
    const debugCheckbox = page.locator('#preferences-debug-log-enabled');
    const originalDebugState = await debugCheckbox.isChecked();
    await debugCheckbox.setChecked(!originalDebugState);
    
    // Save preferences by clicking the Save button (same as user would do)
    await page.locator('#preferencesSubmitButton').click();
    
    // Wait for modal to close (indicates save has been triggered)
    await expect(page.locator('#preferencesModal')).not.toBeVisible({ timeout: 5000 });
    
    // Give a moment for async save operations to complete and file system to sync
    await page.waitForTimeout(1000);
    
    // Reopen modal to verify changes persisted
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });
    
    // Wait for modal to be visible
    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });
    
    // Wait for preferences to be loaded by waiting for a form field to have a value
    await expect(page.locator('#preferences-database-directory')).toHaveValue(/.+/, { timeout: 5000 });
    
    // Verify changes persisted
    const savedFadeValue = await page.locator('#preferences-fadeout-seconds').inputValue();
    const savedDebugState = await page.locator('#preferences-debug-log-enabled').isChecked();
    
    expect(savedFadeValue).toBe(newValue);
    expect(savedDebugState).toBe(!originalDebugState);
    
    // Close modal
    await page.locator('#preferencesModal .btn-close').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible();
  });

  test('directory picker buttons are present and functional', async () => {
    // Open preferences via IPC
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });
    
    // Wait for modal to be visible
    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });
    
    // Wait for preferences to be loaded by waiting for a form field to have a value
    await expect(page.locator('#preferences-database-directory')).toHaveValue(/.+/, { timeout: 5000 });
    
    // Check that directory picker buttons exist using simpler text-based selectors
    const dbPickerBtn = page.locator('button:has-text("Choose Location")').first();
    const musicPickerBtn = page.locator('button:has-text("Choose Location")').nth(1);
    const hotkeyPickerBtn = page.locator('button:has-text("Choose Location")').nth(2);
    
    await expect(dbPickerBtn).toBeVisible();
    await expect(musicPickerBtn).toBeVisible();
    await expect(hotkeyPickerBtn).toBeVisible();
    
    // Verify button text
    await expect(dbPickerBtn).toContainText('Choose Location');
    await expect(musicPickerBtn).toContainText('Choose Location');
    await expect(hotkeyPickerBtn).toContainText('Choose Location');
    
    // Close modal
    await page.locator('#preferencesModal .btn-close').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible();
  });

  test('preferences modal has proper accessibility attributes', async () => {
    // Open preferences via IPC
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.webContents.send('show_preferences');
    });
    
    // Wait for modal to be visible
    await expect(page.locator('#preferencesModal')).toBeVisible({ timeout: 10000 });
    
    // Wait for preferences to be loaded by waiting for a form field to have a value
    await expect(page.locator('#preferences-database-directory')).toHaveValue(/.+/, { timeout: 5000 });
    
    // Check modal accessibility
    const modal = page.locator('#preferencesModal');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('tabindex', '-1');
    
    // Check form field labels
    const dbLabel = page.locator('label[for="preferences-database-directory"]');
    const musicLabel = page.locator('label[for="preferences-song-directory"]');
    const hotkeyLabel = page.locator('label[for="preferences-hotkey-directory"]');
    
    await expect(dbLabel).toContainText('Database File Location');
    await expect(musicLabel).toContainText('Audio Files');
    await expect(hotkeyLabel).toContainText('Hotkeys / Holding Tank');
    
    // Close modal
    await page.locator('#preferencesModal .btn-close').click();
    await expect(page.locator('#preferencesModal')).not.toBeVisible();
  });
});


