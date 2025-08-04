/**
 * IPC Bridge Module
 * 
 * Handles IPC communication bridge between renderer and main processes
 * for the MxVoice Electron application.
 */

import { ipcRenderer } from 'electron';

// IPC Event Handlers - extracted from preload.js
const ipcHandlers = {
  // Hotkey handlers
  fkey_load: function (event, fkeys, title) {
    console.log('🔄 IPC: fkey_load received with:', { fkeys, title });
    console.log('🔄 fkeys type:', typeof fkeys);
    console.log('🔄 fkeys keys:', Object.keys(fkeys));
    console.log('🔄 fkeys length:', fkeys.length);
    console.log('🔄 fkeys content:', JSON.stringify(fkeys));
    console.log('🔄 window.populateHotkeys available:', typeof window.populateHotkeys);
    // This will call functions from renderer modules
    if (window.populateHotkeys) {
      console.log('✅ Calling window.populateHotkeys...');
      window.populateHotkeys(fkeys, title);
      console.log('✅ window.populateHotkeys called successfully');
    } else {
      console.error('❌ window.populateHotkeys not available - will retry in 1 second');
      // Retry after a short delay in case modules are still loading
      setTimeout(() => {
        if (window.populateHotkeys) {
          console.log('✅ Retry successful - calling window.populateHotkeys...');
          window.populateHotkeys(fkeys, title);
          console.log('✅ window.populateHotkeys called successfully on retry');
        } else {
          console.error('❌ window.populateHotkeys still not available after retry');
        }
      }, 1000);
    }
  },

  holding_tank_load: function (event, songIds) {
    console.log('🔄 IPC: holding_tank_load received with:', songIds);
    console.log('🔄 window.populateHoldingTank available:', typeof window.populateHoldingTank);
    if (window.populateHoldingTank) {
      console.log('✅ Calling window.populateHoldingTank...');
      window.populateHoldingTank(songIds);
      console.log('✅ window.populateHoldingTank called successfully');
    } else {
      console.error('❌ window.populateHoldingTank not available - will retry in 1 second');
      // Retry after a short delay in case modules are still loading
      setTimeout(() => {
        if (window.populateHoldingTank) {
          console.log('✅ Retry successful - calling window.populateHoldingTank...');
          window.populateHoldingTank(songIds);
          console.log('✅ window.populateHoldingTank called successfully on retry');
        } else {
          console.error('❌ window.populateHoldingTank still not available after retry');
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
    console.log(`Renderer received directory ${dirname}`);
    if (window.showBulkAddModal) {
      window.showBulkAddModal(dirname);
    }
  },

  add_dialog_load: function (event, filename) {
    console.log(`Renderer received filename ${filename}`);
    import("music-metadata")
      .then((mm) => mm.parseFile(filename))
      .then((metadata) => {
        // This will be handled by the renderer modules
        if (window.handleAddDialogLoad) {
          window.handleAddDialogLoad(filename, metadata);
        }
      })
      .catch((err) => {
        console.error(err.message);
      });
  },

  // Song operation handlers
  delete_selected_song: function (event) {
    console.log("Received delete_selected_song message");
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
    console.log(`Attempting to display #newReleaseModal for ${releaseName}`);
    $('#newReleaseModal .modal-title').html(`Downloaded New Version: ${releaseName}`);
    $('#newReleaseModal .modal-body').html(releaseNotes);
    $('#newReleaseModal').modal();
  }
};

// Register all IPC handlers
function registerIpcHandlers() {
  Object.entries(ipcHandlers).forEach(([event, handler]) => {
    ipcRenderer.on(event, handler);
  });
  console.log('IPC handlers registered successfully');
}

// Remove all IPC handlers
function removeIpcHandlers() {
  Object.keys(ipcHandlers).forEach(event => {
    ipcRenderer.removeAllListeners(event);
  });
  console.log('IPC handlers removed successfully');
}

// Get all registered handlers (for testing)
function getIpcHandlers() {
  return ipcHandlers;
}

// Test function to verify IPC bridge is working
function testIpcBridge() {
  console.log('Testing IPC Bridge...');
  console.log('Registered handlers:', Object.keys(ipcHandlers));
  return true;
}

export {
  registerIpcHandlers,
  removeIpcHandlers,
  getIpcHandlers,
  testIpcBridge,
  ipcHandlers
};

// Default export for module loading
export default {
  registerIpcHandlers,
  removeIpcHandlers,
  getIpcHandlers,
  testIpcBridge,
  ipcHandlers
}; 