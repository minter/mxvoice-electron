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
 * @returns {Object} Event Handlers interface
 */
function initializeEventHandlers(_options = {}) {
  
  /**
   * Toggle row selection
   * @param {HTMLElement} row - The row element to toggle
   */
  function toggleSelectedRow(row) {
    document
      .querySelectorAll('[id*="_hotkey"]')
      .forEach((item) => item.classList.remove('active-hotkey', 'selected-row'));
    window.currentSelectedHotkey = null;
    document.getElementById('selected_row')?.removeAttribute('id');
    if (row && row instanceof Element) row.id = 'selected_row';
    document.getElementById('play_button')?.removeAttribute('disabled');
  }
  
  /**
   * Switch to a specific hotkey tab
   * @param {number} tab - Tab number to switch to
   */
  function switchToHotkeyTab(tab) {
    import('../ui/bootstrap-helpers.js')
      .then(({ safeShowTab }) => safeShowTab(`#hotkey_tabs li:nth-child(${tab}) a`, { module: 'event-handlers', function: 'switchToHotkeyTab' }));
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
      const tabNumber = Number(link?.getAttribute('href')?.match(/^#hotkeys_list_(\d)$/)?.[1]);
      window.moduleRegistry?.hotkeys?.renameHotkeyStateTab?.(tabNumber, newName);
      window.moduleRegistry?.hotkeys?.requestProfileStateSave?.();
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
      const tabNumber = Number(link?.getAttribute('href')?.match(/^#holding_tank_(\d)$/)?.[1]);
      window.moduleRegistry?.holdingTank?.renameHoldingTankStateTab?.(tabNumber, newName);
      window.moduleRegistry?.holdingTank?.requestProfileStateSave?.();
      return { success: true, newName: newName };
    } else {
      return { success: false, error: 'Invalid name' };
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
