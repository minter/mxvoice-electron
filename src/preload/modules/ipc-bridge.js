// IPC Bridge Module
// Handles all IPC communication between renderer and main process

const { ipcRenderer } = require('electron');

// IPC Event Handlers - extracted from preload.js
const ipcHandlers = {
  // Hotkey handlers
  fkey_load: function (event, fkeys, title) {
    // This will call functions from renderer modules
    if (window.populateHotkeys) {
      window.populateHotkeys(fkeys, title);
    }
  },

  holding_tank_load: function (event, songIds) {
    if (window.populateHoldingTank) {
      window.populateHoldingTank(songIds);
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

module.exports = {
  registerIpcHandlers,
  removeIpcHandlers,
  getIpcHandlers,
  testIpcBridge,
  ipcHandlers
}; 