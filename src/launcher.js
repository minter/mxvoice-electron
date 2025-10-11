/**
 * Profile Launcher Renderer Script
 * 
 * This script runs in the launcher window and handles:
 * - Displaying available profiles
 * - Profile selection
 * - Creating new profiles
 * - Deleting profiles
 * - Launching the main app with selected profile
 */

let selectedProfile = null;
let profiles = [];
let filteredProfiles = [];

// Wait for the secure API to be available
window.addEventListener('DOMContentLoaded', async () => {
  await loadProfiles();
  setupEventListeners();
});

/**
 * Load profiles from main process
 */
async function loadProfiles() {
  try {
    const result = await window.launcherAPI.getProfiles();
    
    if (result.success) {
    profiles = result.profiles;
    filteredProfiles = [...profiles];
    renderProfiles();
      
      // Hide loading, show content
      document.getElementById('loading-state').style.display = 'none';
      document.getElementById('profile-content').style.display = 'block';
      
      // Focus the search field now that it's visible
      setTimeout(() => {
        const searchField = document.getElementById('profile-search');
        if (searchField) {
          searchField.focus();
        }
      }, 100);
      
      // Auto-select first profile if only one exists
      if (profiles.length === 1) {
        selectProfile(profiles[0].name);
      }
    } else {
      showError(result.error || 'Failed to load profiles');
    }
  } catch (error) {
    showError(`Error loading profiles: ${error.message}`);
  }
}

/**
 * Filter profiles based on search term
 */
function filterProfiles(searchTerm = '') {
  if (!searchTerm.trim()) {
    filteredProfiles = [...profiles];
  } else {
    const term = searchTerm.toLowerCase();
    filteredProfiles = profiles.filter(profile => 
      profile.name.toLowerCase().includes(term) ||
      (profile.description && profile.description.toLowerCase().includes(term))
    );
  }
  
  renderProfiles();
}

/**
 * Render profiles in the list
 */
function renderProfiles() {
  const listElement = document.getElementById('profile-list');
  listElement.innerHTML = '';
  
  if (filteredProfiles.length === 0) {
    const searchTerm = document.getElementById('profile-search')?.value || '';
    if (searchTerm.trim()) {
      listElement.innerHTML = `
        <div class="empty-state">
          <p>No profiles match "${escapeHtml(searchTerm)}". Try a different search term.</p>
        </div>
      `;
    } else {
      listElement.innerHTML = `
        <div class="empty-state">
          <p>No profiles found. Create your first profile to get started.</p>
        </div>
      `;
    }
    return;
  }
  
  // Sort filtered profiles alphabetically, with Default User at the top
  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    // Default User always comes first
    if (a.name === 'Default User') return -1;
    if (b.name === 'Default User') return 1;
    
    // Sort all other profiles alphabetically (case-insensitive)
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  
  sortedProfiles.forEach(profile => {
    const li = document.createElement('li');
    li.className = 'profile-item';
    li.dataset.profileName = profile.name;
    
    if (selectedProfile === profile.name) {
      li.classList.add('selected');
    }
    
    li.innerHTML = `
      <div class="profile-info">
        <div class="profile-name">${escapeHtml(profile.name)}</div>
        <div class="profile-description">${escapeHtml(profile.description || 'No description')}</div>
      </div>
    `;
    
    // Click to select profile
    li.addEventListener('click', (e) => {
      selectProfile(profile.name);
    });
    
    // Double-click to launch
    li.addEventListener('dblclick', (e) => {
      launchApp();
    });
    
    listElement.appendChild(li);
  });
}

/**
 * Select a profile
 */
function selectProfile(profileName) {
  selectedProfile = profileName;
  
  // Update UI
  document.querySelectorAll('.profile-item').forEach(item => {
    if (item.dataset.profileName === profileName) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
  
  // Enable launch button
  document.getElementById('launch-btn').disabled = false;
}

/**
 * Launch the main app with selected profile
 */
async function launchApp() {
  if (!selectedProfile) {
    showError('Please select a profile');
    return;
  }
  
  try {
    const result = await window.launcherAPI.launchApp(selectedProfile);
    
    if (result.success) {
      // Main app is launching, close launcher window after a short delay
      // This allows the main window to be created and detected by tests
      setTimeout(() => {
        window.close();
      }, 100);
    } else {
      showError(result.error || 'Failed to launch app');
    }
  } catch (error) {
    showError(`Error launching app: ${error.message}`);
  }
}



/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('launch-btn').addEventListener('click', launchApp);
  
  // Create profile button
  document.getElementById('create-profile-btn').addEventListener('click', showCreateProfileModal);
  
  // Modal event listeners
  document.getElementById('modal-close').addEventListener('click', hideCreateProfileModal);
  document.getElementById('cancel-create-btn').addEventListener('click', hideCreateProfileModal);
  document.getElementById('confirm-create-btn').addEventListener('click', createProfile);
  
  // Close modal when clicking outside
  document.getElementById('create-profile-modal').addEventListener('click', (e) => {
    if (e.target.id === 'create-profile-modal') {
      hideCreateProfileModal();
    }
  });
  
  // Enter key in name field creates profile
  document.getElementById('profile-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      createProfile();
    }
  });
  
  // Enter key in description field creates profile
  document.getElementById('profile-description-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      createProfile();
    }
  });
  
  // Search functionality
  document.getElementById('profile-search').addEventListener('input', (e) => {
    filterProfiles(e.target.value);
  });
  
  // Enter key launches app if profile selected
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && selectedProfile) {
      launchApp();
    }
  });
}

/**
 * Show error message
 */
function showError(message) {
  const container = document.getElementById('error-container');
  container.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
}

/**
 * Clear error message
 */
function clearError() {
  document.getElementById('error-container').innerHTML = '';
}

/**
 * Show the create profile modal
 */
function showCreateProfileModal() {
  // Clear form fields
  document.getElementById('profile-name-input').value = '';
  document.getElementById('profile-description-input').value = '';
  
  // Show modal
  document.getElementById('create-profile-modal').style.display = 'flex';
  
  // Focus the name input
  setTimeout(() => {
    document.getElementById('profile-name-input').focus();
  }, 100);
}

/**
 * Hide the create profile modal
 */
function hideCreateProfileModal() {
  document.getElementById('create-profile-modal').style.display = 'none';
}

/**
 * Create a new profile
 */
async function createProfile() {
  const nameInput = document.getElementById('profile-name-input');
  const descInput = document.getElementById('profile-description-input');
  
  const name = nameInput.value.trim();
  const description = descInput.value.trim();
  
  // Validate profile name
  if (!name) {
    showError('Profile name is required');
    nameInput.focus();
    return;
  }
  
  // Check for invalid characters (basic validation)
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    showError('Profile name can only contain letters, numbers, spaces, hyphens, and underscores');
    nameInput.focus();
    return;
  }
  
  // Check if profile already exists
  const existingProfile = profiles.find(p => p.name === name);
  if (existingProfile) {
    showError('A profile with this name already exists');
    nameInput.focus();
    return;
  }
  
  try {
    // Clear any existing errors
    clearError();
    
    // Create the profile
    const result = await window.launcherAPI.createProfile(name, description);
    
    if (result.success) {
      // Hide modal
      hideCreateProfileModal();
      
      // Reload profiles to include the new one
      await loadProfiles();
      
      // Auto-select the newly created profile
      selectProfile(name);
    } else {
      showError(result.error || 'Failed to create profile');
    }
  } catch (error) {
    showError(`Error creating profile: ${error.message}`);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

