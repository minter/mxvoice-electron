/**
 * Preferences Module - Main Entry Point
 * 
 * This module provides all preferences and settings functionality for the MxVoice application.
 * It includes preference management, settings UI, and configuration persistence.
 * 
 * @module preferences
 */

// Import all preferences sub-modules
const preferenceManager = require('./preference-manager');
const settingsController = require('./settings-controller');

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
  const manager = preferenceManager.initialize({ electronAPI, db, store });
  const controller = settingsController.initialize({ electronAPI, db, store });
  
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
    
    // Module info
    version: '1.0.0',
    description: 'Preferences Module for MxVoice Application'
  };
}

module.exports = {
  initialize: initializePreferences
}; 