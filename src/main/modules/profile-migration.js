/**
 * Profile Migration Module
 * 
 * Handles migration from single-user installations to the multi-profile system.
 * Creates "Default User" profile from existing settings and ensures smooth transition.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';
import initializeMainDebugLog from './debug-log.js';

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let debugLog = null;
let store = null;

/**
 * Initialize the Profile Migration
 * @param {Object} dependencies - Module dependencies
 */
function initializeProfileMigration(dependencies) {
  store = dependencies.store;
  debugLog = dependencies.debugLog || initializeMainDebugLog({ store });
  
  debugLog?.info('Profile Migration initialized', { 
    module: 'profile-migration', 
    function: 'initializeProfileMigration' 
  });
}

/**
 * Get the profiles directory path
 * @returns {string} Path to profiles directory
 */
function getProfilesDirectory() {
  return path.join(app.getPath('userData'), 'profiles');
}

/**
 * Get the profile registry file path
 * @returns {string} Path to profiles.json
 */
function getProfileRegistryPath() {
  return path.join(app.getPath('userData'), 'profiles.json');
}

/**
 * Check if migration is needed
 * @returns {boolean} Whether migration is needed
 */
function needsMigration() {
  try {
    // Check if profiles.json exists
    const registryPath = getProfileRegistryPath();
    return !fs.existsSync(registryPath);
  } catch (error) {
    debugLog?.error('Failed to check migration need', { 
      module: 'profile-migration', 
      function: 'needsMigration',
      error: error.message 
    });
    return true; // Default to needing migration on error
  }
}

/**
 * Get current settings from store for migration
 * @returns {Object} Current settings object
 */
function getCurrentSettings() {
  try {
    // Get all current settings from store
    const settings = {};
    
    // Profile-specific settings that should be migrated
    const profileSettings = [
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
    
    // Extract profile-specific settings
    profileSettings.forEach(key => {
      try {
        const value = store.get(key);
        if (value !== undefined) {
          settings[key] = value;
        }
      } catch (error) {
        debugLog?.warn(`Failed to get setting ${key}`, { 
          module: 'profile-migration', 
          function: 'getCurrentSettings',
          key,
          error: error.message 
        });
      }
    });
    
    // Add metadata
    settings.created_at = Date.now();
    settings.last_used = Date.now();
    
    return settings;
  } catch (error) {
    debugLog?.error('Failed to get current settings', { 
      module: 'profile-migration', 
      function: 'getCurrentSettings',
      error: error.message 
    });
    return {};
  }
}

/**
 * Create Default User profile from current settings
 * @returns {Promise<boolean>} Success status
 */
async function createDefaultUserProfile() {
  try {
    debugLog?.info('Creating Default User profile from current settings', { 
      module: 'profile-migration', 
      function: 'createDefaultUserProfile' 
    });
    
    // Get current settings
    const currentSettings = getCurrentSettings();
    
    // Create profiles directory
    const profilesDir = getProfilesDirectory();
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    
    // Create Default User directory
    const defaultUserDir = path.join(profilesDir, 'Default User');
    if (!fs.existsSync(defaultUserDir)) {
      fs.mkdirSync(defaultUserDir, { recursive: true });
    }
    
    // Save Default User preferences
    const preferencesPath = path.join(defaultUserDir, 'preferences.json');
    fs.writeFileSync(preferencesPath, JSON.stringify(currentSettings, null, 2));
    
    // Create profile registry
    const registry = {
      profiles: {
        'Default User': {
          name: 'Default User',
          description: 'Shared settings from previous installation',
          created_at: Date.now(),
          last_used: Date.now()
        }
      },
      metadata: {
        version: '1.0.0',
        created_at: Date.now(),
        migrated_from_single_user: true
      }
    };
    
    // Save registry
    const registryPath = getProfileRegistryPath();
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    
    // Set Default User as active profile
    store.set('active_profile', 'Default User');
    
    debugLog?.info('Default User profile created successfully', { 
      module: 'profile-migration', 
      function: 'createDefaultUserProfile' 
    });
    
    return true;
  } catch (error) {
    debugLog?.error('Failed to create Default User profile', { 
      module: 'profile-migration', 
      function: 'createDefaultUserProfile',
      error: error.message 
    });
    return false;
  }
}

/**
 * Perform profile migration
 * @returns {Promise<boolean>} Success status
 */
async function performMigration() {
  try {
    debugLog?.info('Starting profile migration', { 
      module: 'profile-migration', 
      function: 'performMigration' 
    });
    
    if (!needsMigration()) {
      debugLog?.info('No migration needed', { 
        module: 'profile-migration', 
        function: 'performMigration' 
      });
      return true;
    }
    
    // Create Default User profile
    const success = await createDefaultUserProfile();
    
    if (success) {
      debugLog?.info('Profile migration completed successfully', { 
        module: 'profile-migration', 
        function: 'performMigration' 
      });
    } else {
      debugLog?.error('Profile migration failed', { 
        module: 'profile-migration', 
        function: 'performMigration' 
      });
    }
    
    return success;
  } catch (error) {
    debugLog?.error('Profile migration error', { 
      module: 'profile-migration', 
      function: 'performMigration',
      error: error.message 
    });
    return false;
  }
}

/**
 * Check if migration was successful
 * @returns {boolean} Whether migration was successful
 */
function isMigrationComplete() {
  try {
    const registryPath = getProfileRegistryPath();
    return fs.existsSync(registryPath);
  } catch (error) {
    debugLog?.error('Failed to check migration completion', { 
      module: 'profile-migration', 
      function: 'isMigrationComplete',
      error: error.message 
    });
    return false;
  }
}

/**
 * Get migration status information
 * @returns {Object} Migration status
 */
function getMigrationStatus() {
  try {
    const needsMig = needsMigration();
    const isComplete = isMigrationComplete();
    
    return {
      needsMigration: needsMig,
      isComplete: isComplete,
      hasDefaultUser: !needsMig && isComplete
    };
  } catch (error) {
    debugLog?.error('Failed to get migration status', { 
      module: 'profile-migration', 
      function: 'getMigrationStatus',
      error: error.message 
    });
    return {
      needsMigration: true,
      isComplete: false,
      hasDefaultUser: false
    };
  }
}

export {
  initializeProfileMigration,
  needsMigration,
  performMigration,
  isMigrationComplete,
  getMigrationStatus,
  createDefaultUserProfile
};
