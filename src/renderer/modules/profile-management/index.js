/**
 * Profile Management Module Index
 * 
 * This module serves as the main entry point for all profile management functionality
 * in the MxVoice Electron application renderer process.
 */

// Import profile management sub-modules
import profileManager from './profile-manager.js';
import profileUI from './profile-ui.js';

/**
 * Initialize the Profile Management module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Profile Management module interface
 */
function initializeProfileManagement(options = {}) {
  const electronAPISource = (typeof window !== 'undefined' && (window.electronAPI || window.secureElectronAPI)) || null;
  const electronAPI = options.electronAPI || electronAPISource;
  const { db, store } = options;
  
  // Initialize sub-modules
  const manager = profileManager({ electronAPI, db, store });
  const ui = profileUI({ electronAPI, db, store });
  
  return {
    // Profile Manager functions
    getAvailableProfiles: manager.getAvailableProfiles,
    getActiveProfile: manager.getActiveProfile,
    createProfile: manager.createProfile,
    deleteProfile: manager.deleteProfile,
    switchProfile: manager.switchProfile,
    shouldShowProfileSelection: manager.shouldShowProfileSelection,
    markProfileSelectionShown: manager.markProfileSelectionShown,
    
    // Profile UI functions
    showProfileSelectionModal: ui.showProfileSelectionModal,
    showCreateProfileModal: ui.showCreateProfileModal,
    showProfileManagementModal: ui.showProfileManagementModal,
    showEditProfileModal: ui.showEditProfileModal,
    updateProfileIndicator: ui.updateProfileIndicator,
    
    // Convenience functions for HTML onclick handlers
    switchToProfile: manager.switchProfile,
    editProfile: async (name, description) => {
      // This will be handled by the modal event handlers
      console.warn('editProfile called directly - use showEditProfileModal instead');
    },
    
    // Module info
    version: '1.0.0',
    description: 'Profile Management Module for MxVoice Application'
  };
}

// Create and export a singleton instance
// Note: This will be re-initialized with proper dependencies when the module is loaded
const profileManagementInstance = initializeProfileManagement();

// Reinitialize function for dependency injection
function reinitializeProfileManagement(options = {}) {
  const newInstance = initializeProfileManagement(options);
  
  // Update the singleton instance
  Object.assign(profileManagementInstance, newInstance);
  
  return profileManagementInstance;
}

// Export the singleton instance and reinitialize function
export default {
  ...profileManagementInstance,
  reinitializeProfileManagement
};

// Also export named functions for direct imports
export const {
  getAvailableProfiles,
  getActiveProfile,
  createProfile,
  deleteProfile,
  switchProfile,
  switchToProfile,
  editProfile,
  shouldShowProfileSelection,
  markProfileSelectionShown,
  showProfileSelectionModal,
  showCreateProfileModal,
  showProfileManagementModal,
  showEditProfileModal,
  updateProfileIndicator
} = profileManagementInstance;
