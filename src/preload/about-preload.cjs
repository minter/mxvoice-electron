/**
 * About Window Preload Script
 * 
 * Exposes minimal API for the About dialog with context isolation.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose about dialog API
contextBridge.exposeInMainWorld('aboutAPI', {
  /**
   * Close the about window
   */
  closeWindow: () => {
    ipcRenderer.send('about:close-window');
  },

  /**
   * Open external URL
   * @param {string} url - URL to open
   */
  openExternal: (url) => {
    ipcRenderer.send('about:open-external', url);
  }
});

