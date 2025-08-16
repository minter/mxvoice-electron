/**
 * Navigation Module
 * 
 * Handles all navigation functionality for moving between items
 * and sending songs to different containers
 */

import { sendToHotkeys, sendToHoldingTank, selectNext, selectPrev } from './navigation-functions.js';
import { setupNavigationEventHandlers } from './event-handlers.js';

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

/**
 * Navigation Singleton
 * 
 * Provides a unified interface for all navigation operations
 */
class NavigationModule {
  constructor() {
    // Bind all functions as methods
    this.sendToHotkeys = sendToHotkeys;
    this.sendToHoldingTank = sendToHoldingTank;
    this.selectNext = selectNext;
    this.selectPrev = selectPrev;
  }

  /**
   * Initialize the navigation module
   */
  initializeNavigation() {
    // Setup event handlers for navigation
    setupNavigationEventHandlers();
    // Global exposure is handled centrally by the function registry to avoid duplicates
    // Do not assign navigation functions directly to window here

    debugLog?.info('Navigation Module initialized', { 
      module: 'navigation',
      function: 'initializeNavigation'
    });
  }

  /**
   * Initialize the module (standardized method)
   * @param {Object} dependencies - Module dependencies
   * @returns {Promise<boolean>} Success status
   */
  async init(dependencies = {}) {
    try {
      debugLog?.info('Navigation module initializing...', { 
        module: 'navigation', 
        function: 'init' 
      });

      // Call the existing initialization logic
      this.initializeNavigation();
      
      debugLog?.info('Navigation module initialized successfully', { 
        module: 'navigation', 
        function: 'init' 
      });
      return true;
    } catch (error) {
      debugLog?.error('Failed to initialize Navigation module:', { 
        module: 'navigation', 
        function: 'init', 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Get all navigation functions
   * 
   * @returns {Object} - Object containing all navigation functions
   */
  getAllNavigationFunctions() {
    return {
      sendToHotkeys: this.sendToHotkeys,
      sendToHoldingTank: this.sendToHoldingTank,
      selectNext: this.selectNext,
      selectPrev: this.selectPrev
    };
  }

  /**
   * Test all navigation functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {};

    // Test each function
    const functions = [
      'sendToHotkeys',
      'sendToHoldingTank',
      'selectNext',
      'selectPrev'
    ];

    for (const funcName of functions) {
      if (typeof this[funcName] === 'function') {
        results[funcName] = '✅ Function exists';
      } else {
        results[funcName] = '❌ Function missing';
      }
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
      name: 'Navigation Module',
      version: '1.0.0',
      description: 'Provides navigation functionality',
      functions: this.getAllNavigationFunctions()
    };
  }
}

// Create and export a singleton instance
const navigationModule = new NavigationModule();

// Default export for module loading
export default navigationModule; 