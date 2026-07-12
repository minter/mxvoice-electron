/**
 * Preferences Module Index
 * 
 * This module serves as the main entry point for all preferences-related functionality
 * in the MxVoice Electron application.
 */

// Import preferences sub-modules
import preferenceManager from './preference-manager.js';
import settingsController from './settings-controller.js';

/**
 * Initialize the Preferences module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Preferences module interface
 */
function initializePreferences(options = {}) {
  const electronAPISource = (typeof window !== 'undefined' && (window.electronAPI || window.secureElectronAPI)) || null;
  const electronAPI = options.electronAPI || electronAPISource;
  const { db, store, moduleRegistry } = options;
  
  // Initialize sub-modules
  const manager = preferenceManager({ electronAPI, db, store });
  const controller = settingsController({ electronAPI, db, store, moduleRegistry });
  
  return {
    // Preference Manager functions
    openPreferencesModal: manager.openPreferencesModal,
    loadPreferences: manager.loadPreferences,
    
    // Settings Controller functions
    savePreferences: controller.savePreferences,
    getPreference: controller.getPreference,
    setPreference: controller.setPreference,
    
    // Utility functions
    getDatabaseDirectory: manager.getDatabaseDirectory,
    getMusicDirectory: manager.getMusicDirectory,
    getHotkeyDirectory: manager.getHotkeyDirectory,
    getFadeOutSeconds: manager.getFadeOutSeconds,
    getDebugLogEnabled: manager.getDebugLogEnabled,
    getPrereleaseUpdates: manager.getPrereleaseUpdates,
    getScreenMode: manager.getScreenMode,
    
    // Module info
    version: '1.0.0',
    description: 'Preferences Module for MxVoice Application'
  };
}

export { initializePreferences };
export default initializePreferences;
