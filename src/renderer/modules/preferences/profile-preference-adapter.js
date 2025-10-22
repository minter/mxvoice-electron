/**
 * Profile Preference Adapter
 * 
 * Routes preference get/set operations to either:
 * - Profile-specific preferences (theme, font, column order, etc.)
 * - Global preferences (directories)
 */

const GLOBAL_PREFERENCES = [
  'database_directory',
  'music_directory',
  'hotkey_directory'
];

const PROFILE_PREFERENCES = [
  'screen_mode',
  'font_size',
  'column_order',
  'fade_out_seconds',
  'debug_log_enabled',
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
    console.error('[PREF-ADAPTER] electronAPI is undefined');
    return { success: false, error: 'electronAPI is undefined' };
  }
  
  if (GLOBAL_PREFERENCES.includes(key)) {
    // Use global store for directories
    if (!electronAPI.store) {
      console.error('[PREF-ADAPTER] electronAPI.store is undefined');
      return { success: false, error: 'electronAPI.store is undefined' };
    }
    return await electronAPI.store.get(key);
  } else if (PROFILE_PREFERENCES.includes(key)) {
    // Use profile preferences (with fallback to global store during initialization)
    if (!electronAPI.profile) {
      // During app initialization, profile API may not be ready yet
      // Fall back to global store temporarily
      if (electronAPI.store) {
        return await electronAPI.store.get(key);
      } else {
        console.error('[PREF-ADAPTER] Neither electronAPI.profile nor electronAPI.store is available');
        return { success: false, error: 'No preference API available' };
      }
    }
    return await electronAPI.profile.getPreference(key);
  } else {
    // Unknown preference, try global store as fallback
    console.warn(`Unknown preference key: ${key}, using global store`);
    if (!electronAPI.store) {
      console.error('[PREF-ADAPTER] electronAPI.store is undefined for fallback');
      return { success: false, error: 'electronAPI.store is undefined' };
    }
    return await electronAPI.store.get(key);
  }
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
    console.error('[PREF-ADAPTER] electronAPI is undefined in setPreference');
    return { success: false, error: 'electronAPI is undefined' };
  }
  
  if (GLOBAL_PREFERENCES.includes(key)) {
    // Use global store for directories
    if (!electronAPI.store) {
      console.error('[PREF-ADAPTER] electronAPI.store is undefined in setPreference');
      return { success: false, error: 'electronAPI.store is undefined' };
    }
    return await electronAPI.store.set(key, value);
  } else if (PROFILE_PREFERENCES.includes(key)) {
    // Use profile preferences (with fallback to global store during initialization)
    if (!electronAPI.profile) {
      // During app initialization, profile API may not be ready yet
      // Fall back to global store temporarily
      console.warn(`[PREF-ADAPTER] Profile API not available for ${key}, falling back to global store`);
      if (electronAPI.store) {
        return await electronAPI.store.set(key, value);
      } else {
        console.error('[PREF-ADAPTER] Neither electronAPI.profile nor electronAPI.store is available in setPreference');
        return { success: false, error: 'No preference API available' };
      }
    }
    return await electronAPI.profile.setPreference(key, value);
  } else {
    // Unknown preference, try global store as fallback
    console.warn(`[PREF-ADAPTER] Unknown preference key: ${key}, using global store`);
    if (!electronAPI.store) {
      console.error('[PREF-ADAPTER] electronAPI.store is undefined for fallback in setPreference');
      return { success: false, error: 'electronAPI.store is undefined' };
    }
    return await electronAPI.store.set(key, value);
  }
}

/**
 * Get all profile-specific preferences
 * @param {Object} electronAPI - Electron API object
 * @returns {Promise<{success: boolean, preferences: Object}>}
 */
export async function getAllProfilePreferences(electronAPI) {
  return await electronAPI.profile.getAllPreferences();
}

export default {
  getPreference,
  setPreference,
  getAllProfilePreferences,
  GLOBAL_PREFERENCES,
  PROFILE_PREFERENCES
};

