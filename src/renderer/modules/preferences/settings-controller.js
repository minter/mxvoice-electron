/**
 * Settings Controller
 * 
 * Handles saving and managing application preferences and settings.
 * 
 * @module settings-controller
 */

/**
 * Initialize the settings controller
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Settings controller interface
 */
function initializeSettingsController(options = {}) {
  const { electronAPI, db, store } = options;
  
  /**
   * Save preferences from the preferences modal
   * @param {Event} event - The form submission event
   */
  async function savePreferences(event) {
    await debugLog.info("Saving preferences", { function: "savePreferences" });
    event.preventDefault();
    $(`#preferencesModal`).modal("hide");
    
    // Use new store API for saving preferences
    if (electronAPI && electronAPI.store) {
      const preferences = {
        database_directory: $("#preferences-database-directory").val(),
        music_directory: $("#preferences-song-directory").val(),
        hotkey_directory: $("#preferences-hotkey-directory").val(),
        fade_out_seconds: $("#preferences-fadeout-seconds").val(),
        debug_log_enabled: $("#preferences-debug-log-enabled").is(":checked")
      };
      
      // Save all preferences
      try {
        const results = await Promise.all([
          electronAPI.store.set("database_directory", preferences.database_directory),
          electronAPI.store.set("music_directory", preferences.music_directory),
          electronAPI.store.set("hotkey_directory", preferences.hotkey_directory),
          electronAPI.store.set("fade_out_seconds", preferences.fade_out_seconds),
          electronAPI.store.set("debug_log_enabled", preferences.debug_log_enabled)
        ]);
        
        const successCount = results.filter(result => result.success).length;
        if (successCount === 5) {
          await debugLog.info('All preferences saved successfully', { 
            function: "savePreferences",
            data: { successCount, totalPreferences: 5 }
          });
        } else {
          await debugLog.warn('Some preferences failed to save', { 
            function: "savePreferences",
            data: { successCount, totalPreferences: 5, results }
          });
        }
      } catch (error) {
        await debugLog.error('Failed to save preferences', { 
          function: "savePreferences",
          error: error
        });
        // Fallback to legacy store access
        await savePreferencesLegacy(preferences);
      }
    } else {
      // Fallback to legacy store access
      const preferences = {
        database_directory: $("#preferences-database-directory").val(),
        music_directory: $("#preferences-song-directory").val(),
        hotkey_directory: $("#preferences-hotkey-directory").val(),
        fade_out_seconds: $("#preferences-fadeout-seconds").val(),
        debug_log_enabled: $("#preferences-debug-log-enabled").is(":checked")
      };
      savePreferencesLegacy(preferences);
    }
  }
  
  /**
   * Save preferences using legacy store access
   * Fallback method when new API is not available
   * @param {Object} preferences - Preferences object to save
   */
  async function savePreferencesLegacy(preferences) {
    try {
      if (store) {
        store.set("database_directory", preferences.database_directory);
        store.set("music_directory", preferences.music_directory);
        store.set("hotkey_directory", preferences.hotkey_directory);
        store.set("fade_out_seconds", preferences.fade_out_seconds);
        store.set("debug_log_enabled", preferences.debug_log_enabled);
        await debugLog.info('Preferences saved using legacy method', { 
          function: "savePreferencesLegacy",
          data: { preferences }
        });
      } else {
        // Legacy store not available, use electronAPI.store
        try {
          const results = await Promise.all([
            electronAPI.store.set("database_directory", preferences.database_directory),
            electronAPI.store.set("music_directory", preferences.music_directory),
            electronAPI.store.set("hotkey_directory", preferences.hotkey_directory),
            electronAPI.store.set("fade_out_seconds", preferences.fade_out_seconds),
            electronAPI.store.set("debug_log_enabled", preferences.debug_log_enabled)
          ]);
          
          const successCount = results.filter(result => result.success).length;
          if (successCount === 5) {
            await debugLog.info('All preferences saved successfully using electronAPI.store', { 
              function: "savePreferencesLegacy",
              data: { successCount, totalPreferences: 5 }
            });
          } else {
            await debugLog.warn('Some preferences failed to save', { 
              function: "savePreferencesLegacy",
              data: { successCount, totalPreferences: 5, results }
            });
          }
        } catch (error) {
          await debugLog.error('Failed to save preferences using electronAPI.store', { 
            function: "savePreferencesLegacy",
            error: error
          });
        }
      }
    } catch (error) {
      await debugLog.error('Legacy preference saving failed', { 
        function: "savePreferencesLegacy",
        error: error
      });
    }
  }
  
  /**
   * Get a specific preference value
   * @param {string} key - Preference key
   * @returns {Promise<any>} Preference value
   */
  async function getPreference(key) {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await electronAPI.store.get(key);
        if (result.success) {
          return result.value;
        } else {
          await debugLog.warn(`Failed to get preference ${key}`, { 
            function: "getPreference",
            data: { key, error: result.error }
          });
          return null;
        }
      } catch (error) {
        await debugLog.error(`Preference get error for ${key}`, { 
          function: "getPreference",
          data: { key },
          error: error
        });
        return null;
      }
    } else if (store) {
      // Fallback to legacy store access
      return Promise.resolve(store.get(key));
    } else {
      // No store available
      await debugLog.warn(`No store available for preference ${key}`, { 
        function: "getPreference",
        data: { key }
      });
      return Promise.resolve(null);
    }
  }
  
  /**
   * Set a specific preference value
   * @param {string} key - Preference key
   * @param {any} value - Preference value
   * @returns {Promise<boolean>} Success status
   */
  async function setPreference(key, value) {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await electronAPI.store.set(key, value);
        if (result.success) {
          await debugLog.info(`Preference ${key} saved successfully`, { 
            function: "setPreference",
            data: { key, value }
          });
          return true;
        } else {
          await debugLog.warn(`Failed to save preference ${key}`, { 
            function: "setPreference",
            data: { key, value, error: result.error }
          });
          return false;
        }
      } catch (error) {
        await debugLog.error(`Preference set error for ${key}`, { 
          function: "setPreference",
          data: { key, value },
          error: error
        });
        return false;
      }
    } else {
      // Fallback to legacy store access
      try {
        store.set(key, value);
        await debugLog.info(`Preference ${key} saved using legacy method`, { 
          function: "setPreference",
          data: { key, value }
        });
        return Promise.resolve(true);
      } catch (error) {
        await debugLog.error(`Legacy preference saving failed for ${key}`, { 
          function: "setPreference",
          data: { key, value },
          error: error
        });
        return Promise.resolve(false);
      }
    }
  }
  
  return {
    savePreferences,
    getPreference,
    setPreference
  };
}

export {
  initializeSettingsController
};

// Default export for module loading
export default initializeSettingsController; 