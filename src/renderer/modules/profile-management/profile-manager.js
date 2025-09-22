/**
 * Profile Manager for Renderer Process
 * 
 * Handles profile operations from the renderer process, communicating with main process
 * via IPC for profile management functionality.
 */

// Import debug logger
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Initialize the Profile Manager
 * @param {Object} options - Configuration options
 * @returns {Object} Profile Manager interface
 */
function initializeProfileManager(options = {}) {
  // Use secureElectronAPI for profile operations
  const { db, store } = options;
  
  // DebugLog is available via window.debugLog (imported above)
  
  /**
   * Get all available profiles
   * @returns {Promise<Array>} Array of profile objects
   */
  async function getAvailableProfiles() {
    try {
      if (!window.secureElectronAPI || !window.secureElectronAPI.profile) {
        throw new Error('Profile API not available');
      }
      
      const result = await window.secureElectronAPI.profile.getAvailable();
      
      if (result.success) {
        debugLog?.info('Available profiles retrieved', { 
          module: 'profile-manager', 
          function: 'getAvailableProfiles',
          count: result.profiles.length 
        });
        return result.profiles;
      } else {
        throw new Error(result.error || 'Failed to get available profiles');
      }
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
   * Get the currently active profile
   * @returns {Promise<string>} Active profile name
   */
  async function getActiveProfile() {
    try {
      if (!window.secureElectronAPI || !window.secureElectronAPI.profile) {
        throw new Error('Profile API not available');
      }
      
      const result = await window.secureElectronAPI.profile.getActive();
      
      if (result.success) {
        debugLog?.debug('Active profile retrieved', { 
          module: 'profile-manager', 
          function: 'getActiveProfile',
          profile: result.profile 
        });
        return result.profile;
      } else {
        throw new Error(result.error || 'Failed to get active profile');
      }
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
   * Create a new profile
   * @param {string} name - Profile name
   * @param {string} description - Optional description
   * @param {boolean} copyFromCurrent - Whether to copy settings from current profile
   * @returns {Promise<Object>} Result object with success status
   */
  async function createProfile(name, description = '', copyFromCurrent = true) {
    try {
      if (!window.secureElectronAPI || !window.secureElectronAPI.profile) {
        throw new Error('Profile API not available');
      }
      
      const result = await window.secureElectronAPI.profile.create(name, description, copyFromCurrent);
      
      if (result.success) {
        debugLog?.info('Profile created successfully', { 
          module: 'profile-manager', 
          function: 'createProfile',
          name,
          copyFromCurrent 
        });
      } else {
        debugLog?.error('Failed to create profile', { 
          module: 'profile-manager', 
          function: 'createProfile',
          name,
          error: result.error 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Profile creation error', { 
        module: 'profile-manager', 
        function: 'createProfile',
        name,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete a profile
   * @param {string} name - Profile name to delete
   * @returns {Promise<Object>} Result object with success status
   */
  async function deleteProfile(name) {
    try {
      if (!window.secureElectronAPI || !window.secureElectronAPI.profile) {
        throw new Error('Profile API not available');
      }
      
      const result = await window.secureElectronAPI.profile.delete(name);
      
      if (result.success) {
        debugLog?.info('Profile deleted successfully', { 
          module: 'profile-manager', 
          function: 'deleteProfile',
          name 
        });
      } else {
        debugLog?.error('Failed to delete profile', { 
          module: 'profile-manager', 
          function: 'deleteProfile',
          name,
          error: result.error 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Profile deletion error', { 
        module: 'profile-manager', 
        function: 'deleteProfile',
        name,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Switch to a different profile
   * @param {string} name - Profile name to switch to
   * @returns {Promise<Object>} Result object with success status
   */
  async function switchProfile(name) {
    try {
      if (!window.secureElectronAPI || !window.secureElectronAPI.profile) {
        throw new Error('Profile API not available');
      }
      
      const result = await window.secureElectronAPI.profile.switch(name);
      
      if (result.success) {
        debugLog?.info('Profile switched successfully', { 
          module: 'profile-manager', 
          function: 'switchProfile',
          name 
        });
      } else {
        debugLog?.error('Failed to switch profile', { 
          module: 'profile-manager', 
          function: 'switchProfile',
          name,
          error: result.error 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Profile switch error', { 
        module: 'profile-manager', 
        function: 'switchProfile',
        name,
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
      if (!window.secureElectronAPI || !window.secureElectronAPI.profile) {
        throw new Error('Profile API not available');
      }
      
      const result = await window.secureElectronAPI.profile.shouldShowSelection();
      
      if (result.success) {
        debugLog?.debug('Profile selection requirement checked', { 
          module: 'profile-manager', 
          function: 'shouldShowProfileSelection',
          shouldShow: result.shouldShow 
        });
        return result.shouldShow;
      } else {
        throw new Error(result.error || 'Failed to check profile selection requirement');
      }
    } catch (error) {
      debugLog?.error('Failed to check profile selection requirement', { 
        module: 'profile-manager', 
        function: 'shouldShowProfileSelection',
        error: error.message 
      });
      return true; // Default to showing selection on error
    }
  }
  
  /**
   * Mark profile selection as shown
   * @returns {Promise<boolean>} Success status
   */
  async function markProfileSelectionShown() {
    try {
      if (!window.secureElectronAPI || !window.secureElectronAPI.profile) {
        throw new Error('Profile API not available');
      }
      
      const result = await window.secureElectronAPI.profile.markSelectionShown();
      
      if (result.success) {
        debugLog?.debug('Profile selection marked as shown', { 
          module: 'profile-manager', 
          function: 'markProfileSelectionShown' 
        });
      }
      
      return result.success;
    } catch (error) {
      debugLog?.error('Failed to mark profile selection as shown', { 
        module: 'profile-manager', 
        function: 'markProfileSelectionShown',
        error: error.message 
      });
      return false;
    }
  }
  
  return {
    getAvailableProfiles,
    getActiveProfile,
    createProfile,
    deleteProfile,
    switchProfile,
    shouldShowProfileSelection,
    markProfileSelectionShown
  };
}

export default initializeProfileManager;
