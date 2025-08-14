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
  // Prefer exposed API; fallback to secure API if only that exists
  const electronAPISource = (typeof window !== 'undefined' && (window.electronAPI || window.secureElectronAPI)) || null;
  const electronAPI = options.electronAPI || electronAPISource;
  
  /**
   * Open the preferences modal
   * Shows the preferences dialog for user configuration
   */
  function openPreferencesModal() {
    try {
      import('../ui/bootstrap-adapter.js').then(({ showModal }) => showModal('#preferencesModal'));
    } catch {}
  }
  
  /**
   * Load preferences into the UI
   * Loads all stored preferences and populates the preferences modal
   */
  async function loadPreferences() {
    // Use new store API for loading preferences
    if (electronAPI && electronAPI.store) {
      try {
        const [dbDir, musicDir, hotkeyDir, fadeSeconds, debugLogPref, prereleasePref] = await Promise.all([
          electronAPI.store.get("database_directory"),
          electronAPI.store.get("music_directory"),
          electronAPI.store.get("hotkey_directory"),
          electronAPI.store.get("fade_out_seconds"),
          electronAPI.store.get("debug_log_enabled"),
          electronAPI.store.get("prerelease_updates")
        ]);
        
        if (dbDir.success) { const el = document.getElementById('preferences-database-directory'); if (el) el.value = dbDir.value || ''; }
        if (musicDir.success) { const el = document.getElementById('preferences-song-directory'); if (el) el.value = musicDir.value || ''; }
        if (hotkeyDir.success) { const el = document.getElementById('preferences-hotkey-directory'); if (el) el.value = hotkeyDir.value || ''; }
        if (fadeSeconds.success) { const el = document.getElementById('preferences-fadeout-seconds'); if (el) el.value = fadeSeconds.value || ''; }
        if (debugLogPref.success) { const el = document.getElementById('preferences-debug-log-enabled'); if (el) el.checked = !!debugLogPref.value; }
        if (prereleasePref.success) { const el = document.getElementById('preferences-prerelease-updates'); if (el) el.checked = !!prereleasePref.value; }
      } catch (error) {
        await debugLog.error('Failed to load preferences', { 
          function: "loadPreferences",
          error: error
        });
      }
    }
  }
  
  /**
   * Load preferences using legacy store access
   * Fallback method when new API is not available
   */
  async function loadPreferencesLegacy() {}
  
  /**
   * Get database directory preference
   * @returns {Promise<string>} Database directory path
   */
  async function getDatabaseDirectory() {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await electronAPI.store.get("database_directory");
        if (result.success) {
          return result.value;
        } else {
          await debugLog.warn('Failed to get database directory', { 
            function: "getDatabaseDirectory",
            error: result.error
          });
          return null;
        }
      } catch (error) {
        await debugLog.error('Database directory get error', { 
          function: "getDatabaseDirectory",
          error: error
        });
        return null;
      }
    }
  }
  
  /**
   * Get music directory preference
   * @returns {Promise<string>} Music directory path
   */
  async function getMusicDirectory() {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await electronAPI.store.get("music_directory");
        if (result.success) {
          return result.value;
        } else {
          await debugLog.warn('Failed to get music directory', { 
            function: "getMusicDirectory",
            error: result.error
          });
          return null;
        }
      } catch (error) {
        await debugLog.error('Music directory get error', { 
          function: "getMusicDirectory",
          error: error
        });
        return null;
      }
    }
  }
  
  /**
   * Get hotkey directory preference
   * @returns {Promise<string>} Hotkey directory path
   */
  async function getHotkeyDirectory() {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await electronAPI.store.get("hotkey_directory");
        if (result.success) {
          return result.value;
        } else {
          await debugLog.warn('Failed to get hotkey directory', { 
            function: "getHotkeyDirectory",
            error: result.error
          });
          return null;
        }
      } catch (error) {
        await debugLog.error('Hotkey directory get error', { 
          function: "getHotkeyDirectory",
          error: error
        });
        return null;
      }
    }
  }
  
  /**
   * Get fade out seconds preference
   * @returns {Promise<number>} Fade out duration in seconds
   */
  async function getFadeOutSeconds() {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await electronAPI.store.get("fade_out_seconds");
        if (result.success) {
          return result.value;
        } else {
          await debugLog.warn('Failed to get fade out seconds', { 
            function: "getFadeOutSeconds",
            error: result.error
          });
          return null;
        }
      } catch (error) {
        await debugLog.error('Fade out seconds get error', { 
          function: "getFadeOutSeconds",
          error: error
        });
        return null;
      }
    }
  }
  
  /**
   * Get debug log enabled preference
   * @returns {Promise<boolean>} Debug log enabled status
   */
  async function getDebugLogEnabled() {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await electronAPI.store.get("debug_log_enabled");
        if (result.success) {
          return result.value || false;
        } else {
          await debugLog.warn('Failed to get debug log enabled', { 
            function: "getDebugLogEnabled",
            error: result.error
          });
          return false;
        }
      } catch (error) {
        await debugLog.error('Debug log enabled get error', { 
          function: "getDebugLogEnabled",
          error: error
        });
        return false;
      }
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