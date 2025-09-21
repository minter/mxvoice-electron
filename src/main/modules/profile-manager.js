/**
 * Profile Manager Module
 * 
 * Handles user profile creation, management, and storage for the MxVoice application.
 * Provides profile isolation for user preferences while keeping shared database and directories.
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

// Profile system configuration
const PROFILE_SELECTION_CONFIG = {
  // Easy to change behavior
  alwaysShowSelection: false,  // Change to true to always show
  skipIfSingleProfile: true,   // Change to false to always show
  showOnFirstLaunch: true,     // Always show on first launch after feature
  showOnProfileError: true     // Show if active profile is missing
};

/**
 * Initialize the Profile Manager
 * @param {Object} dependencies - Module dependencies
 */
function initializeProfileManager(dependencies) {
  store = dependencies.store;
  debugLog = dependencies.debugLog || initializeMainDebugLog({ store });
  
  debugLog?.info('Profile Manager initialized', { 
    module: 'profile-manager', 
    function: 'initializeProfileManager' 
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
 * @param {string} name - Profile name
 * @returns {string} Sanitized name safe for filesystem
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
    fade_out_seconds: 2,
    
    // Appearance & UI
    screen_mode: 'auto',
    font_size: 11,
    browser_width: 1280,
    browser_height: 1024,
    window_state: null,
    
    // Debug & Updates
    debug_log_enabled: false,
    prerelease_updates: false,
    
    // UI State & Layout
    holding_tank_mode: 'storage',
    holding_tank: null,
    hotkeys: null,
    
    // Metadata
    created_at: Date.now(),
    last_used: Date.now()
  };
}

/**
 * Load profile registry
 * @returns {Promise<Object>} Profile registry data
 */
async function loadProfileRegistry() {
  try {
    const registryPath = getProfileRegistryPath();
    
    if (!fs.existsSync(registryPath)) {
      return { profiles: {}, metadata: { version: '1.0.0', created_at: Date.now() } };
    }
    
    const data = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    debugLog?.error('Failed to load profile registry', { 
      module: 'profile-manager', 
      function: 'loadProfileRegistry',
      error: error.message 
    });
    return { profiles: {}, metadata: { version: '1.0.0', created_at: Date.now() } };
  }
}

/**
 * Save profile registry
 * @param {Object} registry - Profile registry data
 * @returns {Promise<boolean>} Success status
 */
async function saveProfileRegistry(registry) {
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
 * @returns {Promise<Array>} Array of profile objects
 */
async function getAvailableProfiles() {
  try {
    const registry = await loadProfileRegistry();
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
 * Get active profile name
 * @returns {Promise<string>} Active profile name
 */
async function getActiveProfile() {
  try {
    const activeProfile = store.get('active_profile') || 'Default User';
    debugLog?.info('Getting active profile', { 
      module: 'profile-manager', 
      function: 'getActiveProfile',
      activeProfile,
      fromStore: store.get('active_profile'),
      fallback: !store.get('active_profile')
    });
    return activeProfile;
  } catch (error) {
    debugLog?.error('Failed to get active profile', { 
      module: 'profile-manager', 
      function: 'getActiveProfile',
      error: error.message 
    });
    return 'Default User';
  }
}

/**
 * Set active profile
 * @param {string} profileName - Profile name to set as active
 * @returns {Promise<boolean>} Success status
 */
async function setActiveProfile(profileName) {
  try {
    debugLog?.info('Setting active profile', { 
      module: 'profile-manager', 
      function: 'setActiveProfile',
      profileName,
      currentActive: store.get('active_profile')
    });
    
    store.set('active_profile', profileName);
    
    // Verify the setting was saved
    const savedProfile = store.get('active_profile');
    debugLog?.info('Active profile saved and verified', { 
      module: 'profile-manager', 
      function: 'setActiveProfile',
      profileName,
      savedProfile,
      match: savedProfile === profileName
    });
    
    // Update last_used timestamp
    await updateProfileLastUsed(profileName);
    
    debugLog?.info('Active profile set successfully', { 
      module: 'profile-manager', 
      function: 'setActiveProfile',
      profileName 
    });
    
    return true;
  } catch (error) {
    debugLog?.error('Failed to set active profile', { 
      module: 'profile-manager', 
      function: 'setActiveProfile',
      profileName,
      error: error.message 
    });
    return false;
  }
}

/**
 * Check if profile exists
 * @param {string} profileName - Profile name to check
 * @returns {Promise<boolean>} Whether profile exists
 */
async function profileExists(profileName) {
  try {
    const registry = await loadProfileRegistry();
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
 * @returns {Promise<Object>} Validation result { valid: boolean, error?: string }
 */
async function validateProfileName(name) {
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
  const profiles = await getAvailableProfiles();
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
 * @param {boolean} copyFromCurrent - Whether to copy settings from current profile
 * @returns {Promise<Object>} Result { success: boolean, error?: string }
 */
async function createProfile(profileName, description = '', copyFromCurrent = true) {
  try {
    // Validate profile name
    const validation = await validateProfileName(profileName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Load registry
    const registry = await loadProfileRegistry();
    
    // Create profile directory
    const profileDir = path.join(getProfilesDirectory(), sanitizeProfileName(profileName));
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    
    // Create profile preferences
    let preferences = getDefaultPreferences();
    
    if (copyFromCurrent) {
      const currentProfile = await getActiveProfile();
      const currentPreferences = await loadProfilePreferences(currentProfile);
      if (currentPreferences) {
        preferences = { ...preferences, ...currentPreferences };
        // Reset metadata
        preferences.created_at = Date.now();
        preferences.last_used = Date.now();
      }
    }
    
    // Save profile preferences
    const preferencesPath = getProfilePreferencesPath(profileName);
    fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
    
    // Add to registry
    registry.profiles[profileName] = {
      name: profileName,
      description: description,
      created_at: Date.now(),
      last_used: Date.now()
    };
    
    // Save registry
    await saveProfileRegistry(registry);
    
    debugLog?.info('Profile created', { 
      module: 'profile-manager', 
      function: 'createProfile',
      profileName,
      copyFromCurrent 
    });
    
    return { success: true };
  } catch (error) {
    debugLog?.error('Failed to create profile', { 
      module: 'profile-manager', 
      function: 'createProfile',
      profileName,
      error: error.message 
    });
    return { success: false, error: error.message };
  }
}

/**
 * Load profile preferences
 * @param {string} profileName - Profile name
 * @returns {Promise<Object|null>} Profile preferences or null if not found
 */
async function loadProfilePreferences(profileName) {
  try {
    const preferencesPath = getProfilePreferencesPath(profileName);
    
    if (!fs.existsSync(preferencesPath)) {
      debugLog?.warn('Profile preferences not found', { 
        module: 'profile-manager', 
        function: 'loadProfilePreferences',
        profileName 
      });
      return null;
    }
    
    const data = fs.readFileSync(preferencesPath, 'utf8');
    return JSON.parse(data);
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
 * Save profile preferences
 * @param {string} profileName - Profile name
 * @param {Object} preferences - Preferences to save
 * @returns {Promise<boolean>} Success status
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
 * Update profile last used timestamp
 * @param {string} profileName - Profile name
 * @returns {Promise<boolean>} Success status
 */
async function updateProfileLastUsed(profileName) {
  try {
    const registry = await loadProfileRegistry();
    
    if (registry.profiles[profileName]) {
      registry.profiles[profileName].last_used = Date.now();
      await saveProfileRegistry(registry);
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
 * @returns {Promise<Object>} Result { success: boolean, error?: string }
 */
async function deleteProfile(profileName) {
  try {
    // Prevent deletion of Default User
    if (profileName === 'Default User') {
      return { success: false, error: 'Cannot delete Default User profile' };
    }
    
    // Check if profile exists
    if (!await profileExists(profileName)) {
      return { success: false, error: 'Profile does not exist' };
    }
    
    // Get available profiles to ensure we don't delete the last one
    const profiles = await getAvailableProfiles();
    if (profiles.length <= 1) {
      return { success: false, error: 'Cannot delete the last profile' };
    }
    
    // Load registry
    const registry = await loadProfileRegistry();
    
    // Remove from registry
    delete registry.profiles[profileName];
    
    // Save registry
    await saveProfileRegistry(registry);
    
    // Remove profile directory
    const profileDir = path.join(getProfilesDirectory(), sanitizeProfileName(profileName));
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
    
    // If this was the active profile, switch to Default User
    const activeProfile = await getActiveProfile();
    if (activeProfile === profileName) {
      await setActiveProfile('Default User');
    }
    
    debugLog?.info('Profile deleted', { 
      module: 'profile-manager', 
      function: 'deleteProfile',
      profileName 
    });
    
    return { success: true };
  } catch (error) {
    debugLog?.error('Failed to delete profile', { 
      module: 'profile-manager', 
      function: 'deleteProfile',
      profileName,
      error: error.message 
    });
    return { success: false, error: error.message };
  }
}

/**
 * Check if profile selection should be shown
 * @returns {Promise<boolean>} Whether to show profile selection
 */
async function shouldShowProfileSelection() {
  try {
    const profiles = await getAvailableProfiles();
    const activeProfile = await getActiveProfile();
    
    debugLog?.info('Checking profile selection requirements', {
      module: 'profile-manager',
      function: 'shouldShowProfileSelection',
      profileCount: profiles.length,
      activeProfile: activeProfile,
      hasShownSelection: hasShownProfileSelection(),
      config: PROFILE_SELECTION_CONFIG
    });
    
    // Always show on first launch after feature
    if (PROFILE_SELECTION_CONFIG.showOnFirstLaunch && !hasShownProfileSelection()) {
      debugLog?.info('Showing profile selection - first launch', {
        module: 'profile-manager',
        function: 'shouldShowProfileSelection'
      });
      return true;
    }
    
    // Always show if configured
    if (PROFILE_SELECTION_CONFIG.alwaysShowSelection) {
      debugLog?.info('Showing profile selection - always show configured', {
        module: 'profile-manager',
        function: 'shouldShowProfileSelection'
      });
      return true;
    }
    
    // Show if active profile is missing/corrupted
    if (PROFILE_SELECTION_CONFIG.showOnProfileError && !await profileExists(activeProfile)) {
      debugLog?.info('Showing profile selection - profile error', {
        module: 'profile-manager',
        function: 'shouldShowProfileSelection',
        activeProfile: activeProfile
      });
      return true;
    }
    
    // Skip if single profile and configured to skip
    if (profiles.length === 1 && PROFILE_SELECTION_CONFIG.skipIfSingleProfile) {
      debugLog?.info('Skipping profile selection - single profile, configured to skip', {
        module: 'profile-manager',
        function: 'shouldShowProfileSelection',
        profileCount: profiles.length
      });
      return false;
    }
    
    // Show if multiple profiles exist (this is the main condition)
    if (profiles.length > 1) {
      debugLog?.info('Showing profile selection - multiple profiles exist', {
        module: 'profile-manager',
        function: 'shouldShowProfileSelection',
        profileCount: profiles.length
      });
      return true;
    }
    
    debugLog?.info('No profile selection needed', {
      module: 'profile-manager',
      function: 'shouldShowProfileSelection',
      profileCount: profiles.length
    });
    
    return false;
  } catch (error) {
    debugLog?.error('Failed to determine profile selection requirement', { 
      module: 'profile-manager', 
      function: 'shouldShowProfileSelection',
      error: error.message 
    });
    return true; // Default to showing selection on error
  }
}

/**
 * Check if profile selection has been shown before
 * @returns {boolean} Whether profile selection has been shown
 */
function hasShownProfileSelection() {
  try {
    return store.get('profile_selection_shown') || false;
  } catch (error) {
    return false;
  }
}

/**
 * Mark profile selection as shown
 * @returns {boolean} Success status
 */
function markProfileSelectionShown() {
  try {
    store.set('profile_selection_shown', true);
    return true;
  } catch (error) {
    return false;
  }
}

export {
  initializeProfileManager,
  getAvailableProfiles,
  getActiveProfile,
  setActiveProfile,
  profileExists,
  validateProfileName,
  createProfile,
  loadProfilePreferences,
  saveProfilePreferences,
  deleteProfile,
  shouldShowProfileSelection,
  hasShownProfileSelection,
  markProfileSelectionShown,
  getDefaultPreferences
};
