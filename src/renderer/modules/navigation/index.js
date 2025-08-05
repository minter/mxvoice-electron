/**
 * Navigation Module
 * 
 * Handles all navigation functionality for moving between items
 * and sending songs to different containers
 */

import { sendToHotkeys, sendToHoldingTank, selectNext, selectPrev } from './navigation-functions.js';
import { setupNavigationEventHandlers } from './event-handlers.js';

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
    
    console.log('✅ Navigation Module initialized');
  }

  /**
   * Initialize the module (alias for initializeNavigation)
   */
  init() {
    this.initializeNavigation();
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

// Export individual functions for backward compatibility
export const sendToHotkeys = navigationModule.sendToHotkeys;
export const sendToHoldingTank = navigationModule.sendToHoldingTank;
export const selectNext = navigationModule.selectNext;
export const selectPrev = navigationModule.selectPrev;
export const initializeNavigation = navigationModule.initializeNavigation.bind(navigationModule);

// Default export for module loading
export default navigationModule; 