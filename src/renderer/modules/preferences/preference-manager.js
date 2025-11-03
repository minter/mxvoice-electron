/**
 * Preference Manager
 * 
 * Handles preference UI management and loading of preferences from store.
 * 
 * @module preference-manager
 */

import { getPreference, setPreference } from './profile-preference-adapter.js';

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
  const debugLog = typeof window !== 'undefined' ? window.debugLog : null;
  
  /**
   * Open the preferences modal
   * Shows the preferences dialog for user configuration
   */
  async function openPreferencesModal() {
    try {
      // Load preferences first, then show modal
      await loadPreferences();
      const { showModal } = await import('../ui/bootstrap-adapter.js');
      showModal('#preferencesModal');
    } catch (error) {
      debugLog?.error('Failed to open preferences modal', {
        function: 'openPreferencesModal',
        error: error.message
      });
    }
  }
  
  /**
   * Load preferences into the UI
   * Loads all stored preferences and populates the preferences modal
   */
  async function loadPreferences() {
    // Get the current electronAPI (may have been set after initialization)
    const currentAPI = electronAPI || (typeof window !== 'undefined' && (window.electronAPI || window.secureElectronAPI));
    
    debugLog?.info('[PREFS-LOAD] Current API status', {
      function: 'loadPreferences',
      hasCurrentAPI: !!currentAPI,
      hasStore: !!(currentAPI && currentAPI.store),
      hasProfile: !!(currentAPI && currentAPI.profile),
      apiKeys: currentAPI ? Object.keys(currentAPI) : []
    });
    
    // Use adapter for loading preferences (routes to profile or global as appropriate)
    if (currentAPI && currentAPI.store) {
      try {
        const [dbDir, musicDir, hotkeyDir, fadeSeconds, debugLogPref, prereleasePref, screenModePref] = await Promise.all([
          getPreference("database_directory", currentAPI),
          getPreference("music_directory", currentAPI),
          getPreference("hotkey_directory", currentAPI),
          getPreference("fade_out_seconds", currentAPI),
          getPreference("debug_log_enabled", currentAPI),
          getPreference("prerelease_updates", currentAPI),
          getPreference("screen_mode", currentAPI)
        ]);
        
        debugLog?.info('[PREFS-LOAD] Loaded preferences', {
          function: 'loadPreferences',
          dbDir: dbDir,
          musicDir: musicDir,
          hotkeyDir: hotkeyDir
        });
        
        if (dbDir.success) { 
          const el = document.getElementById('preferences-database-directory'); 
          if (el) {
            el.value = dbDir.value || ''; 
            debugLog?.info('[PREFS-LOAD] Set database directory field', {
              elementFound: !!el,
              value: dbDir.value,
              finalValue: el.value
            });
          }
        }
        if (musicDir.success) { 
          const el = document.getElementById('preferences-song-directory'); 
          if (el) {
            el.value = musicDir.value || ''; 
            debugLog?.info('[PREFS-LOAD] Set music directory field', {
              elementFound: !!el,
              value: musicDir.value,
              finalValue: el.value
            });
          }
        }
        if (hotkeyDir.success) { 
          const el = document.getElementById('preferences-hotkey-directory'); 
          if (el) {
            el.value = hotkeyDir.value || ''; 
            debugLog?.info('[PREFS-LOAD] Set hotkey directory field', {
              elementFound: !!el,
              value: hotkeyDir.value,
              finalValue: el.value
            });
          }
        }
        if (fadeSeconds.success) { 
          const el = document.getElementById('preferences-fadeout-seconds'); 
          if (el) {
            el.value = fadeSeconds.value || '3';
            debugLog?.info('[PREFS-LOAD] Set fade seconds field', { value: fadeSeconds.value, finalValue: el.value });
          }
        }
        if (debugLogPref.success) { 
          const el = document.getElementById('preferences-debug-log-enabled'); 
          if (el) {
            el.checked = !!debugLogPref.value;
            debugLog?.info('[PREFS-LOAD] Set debug log field', { value: debugLogPref.value, checked: el.checked });
          }
        }
        if (prereleasePref.success) { 
          const el = document.getElementById('preferences-prerelease-updates'); 
          if (el) {
            el.checked = !!prereleasePref.value;
            debugLog?.info('[PREFS-LOAD] Set prerelease field', { value: prereleasePref.value, checked: el.checked });
          }
        }
        if (screenModePref.success) { 
          const el = document.getElementById('preferences-screen-mode'); 
          if (el) {
            el.value = screenModePref.value || 'auto';
            debugLog?.info('[PREFS-LOAD] Set screen mode field', { value: screenModePref.value, finalValue: el.value });
          }
        }
      } catch (error) {
        debugLog?.error('Failed to load preferences', { 
          function: "loadPreferences",
          error: error.message,
          stack: error.stack
        });
      }
    } else {
      debugLog?.error('Cannot load preferences - electronAPI not available', {
        function: 'loadPreferences',
        hasElectronAPI: !!currentAPI,
        hasStore: !!(currentAPI && currentAPI.store),
        windowAPI: typeof window !== 'undefined' ? {
          hasElectronAPI: !!window.electronAPI,
          hasSecureAPI: !!window.secureElectronAPI
        } : 'window not available'
      });
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
        const result = await getPreference("database_directory", electronAPI);
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
        const result = await getPreference("music_directory", electronAPI);
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
        const result = await getPreference("hotkey_directory", electronAPI);
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
        const result = await getPreference("fade_out_seconds", electronAPI);
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
        const result = await getPreference("debug_log_enabled", electronAPI);
        if (result.success) {
          return result.value || false;
        } else {
          await debugLog.error('Failed to get debug log enabled', { 
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
  
  /**
   * Get prerelease updates preference
   * @returns {Promise<boolean>} Prerelease updates enabled status
   */
  async function getPrereleaseUpdates() {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await getPreference("prerelease_updates", electronAPI);
        if (result.success) {
          return result.value || false;
        } else {
          await debugLog.warn('Failed to get prerelease updates', { 
            function: "getPrereleaseUpdates",
            error: result.error
          });
          return false;
        }
      } catch (error) {
        await debugLog.error('Prerelease updates get error', { 
          function: "getPrereleaseUpdates",
          error: error
        });
        return false;
      }
    }
  }
  
  /**
   * Get screen mode preference
   * @returns {Promise<string>} Screen mode preference ('auto', 'light', or 'dark')
   */
  async function getScreenMode() {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await getPreference("screen_mode", electronAPI);
        if (result.success) {
          return result.value || 'auto';
        } else {
          await debugLog.warn('Failed to get screen mode', { 
            function: "getScreenMode",
            error: result.error
          });
          return 'auto';
        }
      } catch (error) {
        await debugLog.error('Screen mode get error', { 
          function: "getScreenMode",
          error: error
        });
        return 'auto';
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
    getDebugLogEnabled,
    getPrereleaseUpdates,
    getScreenMode
  };

  const preferenceManagerInstance = PreferenceManager;

  return PreferenceManager;
}

export {
  initializePreferenceManager
};

// Default export for module loading
export default initializePreferenceManager; 