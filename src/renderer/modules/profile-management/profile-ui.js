/**
 * Profile UI Component for Renderer Process
 * 
 * Handles all profile-related UI interactions using static modals with proper theming support.
 */

// Import debug logger and Bootstrap adapter
let debugLog = null;
let bootstrapAdapter = null;

try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Initialize the Profile UI component
 * @param {Object} options - Configuration options
 * @returns {Object} Profile UI interface
 */
function initializeProfileUI(options = {}) {
  const { db, store } = options;
  
  // Import bootstrap adapter
  import('../ui/bootstrap-adapter.js')
    .then(module => {
      bootstrapAdapter = module.default;
    })
    .catch(error => {
      debugLog?.error('Failed to import bootstrap adapter', { 
        module: 'profile-ui', 
        function: 'initializeProfileUI',
        error: error.message 
      });
    });

  /**
   * Show profile selection modal
   * @param {Object} options - Modal options
   * @param {boolean} options.showCreateOption - Whether to show create profile option
   * @param {boolean} options.showCancelOption - Whether to show cancel option
   * @param {string} options.title - Modal title
   * @returns {Promise<string|null>} Selected profile name or null if cancelled
   */
  async function showProfileSelectionModal(options = {}) {
    try {
      const {
        showCreateOption = true,
        showCancelOption = false,
        title = 'Select Profile'
      } = options;
      
      debugLog?.info('Showing profile selection modal', { 
        module: 'profile-ui', 
        function: 'showProfileSelectionModal',
        options 
      });
      
      // Get available profiles
      const profiles = await window.secureElectronAPI.profile.getAvailable();
      
      if (!profiles.success) {
        throw new Error(profiles.error || 'Failed to get available profiles');
      }
      
      // Set up the modal
      const modal = document.getElementById('profileSelectionModal');
      const modalTitle = document.getElementById('profileSelectionModalTitle');
      const profileList = document.getElementById('profileSelectionList');
      const createBtn = document.getElementById('createNewProfileBtn');
      const cancelBtn = document.getElementById('profileSelectionCancelBtn');
      const closeBtn = document.getElementById('profileSelectionModalClose');
      
      if (!modal || !modalTitle || !profileList) {
        throw new Error('Profile selection modal elements not found');
      }
      
      // Set title
      modalTitle.textContent = title;
      
      // Show/hide optional elements
      createBtn.style.display = showCreateOption ? 'inline-block' : 'none';
      cancelBtn.classList.toggle('d-none', !showCancelOption);
      closeBtn.classList.toggle('d-none', !showCancelOption);
      
      // Populate profile list
      populateProfileSelectionList(profileList, profiles.profiles);
      
      // Set up event handlers and show modal
      const selectedProfile = await showProfileSelectionModalAndWait(modal);
      
      debugLog?.info('Profile selection completed', { 
        module: 'profile-ui', 
        function: 'showProfileSelectionModal',
        selectedProfile 
      });
      
      return selectedProfile;
    } catch (error) {
      debugLog?.error('Failed to show profile selection modal', { 
        module: 'profile-ui', 
        function: 'showProfileSelectionModal',
        error: error.message 
      });
      return null;
    }
  }
  
  /**
   * Show create profile modal
   * @returns {Promise<Object|null>} Created profile info or null if cancelled
   */
  async function showCreateProfileModal() {
    try {
      debugLog?.info('Showing create profile modal', { 
        module: 'profile-ui', 
        function: 'showCreateProfileModal' 
      });
      
      const modal = document.getElementById('createProfileModal');
      const nameInput = document.getElementById('createProfileName');
      const descInput = document.getElementById('createProfileDescription');
      const copySettingsInput = document.getElementById('copyCurrentSettings');
      
      if (!modal || !nameInput || !descInput || !copySettingsInput) {
        throw new Error('Create profile modal elements not found');
      }
      
      // Reset form
      nameInput.value = '';
      descInput.value = '';
      copySettingsInput.checked = true;
      
      // Show modal and wait for result
      const result = await showCreateProfileModalAndWait(modal);
      
      if (result) {
        debugLog?.info('Profile creation completed', { 
          module: 'profile-ui', 
          function: 'showCreateProfileModal',
          profileName: result.name 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Failed to show create profile modal', { 
        module: 'profile-ui', 
        function: 'showCreateProfileModal',
        error: error.message 
      });
      return null;
    }
  }
  
  /**
   * Show profile management modal
   * @returns {Promise<boolean>} Whether any changes were made
   */
  async function showProfileManagementModal() {
    try {
      debugLog?.info('Showing profile management modal', { 
        module: 'profile-ui', 
        function: 'showProfileManagementModal' 
      });
      
      // Get available profiles and active profile
      const [profilesResult, activeProfileResult] = await Promise.all([
        window.secureElectronAPI.profile.getAvailable(),
        window.secureElectronAPI.profile.getActive()
      ]);
      
      if (!profilesResult.success) {
        throw new Error(profilesResult.error || 'Failed to get available profiles');
      }
      
      if (!activeProfileResult.success) {
        throw new Error(activeProfileResult.error || 'Failed to get active profile');
      }
      
      const activeProfileName = activeProfileResult.profile?.name || 'Default User';
      const modal = document.getElementById('profileManagementModal');
      const profileList = document.getElementById('profileManagementList');
      
      if (!modal || !profileList) {
        throw new Error('Profile management modal elements not found');
      }
      
      // Populate profile management list
      populateProfileManagementList(profileList, profilesResult.profiles, activeProfileName);
      
      // Show modal and wait for result
      const changesMade = await showProfileManagementModalAndWait(modal);
      
      debugLog?.info('Profile management completed', { 
        module: 'profile-ui', 
        function: 'showProfileManagementModal',
        changesMade 
      });
      
      return changesMade;
    } catch (error) {
      debugLog?.error('Failed to show profile management modal', { 
        module: 'profile-ui', 
        function: 'showProfileManagementModal',
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * Show edit profile modal
   * @param {string} currentName - Current profile name
   * @param {string} currentDescription - Current profile description
   * @returns {Promise<Object|null>} Updated profile info or null if cancelled
   */
  async function showEditProfileModal(currentName, currentDescription) {
    try {
      debugLog?.info('Showing edit profile modal', { 
        module: 'profile-ui', 
        function: 'showEditProfileModal',
        currentName,
        currentDescription 
      });
      
      const modal = document.getElementById('editProfileModal');
      const originalNameInput = document.getElementById('editProfileOriginalName');
      const nameInput = document.getElementById('editProfileName');
      const descInput = document.getElementById('editProfileDescription');
      
      if (!modal || !originalNameInput || !nameInput || !descInput) {
        throw new Error('Edit profile modal elements not found');
      }
      
      // Set current values
      originalNameInput.value = currentName;
      nameInput.value = currentName;
      descInput.value = currentDescription || '';
      
      // Show modal and wait for result
      const result = await showEditProfileModalAndWait(modal);
      
      if (result) {
        debugLog?.info('Profile edit completed', { 
          module: 'profile-ui', 
          function: 'showEditProfileModal',
          profileName: result.name 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Failed to show edit profile modal', { 
        module: 'profile-ui', 
        function: 'showEditProfileModal',
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Update the profile indicator in the UI
   * @param {string} profileName - Current profile name
   */
  function updateProfileIndicator(profileName) {
    try {
      const indicator = document.getElementById('profile-indicator');
      if (indicator) {
        indicator.setAttribute('data-bs-original-title', `Current Profile: ${profileName}`);
        indicator.title = `Current Profile: ${profileName}`;
        
        debugLog?.debug('Profile indicator updated', { 
          module: 'profile-ui', 
          function: 'updateProfileIndicator',
          profileName 
        });
      }
    } catch (error) {
      debugLog?.error('Failed to update profile indicator', { 
        module: 'profile-ui', 
        function: 'updateProfileIndicator',
        profileName,
        error: error.message 
      });
    }
  }
  
  /**
   * Populate profile selection list
   * @param {HTMLElement} container - Container element
   * @param {Array} profiles - Available profiles
   */
  function populateProfileSelectionList(container, profiles) {
    container.innerHTML = '';
    
    profiles.forEach((profile, index) => {
      const isDefault = profile.name === 'Default User';
      const isSelected = index === 0; // First profile is selected by default
      
      const cardHtml = `
        <div class="card mb-3 profile-selection-card ${isSelected ? 'selected' : ''}" data-profile-name="${profile.name}">
          <div class="card-body">
            <div class="d-flex align-items-start">
              <div class="form-check me-3 mt-1">
                <input class="form-check-input" type="radio" name="profileSelection" id="profile-${index}" value="${profile.name}" ${isSelected ? 'checked' : ''}>
              </div>
              <div class="flex-grow-1">
                <h6 class="card-title">${profile.name}</h6>
                ${profile.description ? `<p class="card-text small mb-1">${profile.description}</p>` : ''}
                ${isDefault ? '<small class="profile-protected-indicator">Protected profile</small>' : ''}
              </div>
            </div>
          </div>
        </div>
      `;
      
      container.insertAdjacentHTML('beforeend', cardHtml);
    });
    
    // Add click handlers for cards
    const cards = container.querySelectorAll('.profile-selection-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking on the radio button itself
        if (e.target.type === 'radio') return;
        
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          
          // Update visual selection
          cards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      });
    });
  }
  
  /**
   * Populate profile management list
   * @param {HTMLElement} container - Container element
   * @param {Array} profiles - Available profiles
   * @param {string} activeProfileName - Name of active profile
   */
  function populateProfileManagementList(container, profiles, activeProfileName) {
    container.innerHTML = '';
    
    profiles.forEach(profile => {
      const isDefault = profile.name === 'Default User';
      const isActive = profile.name === activeProfileName;
      const createdDate = new Date(profile.created_at).toLocaleDateString();
      const lastUsedDate = new Date(profile.last_used).toLocaleDateString();
      
      const cardHtml = `
        <div class="card mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div class="flex-grow-1">
                <h6 class="card-title mb-1 d-flex align-items-center">
                  ${profile.name}
                  ${isActive ? '<span class="badge bg-success ms-2">Active</span>' : ''}
                </h6>
                ${profile.description ? `<p class="card-text small mb-1">${profile.description}</p>` : ''}
                <small class="text-muted">Created: ${createdDate} | Last used: ${lastUsedDate}</small>
                ${isDefault ? '<br><small class="profile-protected-indicator">Protected profile</small>' : ''}
              </div>
              <div class="ms-4">
                ${!isActive ? `
                  <button type="button" class="btn btn-outline-primary btn-sm me-2" data-action="switch" data-profile="${profile.name}">
                    <i class="fas fa-user-check me-1"></i>Use
                  </button>
                ` : ''}
                ${!isDefault ? `
                  <button type="button" class="btn btn-outline-secondary btn-sm me-2" data-action="edit" data-profile="${profile.name}" data-description="${profile.description || ''}">
                    <i class="fas fa-edit me-1"></i>Edit
                  </button>
                  <button type="button" class="btn btn-outline-danger btn-sm" data-action="delete" data-profile="${profile.name}">
                    <i class="fas fa-trash me-1"></i>Delete
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
      
      container.insertAdjacentHTML('beforeend', cardHtml);
    });
  }
  
  /**
   * Show profile selection modal and wait for user interaction
   * @param {HTMLElement} modal - Modal element
   * @returns {Promise<string|null>} Selected profile name
   */
  function showProfileSelectionModalAndWait(modal) {
    return new Promise((resolve) => {
      const modalInstance = new bootstrap.Modal(modal);
      const selectBtn = document.getElementById('selectProfileBtn');
      const createBtn = document.getElementById('createNewProfileBtn');
      const cancelBtn = document.getElementById('profileSelectionCancelBtn');
      
      let hasResolved = false;
      
      const cleanup = () => {
        if (hasResolved) return;
        hasResolved = true;
        // Blur any focused element to prevent accessibility warnings
        if (document.activeElement && modal.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        modalInstance.hide();
      };
      
      const safeResolve = (value) => {
        if (hasResolved) return;
        cleanup();
        resolve(value);
      };
      
      selectBtn?.addEventListener('click', () => {
        const selectedRadio = modal.querySelector('input[name="profileSelection"]:checked');
        safeResolve(selectedRadio?.value || null);
      }, { once: true });
      
      createBtn?.addEventListener('click', async () => {
        const createResult = await showCreateProfileModal();
        safeResolve(createResult ? createResult.name : null);
      }, { once: true });
      
      cancelBtn?.addEventListener('click', () => {
        safeResolve(null);
      }, { once: true });
      
      modal.addEventListener('hidden.bs.modal', () => {
        safeResolve(null);
      }, { once: true });
      
      modalInstance.show();
      
      // Focus on the first profile option
      setTimeout(() => {
        const firstRadio = modal.querySelector('input[name="profileSelection"]');
        firstRadio?.focus();
      }, 500);
    });
  }
  
  /**
   * Show create profile modal and wait for user interaction
   * @param {HTMLElement} modal - Modal element
   * @returns {Promise<Object|null>} Profile creation result
   */
  function showCreateProfileModalAndWait(modal) {
    return new Promise((resolve) => {
      const modalInstance = new bootstrap.Modal(modal);
      const createBtn = document.getElementById('createProfileSubmitBtn');
      const nameInput = document.getElementById('createProfileName');
      const descInput = document.getElementById('createProfileDescription');
      const copySettingsInput = document.getElementById('copyCurrentSettings');
      
      let hasResolved = false;
      
      const cleanup = () => {
        if (hasResolved) return;
        hasResolved = true;
        // Blur any focused element to prevent accessibility warnings
        if (document.activeElement && modal.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        modalInstance.hide();
      };
      
      const safeResolve = (value) => {
        if (hasResolved) return;
        cleanup();
        resolve(value);
      };
      
      createBtn?.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const description = descInput.value.trim();
        const copyFromCurrent = copySettingsInput.checked;
        
        if (!name) {
          alert('Please enter a profile name');
          nameInput.focus();
          return;
        }
        
        try {
          const result = await window.secureElectronAPI.profile.create(name, description, copyFromCurrent);
          
          if (result.success) {
            safeResolve({ name, description });
          } else {
            alert(`Failed to create profile: ${result.error}`);
          }
        } catch (error) {
          alert(`Failed to create profile: ${error.message}`);
        }
      }, { once: true });
      
      modal.addEventListener('hidden.bs.modal', () => {
        safeResolve(null);
      }, { once: true });
      
      modalInstance.show();
      
      // Focus on name input
      setTimeout(() => {
        nameInput.focus();
      }, 500);
    });
  }
  
  /**
   * Show edit profile modal and wait for user interaction
   * @param {HTMLElement} modal - Modal element
   * @returns {Promise<Object|null>} Profile edit result
   */
  function showEditProfileModalAndWait(modal) {
    return new Promise((resolve) => {
      const modalInstance = new bootstrap.Modal(modal);
      const saveBtn = document.getElementById('editProfileSaveBtn');
      const nameInput = document.getElementById('editProfileName');
      const descInput = document.getElementById('editProfileDescription');
      
      let hasResolved = false;
      
      const cleanup = () => {
        if (hasResolved) return;
        hasResolved = true;
        // Blur any focused element to prevent accessibility warnings
        if (document.activeElement && modal.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        modalInstance.hide();
      };
      
      const safeResolve = (value) => {
        if (hasResolved) return;
        cleanup();
        resolve(value);
      };
      
      saveBtn?.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const description = descInput.value.trim() || '';
        
        if (name) {
          safeResolve({ name, description });
        } else {
          alert('Profile name is required');
          nameInput.focus();
        }
      }, { once: true });
      
      modal.addEventListener('hidden.bs.modal', () => {
        safeResolve(null);
      }, { once: true });
      
      modalInstance.show();
      
      // Focus and select name input
      setTimeout(() => {
        nameInput.focus();
        nameInput.select();
      }, 500);
    });
  }
  
  /**
   * Show profile management modal and wait for user interaction
   * @param {HTMLElement} modal - Modal element
   * @returns {Promise<boolean>} Whether changes were made
   */
  function showProfileManagementModalAndWait(modal) {
    return new Promise((resolve) => {
      const modalInstance = new bootstrap.Modal(modal);
      const createBtn = document.getElementById('createNewProfileFromManagementBtn');
      const profileList = document.getElementById('profileManagementList');
      
      let changesMade = false;
      let hasResolved = false;
      
      const cleanup = () => {
        if (hasResolved) return;
        hasResolved = true;
        // Blur any focused element to prevent accessibility warnings
        if (document.activeElement && modal.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        modalInstance.hide();
      };
      
      const safeResolve = (value) => {
        if (hasResolved) return;
        cleanup();
        resolve(value);
      };
      
      // Handle create new profile
      createBtn?.addEventListener('click', async () => {
        const createResult = await showCreateProfileModal();
        if (createResult) {
          changesMade = true;
          // Refresh the modal would go here, but for now just close
          safeResolve(true);
        }
      }, { once: true });
      
      // Handle profile actions
      const handleProfileAction = async (e) => {
        const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
        const profileName = e.target.dataset.profile || e.target.closest('[data-profile]')?.dataset.profile;
        
        if (!action || !profileName) return;
        
        try {
          if (action === 'switch') {
            const result = await window.secureElectronAPI.profile.switch(profileName);
            if (result.success) {
              changesMade = true;
              safeResolve(true); // App will restart
            } else {
              alert(`Failed to switch to profile: ${result.error}`);
            }
          } else if (action === 'delete') {
            if (confirm(`Are you sure you want to delete the profile "${profileName}"? This action cannot be undone.`)) {
              const result = await window.secureElectronAPI.profile.delete(profileName);
              if (result.success) {
                changesMade = true;
                // Refresh modal would go here
                safeResolve(true);
              } else {
                alert(`Failed to delete profile: ${result.error}`);
              }
            }
          } else if (action === 'edit') {
            const currentDescription = e.target.dataset.description || e.target.closest('[data-description]')?.dataset.description || '';
            const editResult = await showEditProfileModal(profileName, currentDescription);
            if (editResult) {
              changesMade = true;
              // TODO: Add API call to update profile info
              safeResolve(true);
            }
          }
        } catch (error) {
          alert(`Action failed: ${error.message}`);
        }
      };
      
      profileList?.addEventListener('click', handleProfileAction, { once: true });
      
      modal.addEventListener('hidden.bs.modal', () => {
        safeResolve(changesMade);
      }, { once: true });
      
      modalInstance.show();
    });
  }
  
  return {
    showProfileSelectionModal,
    showCreateProfileModal,
    showProfileManagementModal,
    showEditProfileModal,
    updateProfileIndicator
  };
}

export default initializeProfileUI;