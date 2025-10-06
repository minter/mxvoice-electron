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
  'holding_tank_mode'
];

/**
 * Get a preference value
 * @param {string} key - Preference key
 * @param {Object} electronAPI - Electron API object
 * @returns {Promise<{success: boolean, value: any}>}
 */
export async function getPreference(key, electronAPI) {
  if (GLOBAL_PREFERENCES.includes(key)) {
    // Use global store for directories
    return await electronAPI.store.get(key);
  } else if (PROFILE_PREFERENCES.includes(key)) {
    // Use profile preferences
    return await electronAPI.profile.getPreference(key);
  } else {
    // Unknown preference, try global store as fallback
    console.warn(`Unknown preference key: ${key}, using global store`);
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
  if (GLOBAL_PREFERENCES.includes(key)) {
    // Use global store for directories
    return await electronAPI.store.set(key, value);
  } else if (PROFILE_PREFERENCES.includes(key)) {
    // Use profile preferences
    return await electronAPI.profile.setPreference(key, value);
  } else {
    // Unknown preference, try global store as fallback
    console.warn(`Unknown preference key: ${key}, using global store`);
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

