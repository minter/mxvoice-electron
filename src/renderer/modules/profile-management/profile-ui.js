/**
 * Profile UI Component for Renderer Process
 * 
 * Handles all profile-related UI interactions including modals, selection screens,
 * and profile indicator updates.
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
 * Initialize the Profile UI component
 * @param {Object} options - Configuration options
 * @returns {Object} Profile UI interface
 */
function initializeProfileUI(options = {}) {
  // Use secureElectronAPI for profile operations
  const { db, store } = options;
  
  // DebugLog is available via window.debugLog (imported above)
  
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
      
      // Create modal HTML
      const modalHtml = createProfileSelectionModalHtml(profiles.profiles, {
        showCreateOption,
        showCancelOption,
        title
      });
      
      // Show modal and wait for selection
      const selectedProfile = await showModalAndWait(modalHtml, 'profile-selection-modal');
      
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
      
      // Create modal HTML
      const modalHtml = createCreateProfileModalHtml();
      
      // Show modal and wait for result
      const result = await showModalAndWait(modalHtml, 'create-profile-modal');
      
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
      
      // Create modal HTML with active profile info
      const modalHtml = createProfileManagementModalHtml(profilesResult.profiles, activeProfileName);
      
      // Show modal and wait for result
      const changesMade = await showModalAndWait(modalHtml, 'profile-management-modal');
      
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
      
      // Create modal HTML
      const modalHtml = createEditProfileModalHtml(currentName, currentDescription);
      
      // Show modal and wait for result
      const result = await showModalAndWait(modalHtml, 'edit-profile-modal');
      
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
   * Create HTML for edit profile modal
   * @param {string} currentName - Current profile name
   * @param {string} currentDescription - Current profile description
   * @returns {string} Modal HTML
   */
  function createEditProfileModalHtml(currentName, currentDescription) {
    return `
      <div class="modal fade" id="edit-profile-modal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">Edit Profile</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <form id="edit-profile-form">
                <div class="mb-3">
                  <label for="edit-profile-name" class="form-label">Profile Name</label>
                  <input type="text" class="form-control" id="edit-profile-name" value="${currentName}" required maxlength="50">
                  <div class="form-text">Choose a name for this profile (max 50 characters)</div>
                </div>
                <div class="mb-3">
                  <label for="edit-profile-description" class="form-label">Description (Optional)</label>
                  <textarea class="form-control" id="edit-profile-description" rows="3" maxlength="200" placeholder="Describe this profile...">${currentDescription}</textarea>
                  <div class="form-text">Optional description for this profile (max 200 characters)</div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="save-edit-profile-btn">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create HTML for profile selection modal
   * @param {Array} profiles - Available profiles
   * @param {Object} options - Modal options
   * @returns {string} Modal HTML
   */
  function createProfileSelectionModalHtml(profiles, options) {
    const { showCreateOption, showCancelOption, title } = options;
    
    let profilesHtml = '';
    profiles.forEach((profile, index) => {
      const isDefault = profile.name === 'Default User';
      const isSelected = index === 0; // First profile is selected by default
      profilesHtml += `
        <div class="card mb-3 profile-selection-card" data-profile-name="${profile.name}" style="cursor: pointer;">
          <div class="card-body">
            <div class="d-flex align-items-start">
              <div class="form-check me-3 mt-1">
                <input class="form-check-input" type="radio" name="profileSelection" id="profile-${index}" value="${profile.name}" ${isSelected ? 'checked' : ''}>
              </div>
              <div class="flex-grow-1">
                <h6 class="card-title mb-1">${profile.name}</h6>
                ${profile.description ? `<p class="card-text small mb-1" style="color: var(--card-text); opacity: 0.7;">${profile.description}</p>` : ''}
                ${isDefault ? '<small style="color: var(--bs-info, #0dcaf0);">Protected profile</small>' : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    return `
      <div class="modal fade" id="profile-selection-modal" tabindex="-1" role="dialog" data-bs-backdrop="static" data-bs-keyboard="false">
        <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">${title}</h6>
              ${showCancelOption ? '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' : ''}
            </div>
            <div class="modal-body">
              <p style="color: var(--card-text); opacity: 0.7;">Choose your profile to continue:</p>
              <form id="profile-selection-form">
                ${profilesHtml}
              </form>
              ${showCreateOption ? `
                <hr>
                <div class="text-center">
                  <button type="button" class="btn btn-outline-primary btn-sm" id="create-new-profile-btn">
                    <i class="fas fa-plus"></i> Create New Profile
                  </button>
                </div>
              ` : ''}
            </div>
            <div class="modal-footer">
              ${showCancelOption ? '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>' : ''}
              <button type="button" class="btn btn-primary" id="select-profile-btn">Continue</button>
            </div>
          </div>
        </div>
      </div>
      <style>
        .profile-selection-card:hover {
          background-color: var(--bs-gray-100, #f8f9fa) !important;
        }
        .theme-dark .profile-selection-card:hover {
          background-color: var(--bs-gray-800, #343a40) !important;
        }
        .profile-selection-card.selected {
          border-color: var(--bs-primary, #0d6efd) !important;
          background-color: var(--bs-primary-bg-subtle, #cfe2ff) !important;
        }
        .theme-dark .profile-selection-card.selected {
          background-color: var(--bs-primary-bg-subtle, rgba(13, 110, 253, 0.2)) !important;
        }
      </style>
    `;
  }
  
  /**
   * Create HTML for create profile modal
   * @returns {string} Modal HTML
   */
  function createCreateProfileModalHtml() {
    return `
      <div class="modal fade" id="create-profile-modal" tabindex="-1" role="dialog" data-bs-backdrop="static" data-bs-keyboard="false">
        <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">Create New Profile</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <form id="create-profile-form">
                <div class="mb-3">
                  <label for="profile-name" class="form-label">Profile Name</label>
                  <input type="text" class="form-control" id="profile-name" required maxlength="50" placeholder="Enter profile name...">
                  <div class="form-text">Choose a unique name for your profile</div>
                </div>
                <div class="mb-3">
                  <label for="profile-description" class="form-label">Description (optional)</label>
                  <input type="text" class="form-control" id="profile-description" maxlength="100" placeholder="Enter description...">
                  <div class="form-text">Add a brief description to help identify this profile</div>
                </div>
                <div class="form-check mb-3">
                  <input class="form-check-input" type="checkbox" id="copy-current-settings" checked>
                  <label class="form-check-label" for="copy-current-settings">
                    Copy settings from current profile
                  </label>
                  <div class="form-text">Start with the current app settings as a base</div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="create-profile-btn">Create Profile</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Create HTML for profile management modal
   * @param {Array} profiles - Available profiles
   * @param {string} activeProfileName - Name of the currently active profile
   * @returns {string} Modal HTML
   */
  function createProfileManagementModalHtml(profiles, activeProfileName) {
    let profilesHtml = '';
    profiles.forEach((profile, index) => {
      const isDefault = profile.name === 'Default User';
      const isActive = profile.name === activeProfileName;
      const createdDate = new Date(profile.created_at).toLocaleDateString();
      const lastUsedDate = new Date(profile.last_used).toLocaleDateString();
      
      profilesHtml += `
        <div class="card mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div class="flex-grow-1">
                <h6 class="card-title mb-1 d-flex align-items-center">
                  ${profile.name}
                  ${isActive ? '<span class="badge bg-success ms-2">Active</span>' : ''}
                </h6>
                ${profile.description ? `<p class="card-text small mb-1" style="color: var(--card-text); opacity: 0.7;">${profile.description}</p>` : ''}
                <small style="color: var(--card-text); opacity: 0.7;">Created: ${createdDate} | Last used: ${lastUsedDate}</small>
                ${isDefault ? '<br><small style="color: var(--bs-info, #0dcaf0);">Protected profile</small>' : ''}
              </div>
              <div class="ms-4">
                ${!isActive ? `
                  <button type="button" class="btn btn-outline-primary btn-sm me-2" onclick="switchToProfile('${profile.name}')">
                    <i class="fas fa-user-check me-1"></i>Use
                  </button>
                ` : ''}
                ${!isDefault ? `
                  <button type="button" class="btn btn-outline-secondary btn-sm me-2" onclick="editProfile('${profile.name}', '${profile.description || ''}')">
                    <i class="fas fa-edit me-1"></i>Edit
                  </button>
                  <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteProfile('${profile.name}')">
                    <i class="fas fa-trash me-1"></i>Delete
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    return `
      <div class="modal fade" id="profile-management-modal" tabindex="-1" role="dialog">
        <div class="modal-dialog modal-lg" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">Profile Management</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex justify-content-between align-items-center mb-4">
                <h6 class="mb-0">Current Profiles</h6>
                <button type="button" class="btn btn-primary btn-sm" id="create-new-profile-management-btn">
                  <i class="fas fa-plus me-1"></i>Create New Profile
                </button>
              </div>
              ${profilesHtml}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Show modal and wait for user interaction
   * @param {string} modalHtml - Modal HTML content
   * @param {string} modalId - Modal ID
   * @returns {Promise<any>} Modal result
   */
  async function showModalAndWait(modalHtml, modalId) {
    return new Promise((resolve) => {
      // Remove existing modal if present
      const existingModal = document.getElementById(modalId);
      if (existingModal) {
        existingModal.remove();
      }
      
      // Add modal to DOM
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      // Get modal element
      const modal = document.getElementById(modalId);
      const modalInstance = new bootstrap.Modal(modal);
      
      // Set up event handlers
      setupModalEventHandlers(modal, modalId, resolve, modalInstance);
      
      // Show modal
      modalInstance.show();
    });
  }
  
  /**
   * Set up event handlers for modal
   * @param {HTMLElement} modal - Modal element
   * @param {string} modalId - Modal ID
   * @param {Function} resolve - Promise resolve function
   * @param {Object} modalInstance - Bootstrap modal instance
   */
  function setupModalEventHandlers(modal, modalId, resolve, modalInstance) {
    if (modalId === 'profile-selection-modal') {
      setupProfileSelectionHandlers(modal, resolve, modalInstance);
    } else if (modalId === 'create-profile-modal') {
      setupCreateProfileHandlers(modal, resolve, modalInstance);
    } else if (modalId === 'profile-management-modal') {
      setupProfileManagementHandlers(modal, resolve, modalInstance);
    } else if (modalId === 'edit-profile-modal') {
      setupEditProfileHandlers(modal, resolve, modalInstance);
    }
    
    // Cleanup on modal hide
    modal.addEventListener('hidden.bs.modal', () => {
      modal.remove();
    });
  }
  
  /**
   * Set up handlers for profile selection modal
   * @param {HTMLElement} modal - Modal element
   * @param {Function} resolve - Promise resolve function
   * @param {Object} modalInstance - Bootstrap modal instance
   */
  function setupProfileSelectionHandlers(modal, resolve, modalInstance) {
    const selectBtn = modal.querySelector('#select-profile-btn');
    const createBtn = modal.querySelector('#create-new-profile-btn');
    
    // Handle card clicks
    const profileCards = modal.querySelectorAll('.profile-selection-card');
    profileCards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking on the radio button itself
        if (e.target.type === 'radio') return;
        
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          
          // Update visual selection
          profileCards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      });
    });
    
    // Set initial selection
    const initialSelected = modal.querySelector('input[name="profileSelection"]:checked');
    if (initialSelected) {
      initialSelected.closest('.profile-selection-card')?.classList.add('selected');
    }
    
    selectBtn?.addEventListener('click', () => {
      const selectedRadio = modal.querySelector('input[name="profileSelection"]:checked');
      if (selectedRadio) {
        modalInstance.hide();
        resolve(selectedRadio.value);
      }
    });
    
    createBtn?.addEventListener('click', async () => {
      modalInstance.hide();
      const createResult = await showCreateProfileModal();
      if (createResult) {
        resolve(createResult.name);
      } else {
        resolve(null);
      }
    });
  }
  
  /**
   * Set up handlers for create profile modal
   * @param {HTMLElement} modal - Modal element
   * @param {Function} resolve - Promise resolve function
   * @param {Object} modalInstance - Bootstrap modal instance
   */
  function setupCreateProfileHandlers(modal, resolve, modalInstance) {
    const createBtn = modal.querySelector('#create-profile-btn');
    
    createBtn?.addEventListener('click', async () => {
      const name = modal.querySelector('#profile-name').value.trim();
      const description = modal.querySelector('#profile-description').value.trim();
      const copyFromCurrent = modal.querySelector('#copy-current-settings').checked;
      
      if (!name) {
        alert('Please enter a profile name');
        return;
      }
      
      const result = await window.secureElectronAPI.profile.create(name, description, copyFromCurrent);
      
      if (result.success) {
        modalInstance.hide();
        resolve({ name, description });
      } else {
        alert(`Failed to create profile: ${result.error}`);
      }
    });
  }
  
  /**
   * Set up handlers for edit profile modal
   * @param {HTMLElement} modal - Modal element
   * @param {Function} resolve - Promise resolve function
   * @param {Object} modalInstance - Bootstrap modal instance
   */
  function setupEditProfileHandlers(modal, resolve, modalInstance) {
    const saveBtn = modal.querySelector('#save-edit-profile-btn');
    
    saveBtn?.addEventListener('click', () => {
      const nameInput = modal.querySelector('#edit-profile-name');
      const descriptionInput = modal.querySelector('#edit-profile-description');
      
      const name = nameInput?.value?.trim();
      const description = descriptionInput?.value?.trim() || '';
      
      if (name) {
        modalInstance.hide();
        resolve({ name, description });
      } else {
        alert('Profile name is required');
      }
    });
  }

  /**
   * Set up handlers for profile management modal
   * @param {HTMLElement} modal - Modal element
   * @param {Function} resolve - Promise resolve function
   * @param {Object} modalInstance - Bootstrap modal instance
   */
  function setupProfileManagementHandlers(modal, resolve, modalInstance) {
    const createBtn = modal.querySelector('#create-new-profile-management-btn');
    
    createBtn?.addEventListener('click', async () => {
      const createResult = await showCreateProfileModal();
      if (createResult) {
        // Refresh the management modal
        modalInstance.hide();
        const changesMade = await showProfileManagementModal();
        resolve(changesMade);
      }
    });
    
    // Set up delete handlers
    modal.addEventListener('click', async (e) => {
      if (e.target.closest('[onclick*="deleteProfile"]')) {
        const profileName = e.target.closest('[onclick*="deleteProfile"]').getAttribute('onclick').match(/'([^']+)'/)[1];
        
        if (confirm(`Are you sure you want to delete the profile "${profileName}"? This action cannot be undone.`)) {
          const result = await window.secureElectronAPI.profile.delete(profileName);
          
          if (result.success) {
            // Refresh the management modal
            modalInstance.hide();
            const changesMade = await showProfileManagementModal();
            resolve(changesMade);
          } else {
            alert(`Failed to delete profile: ${result.error}`);
          }
        }
      }
    });
    
    // Set up switch profile handlers
    modal.addEventListener('click', async (e) => {
      if (e.target.closest('[onclick*="switchToProfile"]')) {
        const profileName = e.target.closest('[onclick*="switchToProfile"]').getAttribute('onclick').match(/'([^']+)'/)[1];
        
        try {
          debugLog?.info('Switching to profile', { 
            module: 'profile-ui', 
            function: 'switchToProfile',
            profileName 
          });
          
          const result = await window.secureElectronAPI.profile.switch(profileName);
          
          if (result.success) {
            debugLog?.info('Profile switch successful, closing modal', { 
              module: 'profile-ui', 
              function: 'switchToProfile',
              profileName 
            });
            
            // Close modal and let the app restart
            modalInstance.hide();
            resolve(true); // Indicate changes were made (app will restart)
          } else {
            alert(`Failed to switch to profile: ${result.error}`);
          }
        } catch (error) {
          debugLog?.error('Failed to switch profile', { 
            module: 'profile-ui', 
            function: 'switchToProfile',
            profileName,
            error: error.message 
          });
          alert(`Failed to switch to profile: ${error.message}`);
        }
      }
    });
    
    // Set up edit profile handlers
    modal.addEventListener('click', async (e) => {
      if (e.target.closest('[onclick*="editProfile"]')) {
        const onclickAttr = e.target.closest('[onclick*="editProfile"]').getAttribute('onclick');
        const match = onclickAttr.match(/editProfile\('([^']+)',\s*'([^']*)'\)/);
        
        if (match) {
          const profileName = match[1];
          const currentDescription = match[2];
          
          try {
            debugLog?.info('Editing profile', { 
              module: 'profile-ui', 
              function: 'editProfile',
              profileName,
              currentDescription 
            });
            
            // Show edit modal
            const newInfo = await showEditProfileModal(profileName, currentDescription);
            
            if (newInfo) {
              // TODO: Add API call to update profile info
              // For now, just refresh the modal
              modalInstance.hide();
              const changesMade = await showProfileManagementModal();
              resolve(changesMade);
            }
          } catch (error) {
            debugLog?.error('Failed to edit profile', { 
              module: 'profile-ui', 
              function: 'editProfile',
              profileName,
              error: error.message 
            });
            alert(`Failed to edit profile: ${error.message}`);
          }
        }
      }
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
