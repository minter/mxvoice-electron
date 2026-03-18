/**
 * IPC Bridge Module
 *
 * Handles IPC communication bridge between renderer and main processes
 * for the MxVoice Electron application.
 *
 * With context isolation enabled, only handlers that use window.dispatchEvent()
 * are functional. Handlers that relied on window.xxx function calls (e.g.
 * window.populateHotkeys) are handled by secure-api-exposer.cjs event
 * listeners via contextBridge instead.
 */

const { ipcRenderer } = require('electron');
const log = require('electron-log');

const debugLog = {
  info: (message, context) => log.info(message, context),
  error: (message, context) => log.error(message, context),
  warn: (message, context) => log.warn(message, context),
  debug: (message, context) => log.debug(message, context)
};

// IPC Event Handlers — only handlers that dispatch CustomEvents to the renderer
const ipcHandlers = {
  // Release notes handler
  display_release_notes: function (event, releaseName, releaseNotes) {
    debugLog.info(`Attempting to display #newReleaseModal for ${releaseName}`);
    try {
      window.dispatchEvent(new CustomEvent('mxvoice:update-release-notes', { detail: { name: releaseName, notes: releaseNotes } }));
    } catch (error) {
      debugLog.error('Failed to dispatch release notes event', {
        module: 'ipc-bridge',
        function: 'display_release_notes',
        error: error?.message || 'Unknown error'
      });
    }
    try {
      window.dispatchEvent(new CustomEvent('mxvoice:show-modal', { detail: { selector: '#newReleaseModal' } }));
    } catch (error) {
      debugLog.error('Failed to dispatch show modal event', {
        module: 'ipc-bridge',
        function: 'display_release_notes',
        error: error?.message || 'Unknown error'
      });
    }
  },

  // Auto-update progress events
  update_download_progress: function (_event, progress) {
    try {
      window.dispatchEvent(new CustomEvent('mxvoice:update-download-progress', { detail: progress || {} }));
    } catch (error) {
      debugLog.error('Failed to dispatch update download progress event', {
        module: 'ipc-bridge',
        function: 'update_download_progress',
        error: error?.message || 'Unknown error'
      });
    }
  },

  update_ready: function (_event, version) {
    try {
      window.dispatchEvent(new CustomEvent('mxvoice:update-ready', { detail: { version }}));
    } catch (error) {
      debugLog.error('Failed to dispatch update ready event', {
        module: 'ipc-bridge',
        function: 'update_ready',
        error: error?.message || 'Unknown error'
      });
    }
  }
};

// Register all IPC handlers
function registerIpcHandlers() {
  Object.entries(ipcHandlers).forEach(([event, handler]) => {
    ipcRenderer.on(event, handler);
  });
  debugLog.info('IPC handlers registered successfully');
}

// Remove all IPC handlers
function removeIpcHandlers() {
  Object.keys(ipcHandlers).forEach(event => {
    ipcRenderer.removeAllListeners(event);
  });
  debugLog.info('IPC handlers removed successfully');
}

// Get all registered handlers (for testing)
function getIpcHandlers() {
  return ipcHandlers;
}

// Test function to verify IPC bridge is working
function testIpcBridge() {
  debugLog.debug('Testing IPC Bridge...');
  debugLog.debug('Registered handlers:', Object.keys(ipcHandlers));
  return true;
}

module.exports = {
  registerIpcHandlers,
  removeIpcHandlers,
  getIpcHandlers,
  testIpcBridge,
  ipcHandlers
};
