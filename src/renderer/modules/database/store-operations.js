/**
 * Store Operations Module
 * 
 * Handles saving data to the electron store for persistence.
 * This module manages the storage of UI state like holding tank
 * and hotkeys data.
 */

/**
 * Save holding tank to store
 * Saves the current holding tank HTML to the store for persistence
 */
function saveHoldingTankToStore() {
  // Only save if we have the new HTML format with mode toggle
  var currentHtml = $("#holding-tank-column").html();
  if (currentHtml.includes("mode-toggle")) {
    window.electronAPI.store.set("holding_tank", currentHtml);
  }
}

/**
 * Save hotkeys to store
 * Saves the current hotkeys HTML to the store for persistence
 */
function saveHotkeysToStore() {
  // Only save if we have the new HTML format with header button
  var currentHtml = $("#hotkeys-column").html();
  if (currentHtml.includes("header-button")) {
    window.electronAPI.store.set("hotkeys", currentHtml);
  }
}

module.exports = {
  saveHoldingTankToStore,
  saveHotkeysToStore
}; 