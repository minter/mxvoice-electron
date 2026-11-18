/**
 * Event Handlers Module
 * 
 * Handles UI event handling functions including row selection, tab switching,
 * and renaming operations.
 * 
 * @module event-handlers
 */

import { setTabLabel } from './tab-label.js';
import { watchLayoutSwap } from '../shows/layout-applier.js';

/**
 * Initialize the Event Handlers module
 * @param {Object} options - Configuration options
 * @returns {Object} Event Handlers interface
 */
function initializeEventHandlers(options = {}) {
  const { moduleRegistry = {} } = options;
  
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
    const layoutSwapped = watchLayoutSwap();
    const currentName = document.querySelector('#hotkey_tabs .nav-link.active')?.textContent || '';
    const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Tab");
    // A show switch landed while the prompt was open: the tab it named is gone
    if (newName && layoutSwapped()) return { success: false, error: 'Show changed' };
    if (newName && newName.trim() !== "") {
      const link = document.querySelector('#hotkey_tabs .nav-link.active');
      setTabLabel(link, newName);
      const tabNumber = Number(link?.getAttribute('href')?.match(/^#hotkeys_list_(\d)$/)?.[1]);
      moduleRegistry.hotkeys?.renameHotkeyStateTab?.(tabNumber, newName);
      moduleRegistry.hotkeys?.requestProfileStateSave?.();
      return { success: true, newName: newName };
    } else {
      return { success: false, error: 'Invalid name' };
    }
  }
  
  /**
   * Rename the currently active holding tank tab
   */
  async function renameHoldingTankTab() {
    const layoutSwapped = watchLayoutSwap();
    const currentName = document.querySelector('#holding_tank_tabs .nav-link.active')?.textContent || '';
    const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Tab");
    // A show switch landed while the prompt was open: the tab it named is gone
    if (newName && layoutSwapped()) return { success: false, error: 'Show changed' };
    if (newName && newName.trim() !== "") {
      const link = document.querySelector('#holding_tank_tabs .nav-link.active');
      setTabLabel(link, newName);
      const tabNumber = Number(link?.getAttribute('href')?.match(/^#holding_tank_(\d)$/)?.[1]);
      moduleRegistry.holdingTank?.renameHoldingTankStateTab?.(tabNumber, newName);
      moduleRegistry.holdingTank?.requestProfileStateSave?.();
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
