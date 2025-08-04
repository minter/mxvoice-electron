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
  function savePreferences(event) {
    console.log("Saving preferences");
    event.preventDefault();
    $(`#preferencesModal`).modal("hide");
    
    // Use new store API for saving preferences
    if (electronAPI && electronAPI.store) {
      const preferences = {
        database_directory: $("#preferences-database-directory").val(),
        music_directory: $("#preferences-song-directory").val(),
        hotkey_directory: $("#preferences-hotkey-directory").val(),
        fade_out_seconds: $("#preferences-fadeout-seconds").val()
      };
      
      // Save all preferences
      Promise.all([
        electronAPI.store.set("database_directory", preferences.database_directory),
        electronAPI.store.set("music_directory", preferences.music_directory),
        electronAPI.store.set("hotkey_directory", preferences.hotkey_directory),
        electronAPI.store.set("fade_out_seconds", preferences.fade_out_seconds)
      ]).then(results => {
        const successCount = results.filter(result => result.success).length;
        if (successCount === 4) {
          console.log('✅ All preferences saved successfully');
        } else {
          console.warn('⚠️ Some preferences failed to save:', results);
        }
      }).catch(error => {
        console.warn('❌ Failed to save preferences:', error);
        // Fallback to legacy store access
        savePreferencesLegacy(preferences);
      });
    } else {
      // Fallback to legacy store access
      const preferences = {
        database_directory: $("#preferences-database-directory").val(),
        music_directory: $("#preferences-song-directory").val(),
        hotkey_directory: $("#preferences-hotkey-directory").val(),
        fade_out_seconds: $("#preferences-fadeout-seconds").val()
      };
      savePreferencesLegacy(preferences);
    }
  }
  
  /**
   * Save preferences using legacy store access
   * Fallback method when new API is not available
   * @param {Object} preferences - Preferences object to save
   */
  function savePreferencesLegacy(preferences) {
    try {
      store.set("database_directory", preferences.database_directory);
      store.set("music_directory", preferences.music_directory);
      store.set("hotkey_directory", preferences.hotkey_directory);
      store.set("fade_out_seconds", preferences.fade_out_seconds);
      console.log('✅ Preferences saved using legacy method');
    } catch (error) {
      console.warn('❌ Legacy preference saving failed:', error);
    }
  }
  
  /**
   * Get a specific preference value
   * @param {string} key - Preference key
   * @returns {Promise<any>} Preference value
   */
  function getPreference(key) {
    if (electronAPI && electronAPI.store) {
      return electronAPI.store.get(key).then(result => {
        if (result.success) {
          return result.value;
        } else {
          console.warn(`❌ Failed to get preference ${key}:`, result.error);
          return null;
        }
      }).catch(error => {
        console.warn(`❌ Preference get error for ${key}:`, error);
        return null;
      });
    } else {
      // Fallback to legacy store access
      return Promise.resolve(store.get(key));
    }
  }
  
  /**
   * Set a specific preference value
   * @param {string} key - Preference key
   * @param {any} value - Preference value
   * @returns {Promise<boolean>} Success status
   */
  function setPreference(key, value) {
    if (electronAPI && electronAPI.store) {
      return electronAPI.store.set(key, value).then(result => {
        if (result.success) {
          console.log(`✅ Preference ${key} saved successfully`);
          return true;
        } else {
          console.warn(`❌ Failed to save preference ${key}:`, result.error);
          return false;
        }
      }).catch(error => {
        console.warn(`❌ Preference set error for ${key}:`, error);
        return false;
      });
    } else {
      // Fallback to legacy store access
      try {
        store.set(key, value);
        console.log(`✅ Preference ${key} saved using legacy method`);
        return Promise.resolve(true);
      } catch (error) {
        console.warn(`❌ Legacy preference saving failed for ${key}:`, error);
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