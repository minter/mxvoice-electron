/**
 * Hotkey Operations
 * 
 * Handles operations for hotkeys including:
 * - File import/export operations
 * - Playback functions
 * - Store operations
 * 
 * @module hotkey-operations
 */

/**
 * Save hotkeys to store
 * Only saves if we have the new HTML format with header button
 * 
 * @param {Object} options - Options object containing dependencies
 */
function saveHotkeysToStore(options = {}) {
  const { electronAPI, store } = options;
  
  const currentHtml = $("#hotkeys-column").html();
  if (currentHtml.includes("header-button")) {
    if (electronAPI && electronAPI.store) {
      electronAPI.store.set("hotkeys", currentHtml).then(result => {
        if (result.success) {
          window.debugLog?.info('✅ Hotkeys saved to store successfully', { module: 'hotkey-operations', function: 'saveHotkeysToStore' });
        } else {
          window.debugLog?.warn('❌ Failed to save hotkeys to store:', result.error, { module: 'hotkey-operations', function: 'saveHotkeysToStore' });
        }
      }).catch(error => {
        window.debugLog?.warn('❌ Store save error:', error, { module: 'hotkey-operations', function: 'saveHotkeysToStore' });
      });
    } else if (store) {
      store.set("hotkeys", currentHtml);
    }
  }
}

/**
 * Load hotkeys from store
 * Loads saved hotkey state and populates UI
 * 
 * @param {Object} options - Options object containing dependencies
 */
function loadHotkeysFromStore(options = {}) {
  const { electronAPI, store } = options;
  
  if (electronAPI && electronAPI.store) {
    electronAPI.store.has("hotkeys").then(hasHotkeys => {
      if (hasHotkeys) {
        electronAPI.store.get("hotkeys").then(storedHotkeysHtml => {
          // Check if the stored HTML contains the old plain text header
          if (
            storedHotkeysHtml && typeof storedHotkeysHtml === 'string' &&
            storedHotkeysHtml.includes("Hotkeys") &&
            !storedHotkeysHtml.includes("header-button")
          ) {
            // This is the old HTML format, clear it so the new HTML loads
            electronAPI.store.delete("hotkeys").then(() => {
              window.debugLog?.info("Cleared old hotkeys HTML format", { module: 'hotkey-operations', function: 'loadHotkeysFromStore' });
            });
          } else if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
            $("#hotkeys-column").html(storedHotkeysHtml);
            $("#selected_row").removeAttr("id");
          }
        });
      }
    });
  } else if (store) {
    // Fallback to legacy store access
    if (store.has("hotkeys")) {
      const storedHotkeysHtml = store.get("hotkeys");
      if (
        storedHotkeysHtml && typeof storedHotkeysHtml === 'string' &&
        storedHotkeysHtml.includes("Hotkeys") &&
        !storedHotkeysHtml.includes("header-button")
      ) {
        store.delete("hotkeys");
        window.debugLog?.info("Cleared old hotkeys HTML format", { module: 'hotkey-operations', function: 'loadHotkeysFromStore' });
      } else if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
        $("#hotkeys-column").html(storedHotkeysHtml);
        $("#selected_row").removeAttr("id");
      }
    }
  }
}

/**
 * Open hotkey file
 * Imports hotkey configuration from file
 * 
 * @param {Object} options - Options object containing dependencies
 */
function openHotkeyFile(options = {}) {
  const { electronAPI } = options;
  
  if (electronAPI) {
    electronAPI.openHotkeyFile().catch(error => {
      window.debugLog?.warn('Modern API failed, falling back to legacy:', error, { module: 'hotkey-operations', function: 'openHotkeyFile' });
      if (typeof ipcRenderer !== 'undefined') {
        ipcRenderer.send("open-hotkey-file");
      }
    });
  } else if (typeof ipcRenderer !== 'undefined') {
    ipcRenderer.send("open-hotkey-file");
  }
}

/**
 * Save hotkey file
 * Exports hotkey configuration to file
 * 
 * @param {Object} options - Options object containing dependencies
 */
function saveHotkeyFile(options = {}) {
  const { electronAPI } = options;
  
  window.debugLog?.info("Renderer starting saveHotkeyFile", { module: 'hotkey-operations', function: 'saveHotkeyFile' });
  const hotkeyArray = [];
  for (let key = 1; key <= 12; key++) {
    hotkeyArray.push($(`.hotkeys.active li#f${key}_hotkey`).attr("songid"));
  }
  if (!/^\d$/.test($("#hotkey_tabs li a.active").text())) {
    hotkeyArray.push($("#hotkey_tabs li a.active").text());
  }
  
  if (electronAPI) {
    electronAPI.saveHotkeyFile(hotkeyArray).catch(error => {
      window.debugLog?.warn('Modern API failed, falling back to legacy:', error, { module: 'hotkey-operations', function: 'saveHotkeyFile' });
      if (typeof ipcRenderer !== 'undefined') {
        ipcRenderer.send("save-hotkey-file", hotkeyArray);
      }
    });
  } else if (typeof ipcRenderer !== 'undefined') {
    ipcRenderer.send("save-hotkey-file", hotkeyArray);
  }
}

/**
 * Play song from hotkey
 * Plays the song assigned to the specified hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {Object} options - Options object containing dependencies
 */
function playSongFromHotkey(hotkey, options = {}) {
  window.debugLog?.info("Getting song ID from hotkey " + hotkey, { module: 'hotkey-operations', function: 'playSongFromHotkey' });
  const song_id = $(`.hotkeys.active #${hotkey}_hotkey`).attr("songid");
  window.debugLog?.info(`Found song ID ${song_id}`, { module: 'hotkey-operations', function: 'playSongFromHotkey' });
  if (song_id) {
    window.debugLog?.info(`Preparing to play song ${song_id}`, { module: 'hotkey-operations', function: 'playSongFromHotkey' });
    // Unhighlight any selected tracks in holding tank or playlist
    $(".now_playing").first().removeClass("now_playing");
    $("#selected_row").removeAttr("id");
    // Hotkey playback should not affect holding tank mode
    // Just play the song without changing autoplay state
    if (typeof playSongFromId === 'function') {
      playSongFromId(song_id);
    }
    if (typeof animateCSS === 'function') {
      const hotkeyElement = $(`.hotkeys.active #${hotkey}_hotkey`)[0];
      if (hotkeyElement) {
        animateCSS(hotkeyElement, "flipInX");
      }
    }
  }
}

/**
 * Send selected song to hotkeys
 * Assigns the currently selected song to the first empty hotkey slot
 * 
 * @param {Object} options - Options object containing dependencies
 * @returns {boolean} - False to prevent default behavior
 */
function sendToHotkeys(options = {}) {
  const { setLabelFromSongId } = options;
  
  if ($("#selected_row").is("span")) {
    return;
  }
  const target = $(".hotkeys.active li").not("[songid]").first();
  const song_id = $("#selected_row").attr("songid");
  if ($(`.hotkeys.active li[songid=${song_id}]`).length) {
    return;
  }
  if (target && song_id) {
    target.attr("songid", song_id);
    if (setLabelFromSongId) {
      setLabelFromSongId(song_id, target);
    }
  }
  return false;
}

/**
 * Remove song from hotkey
 * Removes the selected song from its hotkey assignment
 * 
 * @param {Object} options - Options object containing dependencies
 */
function removeFromHotkey(options = {}) {
  const { db, saveHotkeysToStore } = options;
  
  const songId = $("#selected_row").attr("songid");
  window.debugLog?.info("removeFromHotkey called, songId:", songId, { module: 'hotkey-operations', function: 'removeFromHotkey' });
  window.debugLog?.info("selected_row element:", $("#selected_row"), { module: 'hotkey-operations', function: 'removeFromHotkey' });
  
  if (songId) {
    window.debugLog?.info(`Preparing to remove song ${songId} from hotkey`, { module: 'hotkey-operations', function: 'removeFromHotkey' });
    if (db) {
      const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
      const songRow = songStmt.get(songId);
      
      if (songRow) {
        customConfirm(`Are you sure you want to remove ${songRow.title} from this hotkey?`, () => {
          window.debugLog?.info("Proceeding with removal from hotkey", { module: 'hotkey-operations', function: 'removeFromHotkey' });
          // Clear the hotkey slot
          $("#selected_row").removeAttr("songid");
          $("#selected_row span").html("");
          // Clear the selection
          $("#selected_row").removeAttr("id");
          // Save the updated hotkeys to store
          if (saveHotkeysToStore) {
            saveHotkeysToStore();
          }
          window.debugLog?.info("Hotkey cleared successfully", { module: 'hotkey-operations', function: 'removeFromHotkey' });
        });
      } else {
        window.debugLog?.error("Song not found in database for ID:", songId, { module: 'hotkey-operations', function: 'removeFromHotkey' });
        // Still clear the hotkey even if song not found
        $("#selected_row").removeAttr("songid");
        $("#selected_row span").html("");
        $("#selected_row").removeAttr("id");
        if (saveHotkeysToStore) {
          saveHotkeysToStore();
        }
      }
    } else {
      // Clear the hotkey even if database is not available
      $("#selected_row").removeAttr("songid");
      $("#selected_row span").html("");
      $("#selected_row").removeAttr("id");
      if (saveHotkeysToStore) {
        saveHotkeysToStore();
      }
    }
  } else {
    window.debugLog?.info("No songId found on selected row", { module: 'hotkey-operations', function: 'removeFromHotkey' });
  }
}

/**
 * Export hotkey configuration
 * Creates a configuration object for export
 * 
 * @returns {Object} - Hotkey configuration object
 */
function exportHotkeyConfig() {
  const config = {
    hotkeys: {},
    title: $("#hotkey_tabs li a.active").text(),
    timestamp: new Date().toISOString()
  };
  
  for (let key = 1; key <= 12; key++) {
    const songId = $(`.hotkeys.active #f${key}_hotkey`).attr("songid");
    if (songId) {
      config.hotkeys[`f${key}`] = songId;
    }
  }
  
  return config;
}

/**
 * Import hotkey configuration
 * Applies imported configuration to hotkeys
 * 
 * @param {Object} config - Hotkey configuration object
 * @param {Object} options - Options object containing dependencies
 */
function importHotkeyConfig(config, options = {}) {
  const { setLabelFromSongId, saveHotkeysToStore } = options;
  
  if (!config || !config.hotkeys) {
    window.debugLog?.warn('❌ Invalid hotkey configuration', { module: 'hotkey-operations', function: 'importHotkeyConfig' });
    return;
  }
  
  // Clear existing hotkeys
  for (let key = 1; key <= 12; key++) {
    $(`.hotkeys.active #f${key}_hotkey`).removeAttr("songid");
    $(`.hotkeys.active #f${key}_hotkey span`).html("");
  }
  
  // Apply imported configuration
  for (const key in config.hotkeys) {
    if (config.hotkeys[key]) {
      $(`.hotkeys.active #${key}_hotkey`).attr("songid", config.hotkeys[key]);
      if (setLabelFromSongId) {
        setLabelFromSongId(config.hotkeys[key], $(`.hotkeys.active #${key}_hotkey`));
      }
    }
  }
  
  // Set title if provided
  if (config.title) {
    $("#hotkey_tabs li a.active").text(config.title);
  }
  
  // Save to store
  if (saveHotkeysToStore) {
    saveHotkeysToStore();
  }
}

/**
 * Backup hotkey configuration
 * Creates a backup of current hotkey state
 * 
 * @returns {Object} - Backup configuration object
 */
function backupHotkeyConfig() {
  return {
    hotkeys: exportHotkeyConfig(),
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
}

/**
 * Restore hotkey configuration
 * Restores hotkey state from backup
 * 
 * @param {Object} backup - Backup configuration object
 * @param {Object} options - Options object containing dependencies
 */
function restoreHotkeyConfig(backup, options = {}) {
  if (!backup || !backup.hotkeys) {
    window.debugLog?.warn('❌ Invalid backup configuration', { module: 'hotkey-operations', function: 'restoreHotkeyConfig' });
    return;
  }
  
  importHotkeyConfig(backup.hotkeys, options);
}

/**
 * Clear hotkey configuration
 * Removes all hotkey assignments
 * 
 * @param {Object} options - Options object containing dependencies
 */
function clearHotkeyConfig(options = {}) {
  const { saveHotkeysToStore } = options;
  
  window.debugLog?.info('🧹 Clearing hotkey configuration...', { module: 'hotkey-operations', function: 'clearHotkeyConfig' });
  
  // Clear all hotkey assignments
  for (let key = 1; key <= 12; key++) {
    $(`.hotkeys.active #f${key}_hotkey`).removeAttr("songid");
    $(`.hotkeys.active #f${key}_hotkey span`).html("");
  }
  
  // Save to store if saveHotkeysToStore is provided
  if (saveHotkeysToStore) {
    saveHotkeysToStore();
  }
  
  window.debugLog?.info('✅ Hotkey configuration cleared', { module: 'hotkey-operations', function: 'clearHotkeyConfig' });
}

/**
 * Get hotkey configuration
 * Returns the current hotkey configuration
 * 
 * @returns {Object} - Current hotkey configuration
 */
function getHotkeyConfig() {
  return exportHotkeyConfig();
}

/**
 * Set hotkey configuration
 * Sets the hotkey configuration from a config object
 * 
 * @param {Object} config - Hotkey configuration object
 * @param {Object} options - Options object containing dependencies
 */
function setHotkeyConfig(config, options = {}) {
  importHotkeyConfig(config, options);
}

export {
  saveHotkeysToStore,
  loadHotkeysFromStore,
  openHotkeyFile,
  saveHotkeyFile,
  playSongFromHotkey,
  sendToHotkeys,
  removeFromHotkey,
  exportHotkeyConfig,
  importHotkeyConfig,
  clearHotkeyConfig,
  getHotkeyConfig,
  setHotkeyConfig
};

// Default export for module loading
export default {
  saveHotkeysToStore,
  loadHotkeysFromStore,
  openHotkeyFile,
  saveHotkeyFile,
  playSongFromHotkey,
  sendToHotkeys,
  removeFromHotkey,
  exportHotkeyConfig,
  importHotkeyConfig,
  clearHotkeyConfig,
  getHotkeyConfig,
  setHotkeyConfig
}; 