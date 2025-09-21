/**
 * Profile-Aware Store Module
 * 
 * Provides profile-aware store operations that automatically handle
 * profile-specific preferences while keeping global settings separate.
 */

import initializeMainDebugLog from './debug-log.js';

let debugLog = null;
let store = null;
let profileManager = null;

// Profile-specific settings that should be stored per profile
const PROFILE_SPECIFIC_SETTINGS = [
  'fade_out_seconds',
  'screen_mode',
  'font_size',
  'browser_width',
  'browser_height',
  'window_state',
  'debug_log_enabled',
  'prerelease_updates',
  'holding_tank_mode',
  'holding_tank',
  'hotkeys'
];

// Global settings that should remain in main store
const GLOBAL_SETTINGS = [
  'music_directory',
  'hotkey_directory',
  'database_directory',
  'first_run_completed',
  'active_profile',
  'profile_selection_shown'
];

/**
 * Initialize the Profile Store
 * @param {Object} dependencies - Module dependencies
 */
function initializeProfileStore(dependencies) {
  store = dependencies.store;
  profileManager = dependencies.profileManager;
  debugLog = dependencies.debugLog || initializeMainDebugLog({ store });
  
  debugLog?.info('Profile Store initialized', { 
    module: 'profile-store', 
    function: 'initializeProfileStore' 
  });
}

/**
 * Check if a setting is profile-specific
 * @param {string} key - Setting key
 * @returns {boolean} Whether setting is profile-specific
 */
function isProfileSpecific(key) {
  return PROFILE_SPECIFIC_SETTINGS.includes(key);
}

/**
 * Check if a setting is global
 * @param {string} key - Setting key
 * @returns {boolean} Whether setting is global
 */
function isGlobalSetting(key) {
  return GLOBAL_SETTINGS.includes(key);
}

/**
 * Get a value from the appropriate store (profile or global)
 * @param {string} key - Setting key
 * @returns {Promise<any>} Setting value
 */
async function get(key) {
  try {
    // Handle global settings
    if (isGlobalSetting(key)) {
      const value = store.get(key);
      debugLog?.debug('Profile store get (global)', { 
        module: 'profile-store', 
        function: 'get',
        key,
        value,
        valueType: typeof value
      });
      return value;
    }
    
    // Handle profile-specific settings
    if (isProfileSpecific(key)) {
      const activeProfile = await profileManager.getActiveProfile();
      debugLog?.debug('Profile store get (profile-specific)', { 
        module: 'profile-store', 
        function: 'get',
        key,
        activeProfile,
        isProfileSpecific: true
      });
      
      const preferences = await profileManager.loadProfilePreferences(activeProfile);
      
      if (preferences && key in preferences) {
        debugLog?.debug('Profile store get (found in profile)', { 
          module: 'profile-store', 
          function: 'get',
          key,
          value: preferences[key],
          valueType: typeof preferences[key],
          activeProfile
        });
        return preferences[key];
      }
      
      // Return default value if not found in profile
      const defaultValue = getDefaultValue(key);
      debugLog?.debug('Profile store get (using default)', { 
        module: 'profile-store', 
        function: 'get',
        key,
        defaultValue,
        activeProfile,
        preferencesExist: !!preferences
      });
      return defaultValue;
    }
    
    // For unknown settings, try global store first
    const value = store.get(key);
    debugLog?.debug('Profile store get (unknown setting)', { 
      module: 'profile-store', 
      function: 'get',
      key,
      value,
      valueType: typeof value
    });
    return value;
  } catch (error) {
    debugLog?.error('Profile store get failed', { 
      module: 'profile-store', 
      function: 'get',
      key,
      error: error.message 
    });
    
    // Fallback to global store
    return store.get(key);
  }
}

/**
 * Set a value in the appropriate store (profile or global)
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {Promise<boolean>} Success status
 */
async function set(key, value) {
  try {
    debugLog?.info('Profile store set called', { 
      module: 'profile-store', 
      function: 'set',
      key,
      value,
      valueType: typeof value
    });
    
    // Handle global settings
    if (isGlobalSetting(key)) {
      store.set(key, value);
      debugLog?.debug('Profile store set (global)', { 
        module: 'profile-store', 
        function: 'set',
        key,
        value,
        isGlobalSetting: true
      });
      return true;
    }
    
    // Handle profile-specific settings
    if (isProfileSpecific(key)) {
      const activeProfile = await profileManager.getActiveProfile();
      debugLog?.info('Profile store set (profile-specific)', { 
        module: 'profile-store', 
        function: 'set',
        key,
        value,
        activeProfile,
        isProfileSpecific: true
      });
      
      const preferences = await profileManager.loadProfilePreferences(activeProfile);
      
      // Create preferences object if it doesn't exist
      const updatedPreferences = preferences || {};
      updatedPreferences[key] = value;
      
      debugLog?.info('Profile store set (saving preferences)', { 
        module: 'profile-store', 
        function: 'set',
        key,
        value,
        activeProfile,
        existingPreferences: !!preferences,
        updatedPreferences
      });
      
      // Save updated preferences
      const success = await profileManager.saveProfilePreferences(activeProfile, updatedPreferences);
      
      if (success) {
        debugLog?.info('Profile setting saved successfully', { 
          module: 'profile-store', 
          function: 'set',
          key,
          value,
          profile: activeProfile 
        });
      } else {
        debugLog?.error('Failed to save profile setting', { 
          module: 'profile-store', 
          function: 'set',
          key,
          value,
          profile: activeProfile 
        });
      }
      
      return success;
    }
    
    // For unknown settings, save to global store
    store.set(key, value);
    debugLog?.debug('Profile store set (unknown setting)', { 
      module: 'profile-store', 
      function: 'set',
      key,
      value,
      isUnknownSetting: true
    });
    return true;
  } catch (error) {
    debugLog?.error('Profile store set failed', { 
      module: 'profile-store', 
      function: 'set',
      key,
      value,
      error: error.message 
    });
    
    // Fallback to global store
    try {
      store.set(key, value);
      return true;
    } catch (fallbackError) {
      return false;
    }
  }
}

/**
 * Check if a key exists in the appropriate store
 * @param {string} key - Setting key
 * @returns {Promise<boolean>} Whether key exists
 */
async function has(key) {
  try {
    // Handle global settings
    if (isGlobalSetting(key)) {
      return store.has(key);
    }
    
    // Handle profile-specific settings
    if (isProfileSpecific(key)) {
      const activeProfile = await profileManager.getActiveProfile();
      const preferences = await profileManager.loadProfilePreferences(activeProfile);
      
      return preferences && key in preferences;
    }
    
    // For unknown settings, check global store
    return store.has(key);
  } catch (error) {
    debugLog?.error('Profile store has failed', { 
      module: 'profile-store', 
      function: 'has',
      key,
      error: error.message 
    });
    
    // Fallback to global store
    return store.has(key);
  }
}

/**
 * Delete a key from the appropriate store
 * @param {string} key - Setting key
 * @returns {Promise<boolean>} Success status
 */
async function deleteKey(key) {
  try {
    // Handle global settings
    if (isGlobalSetting(key)) {
      store.delete(key);
      return true;
    }
    
    // Handle profile-specific settings
    if (isProfileSpecific(key)) {
      const activeProfile = await profileManager.getActiveProfile();
      const preferences = await profileManager.loadProfilePreferences(activeProfile);
      
      if (preferences && key in preferences) {
        delete preferences[key];
        return await profileManager.saveProfilePreferences(activeProfile, preferences);
      }
      
      return true; // Key didn't exist, consider it deleted
    }
    
    // For unknown settings, delete from global store
    store.delete(key);
    return true;
  } catch (error) {
    debugLog?.error('Profile store delete failed', { 
      module: 'profile-store', 
      function: 'deleteKey',
      key,
      error: error.message 
    });
    
    // Fallback to global store
    try {
      store.delete(key);
      return true;
    } catch (fallbackError) {
      return false;
    }
  }
}

/**
 * Get default value for a setting
 * @param {string} key - Setting key
 * @returns {any} Default value
 */
function getDefaultValue(key) {
  const defaults = {
    fade_out_seconds: 2,
    screen_mode: 'auto',
    font_size: 11,
    browser_width: 1280,
    browser_height: 1024,
    window_state: null,
    debug_log_enabled: false,
    prerelease_updates: false,
    holding_tank_mode: 'storage',
    holding_tank: null,
    hotkeys: null
  };
  
  return defaults[key] || null;
}

/**
 * Get all profile-specific settings for the active profile
 * @returns {Promise<Object>} Profile preferences
 */
async function getProfilePreferences() {
  try {
    const activeProfile = await profileManager.getActiveProfile();
    return await profileManager.loadProfilePreferences(activeProfile);
  } catch (error) {
    debugLog?.error('Failed to get profile preferences', { 
      module: 'profile-store', 
      function: 'getProfilePreferences',
      error: error.message 
    });
    return null;
  }
}

/**
 * Save all profile-specific settings for the active profile
 * @param {Object} preferences - Preferences to save
 * @returns {Promise<boolean>} Success status
 */
async function saveProfilePreferences(preferences) {
  try {
    const activeProfile = await profileManager.getActiveProfile();
    return await profileManager.saveProfilePreferences(activeProfile, preferences);
  } catch (error) {
    debugLog?.error('Failed to save profile preferences', { 
      module: 'profile-store', 
      function: 'saveProfilePreferences',
      error: error.message 
    });
    return false;
  }
}

/**
 * Switch to a different profile and reload preferences
 * @param {string} profileName - Profile name to switch to
 * @returns {Promise<boolean>} Success status
 */
async function switchProfile(profileName) {
  try {
    debugLog?.info('Switching profile', { 
      module: 'profile-store', 
      function: 'switchProfile',
      profileName 
    });
    
    // Set active profile
    const success = await profileManager.setActiveProfile(profileName);
    
    if (success) {
      debugLog?.info('Profile switched successfully', { 
        module: 'profile-store', 
        function: 'switchProfile',
        profileName 
      });
    }
    
    return success;
  } catch (error) {
    debugLog?.error('Failed to switch profile', { 
      module: 'profile-store', 
      function: 'switchProfile',
      profileName,
      error: error.message 
    });
    return false;
  }
}

export {
  initializeProfileStore,
  isProfileSpecific,
  isGlobalSetting,
  get,
  set,
  has,
  deleteKey,
  getDefaultValue,
  getProfilePreferences,
  saveProfilePreferences,
  switchProfile
};
