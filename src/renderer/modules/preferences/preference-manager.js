/**
 * Preference Manager
 * 
 * Handles preference UI management and loading of preferences from store.
 * 
 * @module preference-manager
 */

/**
 * Initialize the preference manager
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Preference manager interface
 */
function initializePreferenceManager(options = {}) {
  const { electronAPI, db, store } = options;
  
  /**
   * Open the preferences modal
   * Shows the preferences dialog for user configuration
   */
  function openPreferencesModal() {
    $("#preferencesModal").modal();
  }
  
  /**
   * Load preferences into the UI
   * Loads all stored preferences and populates the preferences modal
   */
  function loadPreferences() {
    // Use new store API for loading preferences
    if (electronAPI && electronAPI.store) {
      Promise.all([
        electronAPI.store.get("database_directory"),
        electronAPI.store.get("music_directory"),
        electronAPI.store.get("hotkey_directory"),
        electronAPI.store.get("fade_out_seconds"),
        electronAPI.store.get("debug_log_enabled")
      ]).then(([dbDir, musicDir, hotkeyDir, fadeSeconds, debugLogPref]) => {
        if (dbDir.success) $("#preferences-database-directory").val(dbDir.value);
        if (musicDir.success) $("#preferences-song-directory").val(musicDir.value);
        if (hotkeyDir.success) $("#preferences-hotkey-directory").val(hotkeyDir.value);
        if (fadeSeconds.success) $("#preferences-fadeout-seconds").val(fadeSeconds.value);
        if (debugLogPref.success) $("#preferences-debug-log-enabled").prop("checked", debugLogPref.value);
      }).catch(error => {
        debugLog.error('Failed to load preferences', { 
          function: "loadPreferences",
          error: error
        });
        // Fallback to legacy store access
        loadPreferencesLegacy();
      });
    } else {
      // Fallback to legacy store access
      loadPreferencesLegacy();
    }
  }
  
  /**
   * Load preferences using legacy store access
   * Fallback method when new API is not available
   */
  function loadPreferencesLegacy() {
    try {
      $("#preferences-database-directory").val(store.get("database_directory"));
      $("#preferences-song-directory").val(store.get("music_directory"));
      $("#preferences-hotkey-directory").val(store.get("hotkey_directory"));
      $("#preferences-fadeout-seconds").val(store.get("fade_out_seconds"));
      $("#preferences-debug-log-enabled").prop("checked", store.get("debug_log_enabled") || false);
    } catch (error) {
      debugLog.error('Legacy preference loading failed', { 
        function: "loadPreferencesLegacy",
        error: error
      });
    }
  }
  
  /**
   * Get database directory preference
   * @returns {Promise<string>} Database directory path
   */
  function getDatabaseDirectory() {
    if (electronAPI && electronAPI.store) {
      return electronAPI.store.get("database_directory").then(result => {
        if (result.success) {
          return result.value;
        } else {
          debugLog.warn('Failed to get database directory', { 
            function: "getDatabaseDirectory",
            error: result.error
          });
          return null;
        }
      }).catch(error => {
        debugLog.error('Database directory get error', { 
          function: "getDatabaseDirectory",
          error: error
        });
        return null;
      });
    } else {
      // Fallback to legacy store access
      return Promise.resolve(store.get("database_directory"));
    }
  }
  
  /**
   * Get music directory preference
   * @returns {Promise<string>} Music directory path
   */
  function getMusicDirectory() {
    if (electronAPI && electronAPI.store) {
      return electronAPI.store.get("music_directory").then(result => {
        if (result.success) {
          return result.value;
        } else {
          debugLog.warn('Failed to get music directory', { 
            function: "getMusicDirectory",
            error: result.error
          });
          return null;
        }
      }).catch(error => {
        debugLog.error('Music directory get error', { 
          function: "getMusicDirectory",
          error: error
        });
        return null;
      });
    } else {
      // Fallback to legacy store access
      return Promise.resolve(store.get("music_directory"));
    }
  }
  
  /**
   * Get hotkey directory preference
   * @returns {Promise<string>} Hotkey directory path
   */
  function getHotkeyDirectory() {
    if (electronAPI && electronAPI.store) {
      return electronAPI.store.get("hotkey_directory").then(result => {
        if (result.success) {
          return result.value;
        } else {
          debugLog.warn('Failed to get hotkey directory', { 
            function: "getHotkeyDirectory",
            error: result.error
          });
          return null;
        }
      }).catch(error => {
        debugLog.error('Hotkey directory get error', { 
          function: "getHotkeyDirectory",
          error: error
        });
        return null;
      });
    } else {
      // Fallback to legacy store access
      return Promise.resolve(store.get("hotkey_directory"));
    }
  }
  
  /**
   * Get fade out seconds preference
   * @returns {Promise<number>} Fade out duration in seconds
   */
  function getFadeOutSeconds() {
    if (electronAPI && electronAPI.store) {
      return electronAPI.store.get("fade_out_seconds").then(result => {
        if (result.success) {
          return result.value;
        } else {
          debugLog.warn('Failed to get fade out seconds', { 
            function: "getFadeOutSeconds",
            error: result.error
          });
          return null;
        }
      }).catch(error => {
        debugLog.error('Fade out seconds get error', { 
          function: "getFadeOutSeconds",
          error: error
        });
        return null;
      });
    } else {
      // Fallback to legacy store access
      return Promise.resolve(store.get("fade_out_seconds"));
    }
  }
  
  /**
   * Get debug log enabled preference
   * @returns {Promise<boolean>} Debug log enabled status
   */
  function getDebugLogEnabled() {
    if (electronAPI && electronAPI.store) {
      return electronAPI.store.get("debug_log_enabled").then(result => {
        if (result.success) {
          return result.value || false;
        } else {
          debugLog.warn('Failed to get debug log enabled', { 
            function: "getDebugLogEnabled",
            error: result.error
          });
          return false;
        }
      }).catch(error => {
        debugLog.error('Debug log enabled get error', { 
          function: "getDebugLogEnabled",
          error: error
        });
        return false;
      });
    } else {
      // Fallback to legacy store access
      return Promise.resolve(store.get("debug_log_enabled") || false);
    }
  }
  
  const PreferenceManager = {
    openPreferencesModal,
    loadPreferences,
    getDatabaseDirectory,
    getMusicDirectory,
    getHotkeyDirectory,
    getFadeOutSeconds,
    getDebugLogEnabled
  };

  const preferenceManagerInstance = PreferenceManager;

  return PreferenceManager;
}

export {
  initializePreferenceManager
};

// Default export for module loading
export default initializePreferenceManager; 