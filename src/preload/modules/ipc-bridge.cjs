/**
 * IPC Bridge Module
 * 
 * Handles IPC communication bridge between renderer and main processes
 * for the MxVoice Electron application.
 */

const { ipcRenderer } = require('electron');
const { initializeMainDebugLog } = require('../../main/modules/debug-log.js');

// Initialize debug logger - don't use store in preload context
// The main process will handle store operations
const debugLog = initializeMainDebugLog();

// IPC Event Handlers - extracted from preload.js
const ipcHandlers = {
  // Hotkey handlers
  fkey_load: function (event, fkeys, title) {
    debugLog.debug('🔄 IPC: fkey_load received with:', { fkeys, title });
    debugLog.debug('🔄 fkeys type:', typeof fkeys);
    debugLog.debug('🔄 fkeys keys:', Object.keys(fkeys));
    debugLog.debug('🔄 fkeys length:', fkeys.length);
    debugLog.debug('🔄 fkeys content:', JSON.stringify(fkeys));
    debugLog.debug('🔄 window.populateHotkeys available:', typeof window.populateHotkeys);
    // This will call functions from renderer modules
    if (window.populateHotkeys) {
      debugLog.info('✅ Calling window.populateHotkeys...');
      window.populateHotkeys(fkeys, title);
      debugLog.info('✅ window.populateHotkeys called successfully');
    } else {
      // Under context isolation, the secure event bridge in renderer handles this
      if (process?.contextIsolated) {
        debugLog.info('ℹ️ Context isolation enabled - deferring fkey_load to secure event bridge');
        return;
      }
      debugLog.error('❌ window.populateHotkeys not available - will retry in 1 second');
      setTimeout(() => {
        if (window.populateHotkeys) {
          debugLog.debug('✅ Retry successful - calling window.populateHotkeys...');
          window.populateHotkeys(fkeys, title);
          debugLog.info('✅ window.populateHotkeys called successfully on retry');
        } else {
          debugLog.error('❌ window.populateHotkeys still not available after retry');
        }
      }, 1000);
    }
  },

  holding_tank_load: function (event, songIds) {
    debugLog.debug('🔄 IPC: holding_tank_load received with:', songIds);
    debugLog.debug('🔄 window.populateHoldingTank available:', typeof window.populateHoldingTank);
    if (window.populateHoldingTank) {
      debugLog.info('✅ Calling window.populateHoldingTank...');
      window.populateHoldingTank(songIds);
      debugLog.info('✅ window.populateHoldingTank called successfully');
    } else {
      if (process?.contextIsolated) {
        debugLog.info('ℹ️ Context isolation enabled - deferring holding_tank_load to secure event bridge');
        return;
      }
      debugLog.error('❌ window.populateHoldingTank not available - will retry in 1 second');
      setTimeout(() => {
        if (window.populateHoldingTank) {
          debugLog.debug('✅ Retry successful - calling window.populateHoldingTank...');
          window.populateHoldingTank(songIds);
          debugLog.info('✅ window.populateHoldingTank called successfully on retry');
        } else {
          debugLog.error('❌ window.populateHoldingTank still not available after retry');
        }
      }, 1000);
    }
  },

  start_hotkey_save: function (event, fkeys) {
    if (window.saveHotkeyFile) {
      window.saveHotkeyFile();
    }
  },

  // UI handlers
  manage_categories: function (event) {
    if (window.openCategoriesModal) {
      window.openCategoriesModal();
    }
  },

  show_preferences: function (event) {
    if (window.openPreferencesModal) {
      window.openPreferencesModal();
    }
  },

  // Dialog handlers
  bulk_add_dialog_load: function (event, dirname) {
    if (process?.contextIsolated) {
      debugLog.info('ℹ️ Context isolation enabled - deferring bulk_add_dialog_load to secure event bridge');
      return;
    }
    debugLog.info(`Renderer received directory ${dirname}`);
    if (window.showBulkAddModal) {
      window.showBulkAddModal(dirname);
    }
  },

  add_dialog_load: function (event, filename) {
    if (process?.contextIsolated) {
      debugLog.info('ℹ️ Context isolation enabled - deferring add_dialog_load to secure event bridge');
      return;
    }
    debugLog.info(`Renderer received filename ${filename}`);
    if (window.handleAddDialogLoad) {
      window.handleAddDialogLoad(filename);
    }
  },

  // Song operation handlers
  delete_selected_song: function (event) {
    debugLog.info("Received delete_selected_song message");
    if (window.deleteSelectedSong) {
      window.deleteSelectedSong();
    }
  },

  edit_selected_song: function (event) {
    if (window.editSelectedSong) {
      window.editSelectedSong();
    }
  },

  // UI operation handlers
  increase_font_size: function (event) {
    if (window.increaseFontSize) {
      window.increaseFontSize();
    }
  },

  decrease_font_size: function (event) {
    if (window.decreaseFontSize) {
      window.decreaseFontSize();
    }
  },

  toggle_wave_form: function (event) {
    if (window.toggleWaveform) {
      window.toggleWaveform();
    }
  },

  toggle_advanced_search: function (event) {
    if (window.toggleAdvancedSearch) {
      window.toggleAdvancedSearch();
    }
  },

  close_all_tabs: function (event) {
    if (window.closeAllTabs) {
      window.closeAllTabs();
    }
  },

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
  }
  ,
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