/**
 * Utils Module Index
 * 
 * This module serves as the main entry point for all utility functions
 * in the MxVoice Electron application.
 */

// Import all utility modules
import { animateCSS as animateCSSFn } from './animation-utils.js';
import { customConfirm as customConfirmFn, customPrompt as customPromptFn, customAlert as customAlertFn } from './modal-utils.js';
import { scaleScrollable as scaleScrollableFn } from './layout-utils.js';
import { restoreFocusToSearch as restoreFocusToSearchFn } from './modal-utils.js';
import { isValidSongId as isValidSongIdFn, isValidCategoryCode as isValidCategoryCodeFn, isValidFilePath as isValidFilePathFn, isValidHotkey as isValidHotkeyFn } from './validation-utils.js';

/**
 * Utils Module
 * 
 * Provides utility functions for the MxVoice Electron application
 */
class UtilsModule {
  constructor() {
    this.animateCSS = animateCSSFn;
    this.customConfirm = customConfirmFn;
    this.customPrompt = customPromptFn;
    this.customAlert = customAlertFn;
    this.scaleScrollable = scaleScrollableFn;
    this.restoreFocusToSearch = restoreFocusToSearchFn;
    this.isValidSongId = isValidSongIdFn;
    this.isValidCategoryCode = isValidCategoryCodeFn;
    this.isValidFilePath = isValidFilePathFn;
    this.isValidHotkey = isValidHotkeyFn;
  }

  /**
   * Initialize the utils module
   * @param {Object} dependencies - Module dependencies
   * @returns {Promise<boolean>} - Success status
   */
  async init(dependencies = {}) {
    // Utils module is self-contained, no external dependencies needed
    return true;
  }

  /**
   * Test utility functions
   * @returns {Object} Test results
   */
  testUtils() {
    const results = {
      module: 'utils',
      passed: 0,
      failed: 0,
      tests: [],
      animation: {},
      validation: {}
    };

    // Test animateCSS function exists
    if (typeof this.animateCSS === 'function') {
      results.animation.animateCSS = '✅ Function exists';
      results.passed++;
    } else {
      results.animation.animateCSS = '❌ Function missing';
      results.failed++;
    }

    // Test validation functions
    try {
      if (typeof this.isValidSongId === 'function') {
        results.validation.isValidSongId = '✅ Function exists';
        results.passed++;
      } else {
        results.validation.isValidSongId = '❌ Function missing';
        results.failed++;
      }
    } catch (error) {
      results.validation.isValidSongId = `❌ Error: ${error.message}`;
      results.failed++;
    }

    return results;
  }
}

// Create and export singleton instance
const utilsModule = new UtilsModule();

// Named exports for direct import
export const {
  animateCSS,
  customConfirm,
  customPrompt,
  customAlert,
  scaleScrollable,
  restoreFocusToSearch,
  isValidSongId,
  isValidCategoryCode,
  isValidFilePath,
  isValidHotkey
} = utilsModule;

// Default export for module loading
export default utilsModule; 