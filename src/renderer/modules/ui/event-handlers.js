/**
 * Event Handlers Module
 * 
 * Handles UI event handling functions including row selection, tab switching,
 * and renaming operations.
 * 
 * @module event-handlers
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
    document.getElementById('selected_row')?.removeAttribute('id');
    if (row && row instanceof Element) row.id = 'selected_row';
    document.getElementById('play_button')?.removeAttribute('disabled');
  }
  
  /**
   * Switch to a specific hotkey tab
   * @param {number} tab - Tab number to switch to
   */
  function switchToHotkeyTab(tab) {
    try {
      import('../ui/bootstrap-adapter.js').then(({ showTab }) => showTab(`#hotkey_tabs li:nth-child(${tab}) a`));
    } catch {}
  }
  
  /**
   * Rename the currently active hotkey tab
   */
  async function renameHotkeyTab() {
    const currentName = document.querySelector('#hotkey_tabs .nav-link.active')?.textContent || '';
    const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Hotkey Tab");
    if (newName && newName.trim() !== "") {
      const link = document.querySelector('#hotkey_tabs .nav-link.active');
      if (link) link.textContent = newName;
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
    const currentName = document.querySelector('#holding_tank_tabs .nav-link.active')?.textContent || '';
    const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Holding Tank Tab");
    if (newName && newName.trim() !== "") {
      const link = document.querySelector('#holding_tank_tabs .nav-link.active');
      if (link) link.textContent = newName;
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
    const col = document.getElementById('hotkeys-column');
    const currentHtml = col ? col.innerHTML : '';
    if (currentHtml.includes("header-button")) {
      if (electronAPI && electronAPI.store) {
        electronAPI.store.set("hotkeys", currentHtml).catch(error => {
          debugLog?.warn('Failed to save hotkeys', { 
            module: 'ui-event-handlers',
            function: 'saveHotkeysToStore',
            error: error
          });
        });
      }
    }
  }
  
  /**
   * Save holding tank to store
   */
  function saveHoldingTankToStore() {
    const col = document.getElementById('holding-tank-column');
    const currentHtml = col ? col.innerHTML : '';
    if (currentHtml.includes("mode-toggle")) {
      if (electronAPI && electronAPI.store) {
        electronAPI.store.set("holding_tank", currentHtml).catch(error => {
          debugLog?.warn('Failed to save holding tank', { 
            module: 'ui-event-handlers',
            function: 'saveHoldingTankToStore',
            error: error
          });
        });
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