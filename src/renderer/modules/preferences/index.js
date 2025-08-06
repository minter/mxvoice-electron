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
  const { electronAPI, db, store } = options;
  
  // Initialize sub-modules
  const manager = preferenceManager({ electronAPI, db, store });
  const controller = settingsController({ electronAPI, db, store });
  
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
    
    // Module info
    version: '1.0.0',
    description: 'Preferences Module for MxVoice Application'
  };
}

// Create and export a singleton instance
// Note: This will be re-initialized with proper dependencies when the module is loaded
let preferencesModule = initializePreferences();

// Function to re-initialize with proper dependencies
function reinitializePreferences(options = {}) {
  preferencesModule = initializePreferences(options);
  return preferencesModule;
}

// Export individual functions for direct access
export const openPreferencesModal = preferencesModule.openPreferencesModal;
export const loadPreferences = preferencesModule.loadPreferences;
export const savePreferences = preferencesModule.savePreferences;
export const getPreference = preferencesModule.getPreference;
export const setPreference = preferencesModule.setPreference;
export const getDatabaseDirectory = preferencesModule.getDatabaseDirectory;
export const getMusicDirectory = preferencesModule.getMusicDirectory;
export const getHotkeyDirectory = preferencesModule.getHotkeyDirectory;
export const getFadeOutSeconds = preferencesModule.getFadeOutSeconds;
export const getDebugLogEnabled = preferencesModule.getDebugLogEnabled;
export { reinitializePreferences };

// Add reinitialize function to the default export
preferencesModule.reinitializePreferences = reinitializePreferences;

// Default export for module loading
export default preferencesModule; 