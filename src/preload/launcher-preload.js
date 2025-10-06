/**
 * Launcher Window Preload Script
 * 
 * Exposes profile launcher API to renderer process with context isolation.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose launcher API
contextBridge.exposeInMainWorld('launcherAPI', {
  /**
   * Get all available profiles
   * @returns {Promise<Object>} Result with profiles array
   */
  getProfiles: () => ipcRenderer.invoke('launcher:get-profiles'),
  
  /**
   * Create a new profile
   * @param {string} name - Profile name
   * @param {string} description - Profile description
   * @returns {Promise<Object>} Result with success status
   */
  createProfile: (name, description) => ipcRenderer.invoke('launcher:create-profile', name, description),
  
  /**
   * Delete a profile
   * @param {string} name - Profile name
   * @returns {Promise<Object>} Result with success status
   */
  deleteProfile: (name) => ipcRenderer.invoke('launcher:delete-profile', name),
  
  /**
   * Launch main app with selected profile
   * @param {string} profileName - Profile to launch with
   * @returns {Promise<Object>} Result with success status
   */
  launchApp: (profileName) => ipcRenderer.invoke('launcher:launch-app', profileName)
});

