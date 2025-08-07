/**
 * Utils Module Index
 * 
 * This module serves as the main entry point for all utility functions
 * in the MxVoice Electron application.
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

// Import all utility modules
import animationUtils from './animation-utils.js';
import modalUtils from './modal-utils.js';
import validationUtils from './validation-utils.js';

/**
 * Utils Module Class
 * 
 * Provides a unified interface for all utility functions
 */
class UtilsModule {
  constructor() {
    // Initialize module state
    this.animateCSS = animationUtils.animateCSS;
    this.customConfirm = modalUtils.customConfirm;
    this.customPrompt = modalUtils.customPrompt;
    this.restoreFocusToSearch = modalUtils.restoreFocusToSearch;
    this.isValidSongId = validationUtils.isValidSongId;
    this.isValidCategoryCode = validationUtils.isValidCategoryCode;
    this.isValidFilePath = validationUtils.isValidFilePath;
    this.isValidHotkey = validationUtils.isValidHotkey;
  }

  /**
   * Initialize the utils module
   * This method can be called to set up any initialization logic
   */
  init() {
    debugLog?.info('Utils module initialized', { 
      module: 'utils',
      function: 'init'
    });
  }

  /**
   * Get all available utility functions
   * 
   * @returns {Object} - Object containing all utility functions
   */
  getAllUtils() {
    return {
      // Animation utilities
      animateCSS: this.animateCSS,
      
      // Modal utilities
      customConfirm: this.customConfirm,
      customPrompt: this.customPrompt,
      restoreFocusToSearch: this.restoreFocusToSearch,
      
      // Validation utilities
      isValidSongId: this.isValidSongId,
      isValidCategoryCode: this.isValidCategoryCode,
      isValidFilePath: this.isValidFilePath,
      isValidHotkey: this.isValidHotkey
    };
  }

  /**
   * Test all utility functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {
      animation: {},
      modal: {},
      validation: {}
    };

    // Test animation utilities
    try {
      // Test animateCSS function exists
      if (typeof this.animateCSS === 'function') {
        results.animation.animateCSS = '✅ Function exists';
      } else {
        results.animation.animateCSS = '❌ Function missing';
      }
    } catch (error) {
      results.animation.animateCSS = `❌ Error: ${error.message}`;
    }

    // Test modal utilities
    try {
      if (typeof this.customConfirm === 'function') {
        results.modal.customConfirm = '✅ Function exists';
      } else {
        results.modal.customConfirm = '❌ Function missing';
      }

      if (typeof this.customPrompt === 'function') {
        results.modal.customPrompt = '✅ Function exists';
      } else {
        results.modal.customPrompt = '❌ Function missing';
      }

      if (typeof this.restoreFocusToSearch === 'function') {
        results.modal.restoreFocusToSearch = '✅ Function exists';
      } else {
        results.modal.restoreFocusToSearch = '❌ Function missing';
      }
    } catch (error) {
      results.modal.error = `❌ Error: ${error.message}`;
    }

    // Test validation utilities
    try {
      if (typeof this.isValidSongId === 'function') {
        results.validation.isValidSongId = '✅ Function exists';
      } else {
        results.validation.isValidSongId = '❌ Function missing';
      }

      if (typeof this.isValidCategoryCode === 'function') {
        results.validation.isValidCategoryCode = '✅ Function exists';
      } else {
        results.validation.isValidCategoryCode = '❌ Function missing';
      }

      if (typeof this.isValidFilePath === 'function') {
        results.validation.isValidFilePath = '✅ Function exists';
      } else {
        results.validation.isValidFilePath = '❌ Function missing';
      }

      if (typeof this.isValidHotkey === 'function') {
        results.validation.isValidHotkey = '✅ Function exists';
      } else {
        results.validation.isValidHotkey = '❌ Function missing';
      }
    } catch (error) {
      results.validation.error = `❌ Error: ${error.message}`;
    }

    return results;
  }

  /**
   * Get module information
   * 
   * @returns {Object} - Module information
   */
  getInfo() {
    return {
      name: 'Utils Module',
      version: '1.0.0',
      description: 'Provides utility functions for animation, modals, and validation',
      functions: this.getAllUtils()
    };
  }
}

// Create and export a singleton instance
const utilsModule = new UtilsModule();

// Export individual utilities for backward compatibility
export const animateCSS = utilsModule.animateCSS;
export const customConfirm = utilsModule.customConfirm;
export const customPrompt = utilsModule.customPrompt;
export const restoreFocusToSearch = utilsModule.restoreFocusToSearch;
export const isValidSongId = utilsModule.isValidSongId;
export const isValidCategoryCode = utilsModule.isValidCategoryCode;
export const isValidFilePath = utilsModule.isValidFilePath;
export const isValidHotkey = utilsModule.isValidHotkey;

// Default export for module loading
export default utilsModule; 