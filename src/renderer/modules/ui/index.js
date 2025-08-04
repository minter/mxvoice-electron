/**
 * UI Module Index
 * 
 * This module serves as the main entry point for all UI-related functionality
 * in the MxVoice Electron application.
 */

// Import UI sub-modules
import uiManager from './ui-manager.js';
import eventHandlers from './event-handlers.js';
import controls from './controls.js';
import modals from './modals.js';

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
  const manager = uiManager({ electronAPI, db, store });
  const handlers = eventHandlers({ electronAPI, db, store });
  const uiControls = controls({ electronAPI, db, store });
  const modalOps = modals({ electronAPI, db, store });
  
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

// Create and export a singleton instance
const uiModule = initializeUI();

// Export individual functions for direct access
export const scaleScrollable = uiModule.scaleScrollable;
export const editSelectedSong = uiModule.editSelectedSong;
export const deleteSelectedSong = uiModule.deleteSelectedSong;
export const closeAllTabs = uiModule.closeAllTabs;
export const toggleSelectedRow = uiModule.toggleSelectedRow;
export const switchToHotkeyTab = uiModule.switchToHotkeyTab;
export const renameHotkeyTab = uiModule.renameHotkeyTab;
export const renameHoldingTankTab = uiModule.renameHoldingTankTab;
export const increaseFontSize = uiModule.increaseFontSize;
export const decreaseFontSize = uiModule.decreaseFontSize;
export const toggleWaveform = uiModule.toggleWaveform;
export const toggleAdvancedSearch = uiModule.toggleAdvancedSearch;
export const pickDirectory = uiModule.pickDirectory;
export const installUpdate = uiModule.installUpdate;
export const getFontSize = uiModule.getFontSize;
export const setFontSize = uiModule.setFontSize;

// Default export for module loading
export default uiModule; 