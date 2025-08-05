/**
 * Event Handlers Module
 * 
 * Handles UI event handling functions including row selection, tab switching,
 * and renaming operations.
 * 
 * @module event-handlers
 */

/**
 * Initialize the Event Handlers module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Event Handlers interface
 */
function initializeEventHandlers(options = {}) {
  const { electronAPI, db, store } = options;
  
  /**
   * Toggle row selection
   * @param {HTMLElement} row - The row element to toggle
   */
  function toggleSelectedRow(row) {
    $("#selected_row").removeAttr("id");
    $(row).attr("id", "selected_row");
    $("#play_button").removeAttr("disabled");
  }
  
  /**
   * Switch to a specific hotkey tab
   * @param {number} tab - Tab number to switch to
   */
  function switchToHotkeyTab(tab) {
    $(`#hotkey_tabs li:nth-child(${tab}) a`).tab("show");
  }
  
  /**
   * Rename the currently active hotkey tab
   */
  async function renameHotkeyTab() {
    const currentName = $("#hotkey_tabs .nav-link.active").text();
    const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Hotkey Tab");
    if (newName && newName.trim() !== "") {
      $("#hotkey_tabs .nav-link.active").text(newName);
      saveHotkeysToStore();
      return { success: true, newName: newName };
    } else {
      return { success: false, error: 'Invalid name' };
    }
  }
  
  /**
   * Rename the currently active holding tank tab
   */
  async function renameHoldingTankTab() {
    const currentName = $("#holding_tank_tabs .nav-link.active").text();
    const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Holding Tank Tab");
    if (newName && newName.trim() !== "") {
      $("#holding_tank_tabs .nav-link.active").text(newName);
      saveHoldingTankToStore();
      return { success: true, newName: newName };
    } else {
      return { success: false, error: 'Invalid name' };
    }
  }
  
  /**
   * Save hotkeys to store
   */
  function saveHotkeysToStore() {
    const currentHtml = $("#hotkeys-column").html();
    if (currentHtml.includes("header-button")) {
      if (electronAPI && electronAPI.store) {
        electronAPI.store.set("hotkeys", currentHtml).catch(error => {
          console.warn('❌ Failed to save hotkeys:', error);
        });
      } else if (store) {
        store.set("hotkeys", currentHtml);
      }
    }
  }
  
  /**
   * Save holding tank to store
   */
  function saveHoldingTankToStore() {
    const currentHtml = $("#holding-tank-column").html();
    if (currentHtml.includes("mode-toggle")) {
      if (electronAPI && electronAPI.store) {
        electronAPI.store.set("holding_tank", currentHtml).catch(error => {
          console.warn('❌ Failed to save holding tank:', error);
        });
      } else if (store) {
        store.set("holding_tank", currentHtml);
      }
    }
  }
  
  return {
    toggleSelectedRow,
    switchToHotkeyTab,
    renameHotkeyTab,
    renameHoldingTankTab
  };
}

export {
  initializeEventHandlers
};

// Default export for module loading
export default initializeEventHandlers; 