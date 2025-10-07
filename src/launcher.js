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
  
  // Sort filtered profiles by last used (most recent first)
  const sortedProfiles = [...filteredProfiles].sort((a, b) => b.last_used - a.last_used);
  
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
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('launch-btn').addEventListener('click', launchApp);
  
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
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

