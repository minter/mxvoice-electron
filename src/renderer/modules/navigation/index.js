/**
 * Navigation Module
 * 
 * Handles all navigation functionality for moving between items
 * and sending songs to different containers
 */

import { sendToHotkeys, sendToHoldingTank, selectNext, selectPrev } from './navigation-functions.js';
import { setupNavigationEventHandlers } from './event-handlers.js';

/**
 * Initialize the navigation module
 */
export function initializeNavigation() {
  // Setup event handlers for navigation
  setupNavigationEventHandlers();
  
  console.log('✅ Navigation Module initialized');
}

/**
 * Get all navigation functions
 */
export function getNavigationFunctions() {
  return {
    sendToHotkeys,
    sendToHoldingTank,
    selectNext,
    selectPrev
  };
}

// Export individual functions for direct access
export {
  sendToHotkeys,
  sendToHoldingTank,
  selectNext,
  selectPrev
}; 