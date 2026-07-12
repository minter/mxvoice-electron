/**
 * Profile Preference Adapter
 * 
 * Routes preference get/set operations to either:
 * - Profile-specific preferences (theme, font, column order, fade out, etc.)
 * - Global preferences (directories, debug logging)
 */

// Get debugLog from global scope (initialized early in renderer bootstrap)
let debugLog = null;
try {
  if (typeof window !== 'undefined' && window.debugLog) {
    debugLog = window.debugLog;
  }
} catch {
  // debugLog not available yet - will use fallback logging
}

const GLOBAL_PREFERENCES = [
  'database_directory',
  'music_directory',
  'hotkey_directory',
  'debug_log_enabled'
];

const PROFILE_PREFERENCES = [
  'screen_mode',
  'font_size',
  'column_order',
  'fade_out_seconds',
  'crossfade_seconds',
  'prerelease_updates',
  'holding_tank_mode',
  'window_state',
  'browser_width',
  'browser_height'
];

/**
 * Get a preference value
 * @param {string} key - Preference key
 * @param {Object} electronAPI - Electron API object
 * @returns {Promise<{success: boolean, value: any}>}
 */
export async function getPreference(key, electronAPI) {
  // Validate electronAPI
  if (!electronAPI) {
    debugLog?.error('[PREF-ADAPTER] electronAPI is undefined', { 
      module: 'profile-preference-adapter', 
      function: 'getPreference' 
    });
    return { success: false, error: 'electronAPI is undefined' };
  }
  
  if (GLOBAL_PREFERENCES.includes(key)) {
    // Use global store for directories
    if (!electronAPI.store) {
      debugLog?.error('[PREF-ADAPTER] electronAPI.store is undefined', { 
        module: 'profile-preference-adapter', 
        function: 'getPreference',
        key 
      });
      return { success: false, error: 'electronAPI.store is undefined' };
    }
    return await electronAPI.store.get(key);
  }

  if (PROFILE_PREFERENCES.includes(key)) {
    if (!electronAPI.profile) {
      debugLog?.error('[PREF-ADAPTER] electronAPI.profile is undefined', {
        module: 'profile-preference-adapter',
        function: 'getPreference',
        key
      });
      return { success: false, error: 'electronAPI.profile is undefined' };
    }
    return await electronAPI.profile.getPreference(key);
  }

  debugLog?.error(`[PREF-ADAPTER] Unknown preference key: ${key}`, {
    module: 'profile-preference-adapter',
    function: 'getPreference',
    key
  });
  return { success: false, error: `Unknown preference key: ${key}` };
}

/**
 * Set a preference value
 * @param {string} key - Preference key
 * @param {any} value - Preference value
 * @param {Object} electronAPI - Electron API object
 * @returns {Promise<{success: boolean}>}
 */
export async function setPreference(key, value, electronAPI) {
  // Validate electronAPI
  if (!electronAPI) {
    debugLog?.error('[PREF-ADAPTER] electronAPI is undefined in setPreference', { 
      module: 'profile-preference-adapter', 
      function: 'setPreference',
      key 
    });
    return { success: false, error: 'electronAPI is undefined' };
  }
  
  if (GLOBAL_PREFERENCES.includes(key)) {
    // Use global store for directories
    if (!electronAPI.store) {
      debugLog?.error('[PREF-ADAPTER] electronAPI.store is undefined in setPreference', { 
        module: 'profile-preference-adapter', 
        function: 'setPreference',
        key 
      });
      return { success: false, error: 'electronAPI.store is undefined' };
    }
    return await electronAPI.store.set(key, value);
  }

  if (PROFILE_PREFERENCES.includes(key)) {
    if (!electronAPI.profile) {
      debugLog?.error('[PREF-ADAPTER] electronAPI.profile is undefined in setPreference', {
        module: 'profile-preference-adapter',
        function: 'setPreference',
        key
      });
      return { success: false, error: 'electronAPI.profile is undefined' };
    }
    return await electronAPI.profile.setPreference(key, value);
  }

  debugLog?.error(`[PREF-ADAPTER] Unknown preference key: ${key}`, {
    module: 'profile-preference-adapter',
    function: 'setPreference',
    key
  });
  return { success: false, error: `Unknown preference key: ${key}` };
}

/**
 * Get all profile-specific preferences
 * @param {Object} electronAPI - Electron API object
 * @returns {Promise<{success: boolean, preferences: Object}>}
 */
export async function getAllProfilePreferences(electronAPI) {
  return await electronAPI.profile.getAllPreferences();
}

// Export constants as named exports for easier importing
export { GLOBAL_PREFERENCES, PROFILE_PREFERENCES };

export default {
  getPreference,
  setPreference,
  getAllProfilePreferences,
  GLOBAL_PREFERENCES,
  PROFILE_PREFERENCES
};
