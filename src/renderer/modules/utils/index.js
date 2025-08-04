/**
 * Utils Module Index
 * 
 * This module serves as the main entry point for all utility functions
 * in the MxVoice Electron application.
 */

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
  }

  /**
   * Initialize the utils module
   * This method can be called to set up any initialization logic
   */
  init() {
    console.log('Utils module initialized');
  }

  /**
   * Get all available utility functions
   * 
   * @returns {Object} - Object containing all utility functions
   */
  getAllUtils() {
    return {
      // Animation utilities
      animateCSS: animationUtils.animateCSS,
      
      // Modal utilities
      customConfirm: modalUtils.customConfirm,
      customPrompt: modalUtils.customPrompt,
      restoreFocusToSearch: modalUtils.restoreFocusToSearch,
      
      // Validation utilities
      isValidSongId: validationUtils.isValidSongId,
      isValidCategoryCode: validationUtils.isValidCategoryCode,
      isValidFilePath: validationUtils.isValidFilePath,
      isValidHotkey: validationUtils.isValidHotkey
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

// Export the module instance and individual utilities for backward compatibility
export {
  // Individual utilities (for direct access)
  animateCSS: utilsModule.animateCSS,
  customConfirm: utilsModule.customConfirm,
  customPrompt: utilsModule.customPrompt,
  restoreFocusToSearch: utilsModule.restoreFocusToSearch,
  isValidSongId: utilsModule.isValidSongId,
  isValidCategoryCode: utilsModule.isValidCategoryCode,
  isValidFilePath: utilsModule.isValidFilePath,
  isValidHotkey: utilsModule.isValidHotkey
};

// Default export for module loading
export default utilsModule; 