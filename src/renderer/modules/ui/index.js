/**
 * UI Module Index
 * 
 * This module serves as the main entry point for all UI-related functionality
 * in the MxVoice Electron application.
 */

// Import UI sub-modules
// Use the full UI manager now that syntax issues are resolved
import uiManager from './ui-manager.js';
import eventHandlers from './event-handlers.js';
import controls from './controls.js';
import modals from './modals.js';

//

/**
 * Initialize the UI module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @returns {Object} UI module interface
 */
export function initializeUI(options = {}) {
  // Initialize sub-modules
  const manager = uiManager(options);
  const handlers = eventHandlers(options);
  const uiControls = controls(options);
  const _modalOps = modals(options);
  
  return {
    // UI Manager functions
    editSelectedSong: manager.editSelectedSong,
    deleteSelectedSong: manager.deleteSelectedSong,
    closeAllTabs: manager.closeAllTabs,
    
    // Event Handler functions
    toggleSelectedRow: handlers.toggleSelectedRow,
    switchToHotkeyTab: handlers.switchToHotkeyTab,
    renameHotkeyTab: handlers.renameHotkeyTab,
    renameHoldingTankTab: handlers.renameHoldingTankTab,
    
    // Control functions
    increaseFontSize: uiControls.increaseFontSize,
    decreaseFontSize: uiControls.decreaseFontSize,
    toggleWaveform: uiControls.toggleWaveform,
    toggleAdvancedSearch: uiControls.toggleAdvancedSearch,
    
    // Utility functions
    getFontSize: manager.getFontSize,
    setFontSize: manager.setFontSize,
    scaleScrollable: manager.scaleScrollable,
    
    // Module info
    version: '1.0.0',
    description: 'UI Module for MxVoice Application'
  };
}

export function reinitializeUI(options = {}) {
  return initializeUI(options);
}

// Default export is the initializer; the bootstrap loader will call it
export default initializeUI;
