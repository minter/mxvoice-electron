/**
 * Settings Controller
 * 
 * Handles saving and managing application preferences and settings.
 * 
 * @module settings-controller
 */

// Import debug logger from global scope (renderer initializes it early)
let debugLog = null;
try {
  if (typeof window !== 'undefined' && window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_) {}

/**
 * Initialize the settings controller
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Settings controller interface
 */
function initializeSettingsController(options = {}) {
  // Prefer exposed API; fallback to secure API if only that exists
  const electronAPISource = (typeof window !== 'undefined' && (window.electronAPI || window.secureElectronAPI)) || null;
  const electronAPI = options.electronAPI || electronAPISource;
  const { db, store } = options;
  
  /**
   * Save preferences from the preferences modal
   * @param {Event} event - The form submission event
   */
  async function savePreferences(event) {
    debugLog?.info("Saving preferences", { function: "savePreferences" });
    event.preventDefault();
    try {
      const { hideModal } = await import('../ui/bootstrap-adapter.js');
      hideModal('#preferencesModal');
    } catch {}
    
    // Use new store API for saving preferences
    if (electronAPI && electronAPI.store) {
      const preferences = {
        database_directory: (document.getElementById('preferences-database-directory')?.value) || '',
        music_directory: (document.getElementById('preferences-song-directory')?.value) || '',
        hotkey_directory: (document.getElementById('preferences-hotkey-directory')?.value) || '',
        fade_out_seconds: (document.getElementById('preferences-fadeout-seconds')?.value) || '',
        debug_log_enabled: !!document.getElementById('preferences-debug-log-enabled')?.checked
      };
      
      // Save all preferences
      try {
        const results = await Promise.all([
          electronAPI.store.set("database_directory", preferences.database_directory),
          electronAPI.store.set("music_directory", preferences.music_directory),
          electronAPI.store.set("hotkey_directory", preferences.hotkey_directory),
          electronAPI.store.set("fade_out_seconds", preferences.fade_out_seconds),
          electronAPI.store.set("debug_log_enabled", preferences.debug_log_enabled),
          electronAPI.store.set("prerelease_updates", preferences.prerelease_updates)
        ]);
        
        const successCount = results.filter(result => result.success).length;
        if (successCount === 6) {
          debugLog?.info('All preferences saved successfully', { 
            function: "savePreferences",
            data: { successCount, totalPreferences: 5 }
          });
        } else {
          debugLog?.warn('Some preferences failed to save', { 
            function: "savePreferences",
            data: { successCount, totalPreferences: 5, results }
          });
        }
      } catch (error) {
        debugLog?.error('Failed to save preferences', { 
          function: "savePreferences",
          error: error
        });
        // Fallback to legacy store access
        await savePreferencesLegacy(preferences);
      }
    } else {
      // Fallback to legacy store access
      const preferences = {
        database_directory: (document.getElementById('preferences-database-directory')?.value) || '',
        music_directory: (document.getElementById('preferences-song-directory')?.value) || '',
        hotkey_directory: (document.getElementById('preferences-hotkey-directory')?.value) || '',
        fade_out_seconds: (document.getElementById('preferences-fadeout-seconds')?.value) || '',
        debug_log_enabled: !!document.getElementById('preferences-debug-log-enabled')?.checked,
        prerelease_updates: !!document.getElementById('preferences-prerelease-updates')?.checked
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
        store.set("prerelease_updates", preferences.prerelease_updates);
        debugLog?.info('Preferences saved using legacy method', { 
          function: "savePreferencesLegacy",
          data: { preferences }
        });
      } else {
        // Legacy store not available, use electronAPI.store
        try {
          const ops = [
            ['database_directory', preferences.database_directory],
            ['music_directory', preferences.music_directory],
            ['hotkey_directory', preferences.hotkey_directory],
            ['fade_out_seconds', preferences.fade_out_seconds],
            ['debug_log_enabled', preferences.debug_log_enabled],
            ['prerelease_updates', preferences.prerelease_updates]
          ];
          const results = [];
          for (const [key, val] of ops) {
            try {
              const res = await electronAPI.store.set(key, val);
              results.push({ key, ...res });
            } catch (e) {
              results.push({ key, success: false, error: e?.message || 'unknown' });
            }
          }
          
          const successCount = results.filter(result => result.success).length;
          if (successCount === 6) {
            debugLog?.info('All preferences saved successfully using electronAPI.store', { 
              function: "savePreferencesLegacy",
              data: { successCount, totalPreferences: 6 }
            });
          } else {
            debugLog?.warn('Some preferences failed to save', { 
              function: "savePreferencesLegacy",
            data: { successCount, totalPreferences: 6, results }
            });
          }
        } catch (error) {
          debugLog?.error('Failed to save preferences using electronAPI.store', { 
            function: "savePreferencesLegacy",
            error: error
          });
        }
      }
    } catch (error) {
      debugLog?.error('Legacy preference saving failed', { 
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
          debugLog?.warn(`Failed to get preference ${key}`, { 
            function: "getPreference",
            data: { key, error: result.error }
          });
          return null;
        }
      } catch (error) {
        debugLog?.error(`Preference get error for ${key}`, { 
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
          debugLog?.info(`Preference ${key} saved successfully`, { 
            function: "setPreference",
            data: { key, value }
          });
          return true;
        } else {
          debugLog?.warn(`Failed to save preference ${key}`, { 
            function: "setPreference",
            data: { key, value, error: result.error }
          });
          return false;
        }
      } catch (error) {
        debugLog?.error(`Preference set error for ${key}`, { 
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
        debugLog?.info(`Preference ${key} saved using legacy method`, { 
          function: "setPreference",
          data: { key, value }
        });
        return Promise.resolve(true);
      } catch (error) {
        debugLog?.error(`Legacy preference saving failed for ${key}`, { 
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