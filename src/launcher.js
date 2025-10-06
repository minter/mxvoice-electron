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
      renderProfiles();
      
      // Hide loading, show content
      document.getElementById('loading-state').style.display = 'none';
      document.getElementById('profile-content').style.display = 'block';
      
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
 * Render profiles in the list
 */
function renderProfiles() {
  const listElement = document.getElementById('profile-list');
  listElement.innerHTML = '';
  
  if (profiles.length === 0) {
    listElement.innerHTML = `
      <div class="empty-state">
        <p>No profiles found. Create your first profile to get started.</p>
      </div>
    `;
    return;
  }
  
  // Sort profiles by last used (most recent first)
  const sortedProfiles = [...profiles].sort((a, b) => b.last_used - a.last_used);
  
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
      <div class="profile-actions">
        ${profiles.length > 1 && profile.name !== 'Default User' ? `
          <button class="profile-delete" data-profile="${escapeHtml(profile.name)}">Delete</button>
        ` : ''}
      </div>
    `;
    
    // Click to select profile
    li.addEventListener('click', (e) => {
      if (!e.target.classList.contains('profile-delete')) {
        selectProfile(profile.name);
      }
    });
    
    // Double-click to launch
    li.addEventListener('dblclick', (e) => {
      if (!e.target.classList.contains('profile-delete')) {
        launchApp();
      }
    });
    
    listElement.appendChild(li);
  });
  
  // Setup delete button handlers
  document.querySelectorAll('.profile-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const profileName = btn.dataset.profile;
      await deleteProfile(profileName);
    });
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
      // Main app is launching, close launcher window
      window.close();
    } else {
      showError(result.error || 'Failed to launch app');
    }
  } catch (error) {
    showError(`Error launching app: ${error.message}`);
  }
}

/**
 * Show create profile modal
 */
function showCreateModal() {
  const modal = document.getElementById('create-modal');
  const nameInput = document.getElementById('profile-name-input');
  const descInput = document.getElementById('profile-desc-input');
  
  // Clear inputs
  nameInput.value = '';
  descInput.value = '';
  
  // Show modal
  modal.style.display = 'flex';
  
  // Focus name input
  setTimeout(() => nameInput.focus(), 100);
}

/**
 * Hide create profile modal
 */
function hideCreateModal() {
  const modal = document.getElementById('create-modal');
  modal.style.display = 'none';
}

/**
 * Create a new profile
 */
async function createNewProfile(event) {
  event.preventDefault();
  
  const nameInput = document.getElementById('profile-name-input');
  const descInput = document.getElementById('profile-desc-input');
  
  const name = nameInput.value.trim();
  const description = descInput.value.trim();
  
  if (!name) {
    showError('Profile name is required');
    return;
  }
  
  try {
    const result = await window.launcherAPI.createProfile(name, description);
    
    if (result.success) {
      hideCreateModal();
      await loadProfiles();
      selectProfile(name);
      clearError();
    } else {
      showError(result.error || 'Failed to create profile');
    }
  } catch (error) {
    showError(`Error creating profile: ${error.message}`);
  }
}

/**
 * Delete a profile
 */
async function deleteProfile(profileName) {
  const confirmed = confirm(`Are you sure you want to delete the profile "${profileName}"?\n\nThis will remove all preferences for this profile.`);
  
  if (!confirmed) {
    return;
  }
  
  try {
    const result = await window.launcherAPI.deleteProfile(profileName);
    
    if (result.success) {
      // If deleted profile was selected, clear selection
      if (selectedProfile === profileName) {
        selectedProfile = null;
        document.getElementById('launch-btn').disabled = true;
      }
      
      await loadProfiles();
      clearError();
    } else {
      showError(result.error || 'Failed to delete profile');
    }
  } catch (error) {
    showError(`Error deleting profile: ${error.message}`);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('launch-btn').addEventListener('click', launchApp);
  document.getElementById('create-btn').addEventListener('click', showCreateModal);
  document.getElementById('cancel-create-btn').addEventListener('click', hideCreateModal);
  document.getElementById('create-form').addEventListener('submit', createNewProfile);
  
  // Enter key launches app if profile selected (only when modal is not open)
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('create-modal');
    const modalOpen = modal.style.display === 'flex';
    
    if (e.key === 'Enter' && selectedProfile && !modalOpen) {
      launchApp();
    }
    
    // Escape key closes modal
    if (e.key === 'Escape' && modalOpen) {
      hideCreateModal();
    }
  });
  
  // Click outside modal to close
  document.getElementById('create-modal').addEventListener('click', (e) => {
    if (e.target.id === 'create-modal') {
      hideCreateModal();
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
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

