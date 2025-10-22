/**
 * Profile Manager Module
 * 
 * Handles user profile creation, management, and storage.
 * Profiles allow multiple users to have separate preferences while sharing the database.
 * 
 * Architecture:
 * - Profiles are stored in userData/profiles/ directory
 * - Each profile has a preferences.json file
 * - Profile registry stored in userData/profiles.json
 * - Main app launches with --profile="ProfileName" argument
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import electron from 'electron';
import { fileURLToPath } from 'url';

// Destructure app from electron (handles both named and default exports)
const { app } = electron;

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let debugLog = null;

/**
 * Initialize the Profile Manager
 * @param {Object} dependencies - Module dependencies
 */
function initializeProfileManager(dependencies) {
  debugLog = dependencies.debugLog;
  
  debugLog?.info('Profile Manager initialized', { 
    module: 'profile-manager', 
    function: 'initializeProfileManager' 
  });
  
  // Ensure profiles directory exists
  const profilesDir = getProfilesDirectory();
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
    debugLog?.info('Created profiles directory', { 
      module: 'profile-manager',
      path: profilesDir 
    });
  }
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
 * Get the profile preferences file path
 * @param {string} profileName - Name of the profile
 * @returns {string} Path to profile preferences file
 */
function getProfilePreferencesPath(profileName) {
  const safeProfileName = sanitizeProfileName(profileName);
  return path.join(getProfilesDirectory(), safeProfileName, 'preferences.json');
}

/**
 * Sanitize profile name for filesystem safety
 * 
 * CRITICAL: This function MUST be used whenever constructing filesystem paths
 * for profile directories. Inconsistent sanitization causes state files to be
 * saved/loaded from wrong locations (e.g., "ComedySportz Saturday" vs "ComedySportzSaturday").
 * 
 * Use getProfileDirectory() from index-modular.js instead of manually constructing paths.
 * 
 * @param {string} name - Profile name
 * @returns {string} Sanitized name safe for filesystem (removes special chars, keeps spaces/hyphens/underscores)
 */
function sanitizeProfileName(name) {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
}

/**
 * Get the default profile preferences structure
 * @returns {Object} Default preferences object
 */
function getDefaultPreferences() {
  return {
    // Audio settings
    fade_out_seconds: 3,
    
    // Appearance & UI
    screen_mode: 'auto',
    font_size: 11,
    column_order: null, // Will default to natural order if null
    
    // Debug & Updates
    debug_log_enabled: false,
    prerelease_updates: false,
    
    // UI State & Layout (stored per-profile)
    holding_tank_mode: 'storage',
    
    // Metadata
    created_at: Date.now(),
    last_used: Date.now()
  };
}

/**
 * Load profile registry
 * @returns {Object} Profile registry data
 */
function loadProfileRegistry() {
  try {
    const registryPath = getProfileRegistryPath();
    
    if (!fs.existsSync(registryPath)) {
      // Create default registry with "Default User" profile
      const defaultRegistry = {
        profiles: {
          'Default User': {
            name: 'Default User',
            description: 'Default profile',
            created_at: Date.now(),
            last_used: Date.now()
          }
        },
        metadata: {
          version: '1.0.0',
          created_at: Date.now()
        }
      };
      
      // Save default registry
      fs.writeFileSync(registryPath, JSON.stringify(defaultRegistry, null, 2));
      debugLog?.info('Created default profile registry', { 
        module: 'profile-manager',
        function: 'loadProfileRegistry' 
      });
      
      return defaultRegistry;
    }
    
    const data = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    debugLog?.error('Failed to load profile registry', { 
      module: 'profile-manager', 
      function: 'loadProfileRegistry',
      error: error.message 
    });
    return {
      profiles: {
        'Default User': {
          name: 'Default User',
          description: 'Default profile',
          created_at: Date.now(),
          last_used: Date.now()
        }
      },
      metadata: { version: '1.0.0', created_at: Date.now() }
    };
  }
}

/**
 * Save profile registry
 * @param {Object} registry - Profile registry data
 * @returns {boolean} Success status
 */
function saveProfileRegistry(registry) {
  try {
    const registryPath = getProfileRegistryPath();
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    
    debugLog?.info('Profile registry saved', { 
      module: 'profile-manager', 
      function: 'saveProfileRegistry',
      profileCount: Object.keys(registry.profiles).length 
    });
    
    return true;
  } catch (error) {
    debugLog?.error('Failed to save profile registry', { 
      module: 'profile-manager', 
      function: 'saveProfileRegistry',
      error: error.message 
    });
    return false;
  }
}

/**
 * Get all available profiles
 * @returns {Array} Array of profile objects
 */
function getAvailableProfiles() {
  try {
    const registry = loadProfileRegistry();
    return Object.values(registry.profiles);
  } catch (error) {
    debugLog?.error('Failed to get available profiles', { 
      module: 'profile-manager', 
      function: 'getAvailableProfiles',
      error: error.message 
    });
    return [];
  }
}

/**
 * Check if profile exists
 * @param {string} profileName - Profile name to check
 * @returns {boolean} Whether profile exists
 */
function profileExists(profileName) {
  try {
    const registry = loadProfileRegistry();
    return profileName in registry.profiles;
  } catch (error) {
    debugLog?.error('Failed to check profile existence', { 
      module: 'profile-manager', 
      function: 'profileExists',
      profileName,
      error: error.message 
    });
    return false;
  }
}

/**
 * Validate profile name
 * @param {string} name - Profile name to validate
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
function validateProfileName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Profile name is required' };
  }
  
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { valid: false, error: 'Profile name cannot be empty' };
  }
  
  if (trimmedName.length > 50) {
    return { valid: false, error: 'Profile name cannot exceed 50 characters' };
  }
  
  // Check for case-insensitive uniqueness
  const profiles = getAvailableProfiles();
  const existingProfile = profiles.find(p => 
    p.name.toLowerCase() === trimmedName.toLowerCase()
  );
  
  if (existingProfile) {
    return { valid: false, error: 'Profile name already exists' };
  }
  
  return { valid: true };
}

/**
 * Create a new profile
 * @param {string} profileName - Name for the new profile
 * @param {string} description - Optional description
 * @returns {Object} Result { success: boolean, error?: string }
 */
function createProfile(profileName, description = '') {
  try {
    // Validate profile name
    const validation = validateProfileName(profileName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Load registry
    const registry = loadProfileRegistry();
    
    // Create profile directory
    const profileDir = path.join(getProfilesDirectory(), sanitizeProfileName(profileName));
    
    debugLog?.info('Creating new profile', { 
      module: 'profile-manager', 
      function: 'createProfile',
      profileName,
      profileDir,
      sanitizedName: sanitizeProfileName(profileName),
      dirExistsBefore: fs.existsSync(profileDir)
    });
    
    // Check if directory already exists (shouldn't happen but log it)
    if (fs.existsSync(profileDir)) {
      const existingContents = fs.readdirSync(profileDir);
      debugLog?.warn('Profile directory already exists when creating new profile', { 
        module: 'profile-manager', 
        function: 'createProfile',
        profileName,
        profileDir,
        existingContents
      });
      
      // Delete the existing directory to ensure clean slate
      fs.rmSync(profileDir, { recursive: true, force: true });
      debugLog?.info('Removed existing profile directory', { 
        module: 'profile-manager', 
        function: 'createProfile',
        profileDir
      });
    }
    
    // Create fresh profile directory
    fs.mkdirSync(profileDir, { recursive: true });
    
    // Create profile preferences with defaults
    const preferences = getDefaultPreferences();
    
    // Save profile preferences
    const preferencesPath = getProfilePreferencesPath(profileName);
    fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
    
    debugLog?.info('Profile preferences file created', { 
      module: 'profile-manager', 
      function: 'createProfile',
      preferencesPath
    });
    
    // Add to registry
    registry.profiles[profileName] = {
      name: profileName,
      description: description,
      created_at: Date.now(),
      last_used: Date.now()
    };
    
    // Save registry
    saveProfileRegistry(registry);
    
    // Verify final state
    const finalContents = fs.readdirSync(profileDir);
    debugLog?.info('Profile created successfully', { 
      module: 'profile-manager', 
      function: 'createProfile',
      profileName,
      profileDir,
      finalContents
    });
    
    return { success: true };
  } catch (error) {
    debugLog?.error('Failed to create profile', { 
      module: 'profile-manager', 
      function: 'createProfile',
      profileName,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

/**
 * Update profile last used timestamp
 * @param {string} profileName - Profile name
 * @returns {boolean} Success status
 */
function updateProfileLastUsed(profileName) {
  try {
    const registry = loadProfileRegistry();
    
    if (registry.profiles[profileName]) {
      registry.profiles[profileName].last_used = Date.now();
      saveProfileRegistry(registry);
    }
    
    return true;
  } catch (error) {
    debugLog?.error('Failed to update profile last used', { 
      module: 'profile-manager', 
      function: 'updateProfileLastUsed',
      profileName,
      error: error.message 
    });
    return false;
  }
}

/**
 * Delete a profile
 * @param {string} profileName - Profile name to delete
 * @returns {Object} Result { success: boolean, error?: string }
 */
function deleteProfile(profileName) {
  try {
    // Prevent deletion of Default User
    if (profileName === 'Default User') {
      return { success: false, error: 'Cannot delete Default User profile' };
    }
    
    // Check if profile exists
    if (!profileExists(profileName)) {
      return { success: false, error: 'Profile does not exist' };
    }
    
    // Get available profiles to ensure we don't delete the last one
    const profiles = getAvailableProfiles();
    if (profiles.length <= 1) {
      return { success: false, error: 'Cannot delete the last profile' };
    }
    
    // Load registry
    const registry = loadProfileRegistry();
    
    // Remove profile directory FIRST (before updating registry)
    // This ensures we can't end up in a state where registry is updated but directory remains
    const profileDir = path.join(getProfilesDirectory(), sanitizeProfileName(profileName));
    
    debugLog?.info('Attempting to delete profile directory', { 
      module: 'profile-manager', 
      function: 'deleteProfile',
      profileName,
      profileDir,
      sanitizedName: sanitizeProfileName(profileName),
      exists: fs.existsSync(profileDir)
    });
    
    if (fs.existsSync(profileDir)) {
      // List contents before deletion for debugging
      const contents = fs.readdirSync(profileDir);
      debugLog?.info('Profile directory contents before deletion', { 
        module: 'profile-manager', 
        function: 'deleteProfile',
        profileDir,
        contents
      });
      
      fs.rmSync(profileDir, { recursive: true, force: true });
      
      // Verify deletion
      const stillExists = fs.existsSync(profileDir);
      debugLog?.info('Profile directory deletion result', { 
        module: 'profile-manager', 
        function: 'deleteProfile',
        profileDir,
        stillExists
      });
      
      if (stillExists) {
        throw new Error(`Failed to delete profile directory: ${profileDir}`);
      }
    } else {
      debugLog?.warn('Profile directory does not exist, skipping filesystem deletion', { 
        module: 'profile-manager', 
        function: 'deleteProfile',
        profileDir
      });
    }
    
    // Remove from registry (only after successful directory deletion)
    delete registry.profiles[profileName];
    
    // Save registry
    saveProfileRegistry(registry);
    
    debugLog?.info('Profile deleted successfully', { 
      module: 'profile-manager', 
      function: 'deleteProfile',
      profileName,
      profileDir
    });
    
    return { success: true };
  } catch (error) {
    debugLog?.error('Failed to delete profile', { 
      module: 'profile-manager', 
      function: 'deleteProfile',
      profileName,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

/**
 * Migrate global electron-store preferences to profile preferences
 * @param {string} profileName - Profile name
 * @returns {Object} Preferences (defaults + migrated global values if available)
 */
async function migrateGlobalPreferencesToProfile(profileName) {
  const preferences = getDefaultPreferences();
  
  try {
    // Try to import electron-store to read global preferences
    const Store = (await import('electron-store')).default;
    const globalStore = new Store();
    
    // List of preferences to migrate from global store
    const prefsToMigrate = [
      'screen_mode',
      'font_size',
      'column_order',
      'fade_out_seconds',
      'debug_log_enabled',
      'prerelease_updates',
      'holding_tank_mode'
    ];
    
    let migratedCount = 0;
    
    for (const key of prefsToMigrate) {
      if (globalStore.has(key)) {
        const value = globalStore.get(key);
        preferences[key] = value;
        migratedCount++;
        
        debugLog?.info('Migrated global preference to profile', {
          module: 'profile-manager',
          function: 'migrateGlobalPreferencesToProfile',
          profileName,
          key,
          value
        });
      }
    }
    
    if (migratedCount > 0) {
      preferences._migrated = true;
      preferences._migration_date = Date.now();
      preferences._migrated_count = migratedCount;
      
      debugLog?.info('Completed preference migration', {
        module: 'profile-manager',
        function: 'migrateGlobalPreferencesToProfile',
        profileName,
        migratedCount
      });
    }
  } catch (error) {
    debugLog?.warn('Could not migrate global preferences (this is okay for new installations)', {
      module: 'profile-manager',
      function: 'migrateGlobalPreferencesToProfile',
      profileName,
      error: error.message
    });
  }
  
  return preferences;
}

/**
 * Load profile preferences
 * @param {string} profileName - Profile name
 * @returns {Object|null} Profile preferences or null if not found
 */
async function loadProfilePreferences(profileName) {
  try {
    const preferencesPath = getProfilePreferencesPath(profileName);
    
    if (!fs.existsSync(preferencesPath)) {
      // Create preferences, migrating from global store if available
      const profileDir = path.dirname(preferencesPath);
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }
      
      const preferences = await migrateGlobalPreferencesToProfile(profileName);
      fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
      
      debugLog?.info('Created preferences for profile', { 
        module: 'profile-manager', 
        function: 'loadProfilePreferences',
        profileName,
        migrated: preferences._migrated || false
      });
      
      return preferences;
    }
    
    const data = fs.readFileSync(preferencesPath, 'utf8');
    let preferences = JSON.parse(data);
    
    // Clean up deprecated keys that should be in state.json (NOT window_state - that's a valid preference now)
    delete preferences.hotkeys;
    delete preferences.holding_tank;
    
    // Unwrap any corrupted nested success objects
    for (const key of Object.keys(preferences)) {
      preferences[key] = unwrapValue(preferences[key]);
    }
    
    return preferences;
  } catch (error) {
    debugLog?.error('Failed to load profile preferences', { 
      module: 'profile-manager', 
      function: 'loadProfilePreferences',
      profileName,
      error: error.message 
    });
    return null;
  }
}

/**
 * Unwrap nested {success: true, value: ...} objects
 * @param {any} value - Value to unwrap
 * @returns {any} Unwrapped value
 */
function unwrapValue(value) {
  // If value is an object with success and value properties, unwrap it recursively
  if (value && typeof value === 'object' && 'success' in value && 'value' in value) {
    return unwrapValue(value.value);
  }
  return value;
}

/**
 * Save profile preferences
 * @param {string} profileName - Profile name
 * @param {Object} preferences - Preferences to save
 * @returns {boolean} Success status
 */
async function saveProfilePreferences(profileName, preferences) {
  try {
    const preferencesPath = getProfilePreferencesPath(profileName);
    const profileDir = path.dirname(preferencesPath);
    
    // Ensure profile directory exists
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    
    fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
    
    debugLog?.info('Profile preferences saved', { 
      module: 'profile-manager', 
      function: 'saveProfilePreferences',
      profileName 
    });
    
    return true;
  } catch (error) {
    debugLog?.error('Failed to save profile preferences', { 
      module: 'profile-manager', 
      function: 'saveProfilePreferences',
      profileName,
      error: error.message 
    });
    return false;
  }
}

/**
 * Duplicate an existing profile
 */
async function duplicateProfile(sourceProfileName, targetProfileName, description) {
  try {
    // Prevent duplication of Default User
    if (sourceProfileName === 'Default User') {
      return { success: false, error: 'Cannot duplicate Default User profile' };
    }
    
    // Check if source profile exists
    if (!profileExists(sourceProfileName)) {
      return { success: false, error: 'Source profile does not exist' };
    }
    
    // Check if target profile already exists
    if (profileExists(targetProfileName)) {
      return { success: false, error: 'Target profile already exists' };
    }
    
    // Validate target profile name
    const nameValidation = validateProfileName(targetProfileName);
    if (!nameValidation.valid) {
      return { success: false, error: nameValidation.error };
    }
    
    // Get profiles directory
    const profilesDir = getProfilesDirectory();
    const sourceDir = path.join(profilesDir, sanitizeProfileName(sourceProfileName));
    const targetDir = path.join(profilesDir, sanitizeProfileName(targetProfileName));
    
    debugLog?.info('Profile directory paths', { 
      module: 'profile-manager', 
      function: 'duplicateProfile',
      profilesDir,
      sourceDir,
      targetDir 
    });
    
    // Check if source directory exists
    if (!fs.existsSync(sourceDir)) {
      debugLog?.error('Source directory does not exist', { 
        module: 'profile-manager', 
        function: 'duplicateProfile',
        sourceDir 
      });
      return { success: false, error: 'Source profile directory not found' };
    }
    
    // Create target directory
    debugLog?.info('Creating target directory', { 
      module: 'profile-manager', 
      function: 'duplicateProfile',
      targetDir 
    });
    fs.mkdirSync(targetDir, { recursive: true });
    
    // Copy all files from source to target directory using a more robust method
    const copyDirectoryRecursive = async (src, dest) => {
      try {
        debugLog?.info('Copying directory', { 
          module: 'profile-manager', 
          function: 'copyDirectoryRecursive',
          src,
          dest 
        });
        
        // Ensure destination directory exists
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        
        const entries = await promisify(fs.readdir)(src, { withFileTypes: true });
        
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          
          debugLog?.info('Copying entry', { 
            module: 'profile-manager', 
            function: 'copyDirectoryRecursive',
            entryName: entry.name,
            isDirectory: entry.isDirectory(),
            srcPath,
            destPath 
          });
          
          if (entry.isDirectory()) {
            await copyDirectoryRecursive(srcPath, destPath);
          } else {
            await promisify(fs.copyFile)(srcPath, destPath);
          }
        }
      } catch (error) {
        debugLog?.error('Error in copyDirectoryRecursive', { 
          module: 'profile-manager', 
          function: 'copyDirectoryRecursive',
          src,
          dest,
          error: error.message 
        });
        throw error;
      }
    };
    
    await copyDirectoryRecursive(sourceDir, targetDir);
    
    // Load registry
    debugLog?.info('Loading profile registry', { 
      module: 'profile-manager', 
      function: 'duplicateProfile' 
    });
    const registry = loadProfileRegistry();
    
    // Add new profile to registry
    debugLog?.info('Adding profile to registry', { 
      module: 'profile-manager', 
      function: 'duplicateProfile',
      targetProfileName 
    });
    registry.profiles[targetProfileName] = {
      name: targetProfileName,
      description: description || `Copy of ${sourceProfileName}`,
      created: Date.now(),
      last_used: Date.now()
    };
    
    // Save registry
    debugLog?.info('Saving profile registry', { 
      module: 'profile-manager', 
      function: 'duplicateProfile' 
    });
    saveProfileRegistry(registry);
    
    debugLog?.info('Profile duplicated successfully', { 
      module: 'profile-manager', 
      function: 'duplicateProfile',
      sourceProfileName,
      targetProfileName 
    });
    
    return { success: true };
  } catch (error) {
    debugLog?.error('Failed to duplicate profile', { 
      module: 'profile-manager', 
      function: 'duplicateProfile',
      sourceProfileName,
      targetProfileName,
      error: error.message 
    });
    return { success: false, error: error.message };
  }
}

export {
  initializeProfileManager,
  getAvailableProfiles,
  profileExists,
  validateProfileName,
  createProfile,
  updateProfileLastUsed,
  duplicateProfile,
  deleteProfile,
  loadProfilePreferences,
  saveProfilePreferences,
  getDefaultPreferences,
  getProfilesDirectory,
  sanitizeProfileName
};

