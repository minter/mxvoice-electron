/**
 * Navigation Event Handlers
 * 
 * Handles UI event handlers for navigation functionality
 */

// Import navigation functions
import { sendToHotkeys, sendToHoldingTank, selectNext, selectPrev } from './navigation-functions.js';

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
 * Setup all navigation event handlers
 */
export function setupNavigationEventHandlers() {
  // Tab key navigation - send to hotkeys
  Mousetrap.bind("tab", function () {
    sendToHotkeys();
    return false;
  });

  // Shift+Tab key navigation - send to holding tank
  Mousetrap.bind("shift+tab", function () {
    sendToHoldingTank();
    return false;
  });

  // Down arrow key navigation - select next
  Mousetrap.bind("down", function () {
    selectNext();
    return false;
  });

  // Up arrow key navigation - select previous
  Mousetrap.bind("up", function () {
    selectPrev();
    return false;
  });

  debugLog?.info('Navigation Event Handlers initialized', { 
    module: 'navigation-event-handlers',
    function: 'setupNavigationEventHandlers'
  });
} 