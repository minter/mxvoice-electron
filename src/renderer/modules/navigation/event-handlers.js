/**
 * Navigation Event Handlers
 * 
 * Handles UI event handlers for navigation functionality
 */

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

  console.log('✅ Navigation Event Handlers initialized');
} 