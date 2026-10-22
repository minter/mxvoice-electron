/**
 * Preference Manager
 * 
 * Handles preference UI management and loading preferences through the secure API.
 * 
 * @module preference-manager
 */

import { getPreference } from './profile-preference-adapter.js';

/**
 * Initialize the preference manager
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @returns {Object} Preference manager interface
 */
function initializePreferenceManager(options = {}) {
  const electronAPISource = (typeof window !== 'undefined' && window.secureElectronAPI) || null;
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
      
      // Wait for Bootstrap to be available before showing modal
      await waitForBootstrap();
      
      const { showModal } = await import('../ui/bootstrap-adapter.js');
      showModal('#preferencesModal');
    } catch (error) {
      debugLog?.error('Failed to open preferences modal', {
        function: 'openPreferencesModal',
        error: error.message
      });
    }
  }

  async function readPreference(key, fallback = null) {
    try {
      const result = await getPreference(key, electronAPI);
      if (result.success) return result.value ?? fallback;

      debugLog?.warn(`Failed to get preference ${key}`, {
        function: 'readPreference',
        key,
        error: result.error
      });
    } catch (error) {
      debugLog?.error(`Preference get error for ${key}`, {
        function: 'readPreference',
        key,
        error
      });
    }

    return fallback;
  }
  
  /**
   * Wait for Bootstrap to be available
   * @returns {Promise<void>}
   */
  function waitForBootstrap(maxWait = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkBootstrap = () => {
        const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || 
                   (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
        
        if (bs && bs.Modal) {
          resolve();
          return;
        }
        
        if (Date.now() - startTime > maxWait) {
          debugLog?.warn('Bootstrap not ready after timeout, proceeding anyway', {
            function: 'waitForBootstrap',
            maxWait
          });
          resolve();
          return;
        }
        
        setTimeout(checkBootstrap, 50);
      };
      
      checkBootstrap();
    });
  }
  
  /**
   * Load preferences into the UI
   * Loads all stored preferences and populates the preferences modal
   */
  async function loadPreferences() {
    debugLog?.info('[PREFS-LOAD] Current API status', {
      function: 'loadPreferences',
      hasCurrentAPI: !!electronAPI,
      hasStore: !!electronAPI?.store,
      hasProfile: !!electronAPI?.profile,
      apiKeys: electronAPI ? Object.keys(electronAPI) : []
    });
    
    // Use adapter for loading preferences (routes to profile or global as appropriate)
    if (electronAPI?.store && electronAPI?.profile) {
      try {
        const [dbDir, musicDir, hotkeyDir, fadeSeconds, crossfadeSeconds, debugLogPref, prereleasePref, screenModePref] = await Promise.all([
          getPreference("database_directory", electronAPI),
          getPreference("music_directory", electronAPI),
          getPreference("hotkey_directory", electronAPI),
          getPreference("fade_out_seconds", electronAPI),
          getPreference("crossfade_seconds", electronAPI),
          getPreference("debug_log_enabled", electronAPI),
          getPreference("prerelease_updates", electronAPI),
          getPreference("screen_mode", electronAPI)
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
        if (crossfadeSeconds.success) {
          const el = document.getElementById('preferences-crossfade-seconds');
          if (el) {
            el.value = crossfadeSeconds.value || '0';
            debugLog?.info('[PREFS-LOAD] Set crossfade seconds field', { value: crossfadeSeconds.value, finalValue: el.value });
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
        // Load analytics opt-out status
        const analyticsAPI = electronAPI.analytics;
        if (analyticsAPI) {
          try {
            const analyticsResult = await analyticsAPI.getOptOutStatus();
            if (analyticsResult.success) {
              const el = document.getElementById('preferences-analytics-enabled');
              if (el) {
                // The checkbox is "enabled" but the store tracks "opt_out", so invert
                el.checked = !analyticsResult.value;
                debugLog?.info('[PREFS-LOAD] Set analytics enabled field', { optedOut: analyticsResult.value, checked: el.checked });
              }
            }
          } catch (error) {
            debugLog?.warn('[PREFS-LOAD] Could not load analytics preference', { error: error.message });
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
        hasElectronAPI: !!electronAPI,
        hasStore: !!electronAPI?.store,
        hasProfile: !!electronAPI?.profile
      });
    }
  }
  
  /**
   * Get database directory preference
   * @returns {Promise<string>} Database directory path
   */
  async function getDatabaseDirectory() {
    return readPreference('database_directory');
  }
  
  /**
   * Get music directory preference
   * @returns {Promise<string>} Music directory path
   */
  async function getMusicDirectory() {
    return readPreference('music_directory');
  }
  
  /**
   * Get hotkey directory preference
   * @returns {Promise<string>} Hotkey directory path
   */
  async function getHotkeyDirectory() {
    return readPreference('hotkey_directory');
  }
  
  /**
   * Get fade out seconds preference
   * @returns {Promise<number>} Fade out duration in seconds
   */
  async function getFadeOutSeconds() {
    return readPreference('fade_out_seconds');
  }
  
  /**
   * Get debug log enabled preference (universal setting)
   * @returns {Promise<boolean>} Debug log enabled status
   */
  async function getDebugLogEnabled() {
    return readPreference('debug_log_enabled', true);
  }
  
  /**
   * Get prerelease updates preference
   * @returns {Promise<boolean>} Prerelease updates enabled status
   */
  async function getPrereleaseUpdates() {
    return readPreference('prerelease_updates', false);
  }
  
  /**
   * Get screen mode preference
   * @returns {Promise<string>} Screen mode preference ('auto', 'light', or 'dark')
   */
  async function getScreenMode() {
    return readPreference('screen_mode', 'auto');
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

  return PreferenceManager;
}

export {
  initializePreferenceManager
};

// Default export for module loading
export default initializePreferenceManager;
