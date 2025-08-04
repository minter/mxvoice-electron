/**
 * UI Module Index
 * 
 * This module serves as the main entry point for all UI-related functionality
 * in the MxVoice Electron application.
 */

// Import UI sub-modules
import * as uiManager from './ui-manager.js';
import * as eventHandlers from './event-handlers.js';
import * as controls from './controls.js';
import * as modals from './modals.js';

/**
 * Initialize the UI module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} UI module interface
 */
function initializeUI(options = {}) {
  const { electronAPI, db, store } = options;
  
  // Initialize sub-modules
  const manager = uiManager.initialize({ electronAPI, db, store });
  const handlers = eventHandlers.initialize({ electronAPI, db, store });
  const uiControls = controls.initialize({ electronAPI, db, store });
  const modalOps = modals.initialize({ electronAPI, db, store });
  
  return {
    // UI Manager functions
    scaleScrollable: manager.scaleScrollable,
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
    
    // Modal functions
    pickDirectory: modalOps.pickDirectory,
    installUpdate: modalOps.installUpdate,
    
    // Utility functions
    getFontSize: manager.getFontSize,
    setFontSize: manager.setFontSize,
    
    // Module info
    version: '1.0.0',
    description: 'UI Module for MxVoice Application'
  };
}

export {
  UiModule,
  ui: uiModule
};

// Default export for module loading
export default {
  UiModule,
  ui: uiModule
}; 