let moduleRegistry = {};

/**
 * Show the new profile creation modal
 */
function showNewProfileModal() {
  // Clear any previous form data
  document.getElementById('newProfileName').value = '';
  document.getElementById('newProfileDescription').value = '';
  
  // Show the modal
  const modal = new bootstrap.Modal(document.getElementById('newProfileModal'));
  modal.show();
  
  // Focus the name input after modal is shown
  document.getElementById('newProfileModal').addEventListener('shown.bs.modal', function () {
    document.getElementById('newProfileName').focus();
  }, { once: true });
}

/**
 * Handle new profile form submission
 */
async function handleNewProfileSubmit() {
  const nameInput = document.getElementById('newProfileName');
  const descInput = document.getElementById('newProfileDescription');
  
  const name = nameInput.value.trim();
  const description = descInput.value.trim();
  
  // Validate profile name
  if (!name) {
    alert('Profile name is required');
    nameInput.focus();
    return;
  }
  
  // Check for invalid characters (basic validation)
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    alert('Profile name can only contain letters, numbers, spaces, hyphens, and underscores');
    nameInput.focus();
    return;
  }
  
  try {
    // Create the profile
    const result = await window.secureElectronAPI.profile.createProfile(name, description);
    
    if (result.success) {
      // Close the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('newProfileModal'));
      modal.hide();
      
      // Save current state before switching to new profile
      window.logInfo('💾 Saving current profile state before switching to new profile...');
      if (moduleRegistry.profileState && moduleRegistry.profileState.extractProfileState) {
        try {
          const state = moduleRegistry.profileState.extractProfileState();
          const saveResult = await window.secureElectronAPI.profile.saveStateBeforeSwitch(state);
          
          if (!saveResult.success) {
            window.logError('Failed to save state before switching to new profile:', saveResult.error);
          } else {
            window.logInfo('✅ State saved successfully before switching to new profile');
          }
        } catch (stateError) {
          window.logError('Error saving state before switching to new profile:', stateError);
        }
      }
      
      // Switch directly to the newly created profile
      try {
        const switchResult = await window.secureElectronAPI.profile.switchToProfile(name);
        if (!switchResult.success) {
          window.logError('Failed to switch to new profile:', switchResult.error);
          // Fallback: just refresh the indicator
          await refreshProfileIndicator();
        }
      } catch (switchError) {
        window.logError('Error switching to new profile:', switchError);
        // Fallback: just refresh the indicator
        await refreshProfileIndicator();
      }
    } else {
      alert(`Failed to create profile: ${result.error}`);
    }
  } catch (error) {
    window.logError('Error creating new profile:', error);
    alert(`Error creating profile: ${error.message}`);
  }
}

/**
 * Show the duplicate profile modal
 */
async function showDuplicateProfileModal() {
  try {
    // Get current profile name
    const currentProfile = await window.secureElectronAPI.profile.getCurrent();
    if (!currentProfile.success) {
      alert('Could not determine current profile');
      return;
    }
    
    // Store the current profile name for use in duplication
    window.currentProfileForDuplication = currentProfile.profile;
    
    // Clear target fields
    document.getElementById('duplicateTargetName').value = '';
    document.getElementById('duplicateTargetDescription').value = '';
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('duplicateProfileModal'));
    modal.show();
    
    // Focus the target name input after modal is shown
    document.getElementById('duplicateProfileModal').addEventListener('shown.bs.modal', function () {
      document.getElementById('duplicateTargetName').focus();
    }, { once: true });
  } catch (error) {
    window.logError('Error showing duplicate profile modal:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Handle duplicate profile form submission
 */
async function handleDuplicateProfileSubmit() {
  const targetNameInput = document.getElementById('duplicateTargetName');
  const targetDescInput = document.getElementById('duplicateTargetDescription');
  
  const sourceName = window.currentProfileForDuplication;
  const targetName = targetNameInput.value.trim();
  const targetDescription = targetDescInput.value.trim();
  
  // Validate source profile exists
  if (!sourceName) {
    alert('Could not determine source profile');
    return;
  }
  
  // Validate target profile name
  if (!targetName) {
    alert('New profile name is required');
    targetNameInput.focus();
    return;
  }
  
  // Check for invalid characters (basic validation)
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(targetName)) {
    alert('Profile name can only contain letters, numbers, spaces, hyphens, and underscores');
    targetNameInput.focus();
    return;
  }
  
  // Check if trying to duplicate to same name
  if (sourceName === targetName) {
    alert('New profile name must be different from the source profile');
    targetNameInput.focus();
    return;
  }
  
  try {
    // Duplicate the profile
    const result = await window.secureElectronAPI.profile.duplicateProfile(sourceName, targetName, targetDescription);
    
    if (result && result.success) {
      // Close the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('duplicateProfileModal'));
      modal.hide();
      
      // Save current state before switching to duplicated profile
      window.logInfo('💾 Saving current profile state before switching to duplicated profile...');
      if (moduleRegistry.profileState && moduleRegistry.profileState.extractProfileState) {
        try {
          const state = moduleRegistry.profileState.extractProfileState();
          const saveResult = await window.secureElectronAPI.profile.saveStateBeforeSwitch(state);
          
          if (!saveResult.success) {
            window.logError('Failed to save state before switching to duplicated profile:', saveResult.error);
          } else {
            window.logInfo('✅ State saved successfully before switching to duplicated profile');
          }
        } catch (stateError) {
          window.logError('Error saving state before switching to duplicated profile:', stateError);
        }
      }
      
      // Switch directly to the newly duplicated profile
      try {
        const switchResult = await window.secureElectronAPI.profile.switchToProfile(targetName);
        if (!switchResult.success) {
          window.logError('Failed to switch to duplicated profile:', switchResult.error);
          // Fallback: just refresh the indicator
          await refreshProfileIndicator();
        }
      } catch (switchError) {
        window.logError('Error switching to duplicated profile:', switchError);
        // Fallback: just refresh the indicator
        await refreshProfileIndicator();
      }
    } else {
      const errorMessage = result?.error || 'Unknown error occurred';
      alert(`Failed to duplicate profile: ${errorMessage}`);
    }
  } catch (error) {
    window.logError('Error duplicating profile:', error);
    alert(`Error duplicating profile: ${error.message}`);
  }
}

/**
 * Refresh the profile indicator after profile changes
 */
async function refreshProfileIndicator() {
  try {
    const result = await window.secureElectronAPI.profile.getCurrent();
    if (result.success) {
      const profileNameElement = document.getElementById('profile-name');
      if (profileNameElement) {
        profileNameElement.textContent = `Profile: ${result.profile}`;
      }
    }
  } catch (error) {
    window.logError('Failed to refresh profile indicator:', error);
  }
}

// Set up event listeners for the profile modals
function initializeProfileUI(options = {}) {
  moduleRegistry = options.moduleRegistry || {};
  document.addEventListener('DOMContentLoaded', function() {
  // New profile modal handlers
  document.getElementById('createProfileBtn').addEventListener('click', handleNewProfileSubmit);
  
  document.getElementById('newProfileName').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNewProfileSubmit();
    }
  });
  
  document.getElementById('newProfileDescription').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNewProfileSubmit();
    }
  });
  
  // Duplicate profile modal handlers
  document.getElementById('duplicateProfileBtn').addEventListener('click', handleDuplicateProfileSubmit);
  
  document.getElementById('duplicateTargetName').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDuplicateProfileSubmit();
    }
  });
  
  document.getElementById('duplicateTargetDescription').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDuplicateProfileSubmit();
    }
  });

  });
}

export {
  handleDuplicateProfileSubmit,
  handleNewProfileSubmit,
  initializeProfileUI,
  refreshProfileIndicator,
  showDuplicateProfileModal,
  showNewProfileModal
};
