/**
 * Soundboard Search Panel Module
 * 
 * Handles the collapsible search panel for the soundboard view.
 * Reuses existing search module functionality.
 */

let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

let electronAPI = null;
let searchModule = null;

/**
 * Initialize the search panel
 */
function initializeSearchPanel() {
  debugLog?.info('Initializing soundboard search panel', {
    module: 'soundboard-search-panel',
    function: 'initializeSearchPanel'
  });
  
  const searchPanel = document.getElementById('soundboard-search-panel');
  if (!searchPanel) {
    debugLog?.warn('Soundboard search panel not found', {
      module: 'soundboard-search-panel',
      function: 'initializeSearchPanel'
    });
    return;
  }
  
  // Load saved panel state (open/closed)
  loadPanelState();
  
  // Setup toggle button (note: ID is soundboard-search-panel-toggle in HTML)
  const toggleButton = document.getElementById('soundboard-search-panel-toggle');
  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      toggleSearchPanel();
    });
  }
  
  // Initialize search functionality if search module is available
  if (searchModule || window.moduleRegistry?.search) {
    setupSearchIntegration();
  }
}

/**
 * Setup search integration
 */
function setupSearchIntegration() {
  const searchPanel = document.getElementById('soundboard-search-panel');
  if (!searchPanel) {
    return;
  }
  
  // The search panel will reuse the existing search module
  // We just need to ensure the search results are displayed in the panel
  // and that drag-drop works from the panel to grid buttons
  
  const searchResultsContainer = searchPanel.querySelector('#soundboard-search-results');
  if (searchResultsContainer) {
    // Search results will be populated by the search module
    // We just need to ensure they're draggable
    setupSearchResultsDragDrop();
  }
}

/**
 * Setup drag-drop for search results
 */
function setupSearchResultsDragDrop() {
  // Event delegation for search results
  const searchPanel = document.getElementById('soundboard-search-panel');
  if (!searchPanel) {
    return;
  }
  
  // Search results will use the existing songDrag function
  // from drag-drop module, so we don't need to set up drag here
  // The drop handlers are already set up in soundboard-ui module
}

/**
 * Toggle search panel visibility
 */
function toggleSearchPanel() {
  const searchPanel = document.getElementById('soundboard-search-panel');
  const gridContainer = document.getElementById('soundboard-grid');
  
  if (!searchPanel) {
    return;
  }
  
  const isOpen = !searchPanel.classList.contains('collapsed');
  
  if (isOpen) {
    // Collapse panel
    searchPanel.classList.add('collapsed');
    if (gridContainer) {
      gridContainer.classList.add('full-width');
    }
  } else {
    // Expand panel
    searchPanel.classList.remove('collapsed');
    if (gridContainer) {
      gridContainer.classList.remove('full-width');
    }
  }
  
  // Save panel state
  savePanelState();
  
  // Update grid layout after panel toggle
  if (window.moduleRegistry?.soundboard?.updateGridLayout) {
    window.moduleRegistry.soundboard.updateGridLayout();
  }
}

/**
 * Load panel state from profile state
 */
function loadPanelState() {
  // Panel state is loaded from profile state
  // Default to open (for setup)
  const searchPanel = document.getElementById('soundboard-search-panel');
  if (searchPanel) {
    // Check profile state for saved panel state
    // For now, default to open
    searchPanel.classList.remove('collapsed');
  }
}

/**
 * Save panel state to profile state
 */
function savePanelState() {
  const searchPanel = document.getElementById('soundboard-search-panel');
  if (!searchPanel) {
    return;
  }
  
  const isOpen = !searchPanel.classList.contains('collapsed');
  
  // Panel state will be saved as part of profile state
  // The profile-state module will handle persistence
  debugLog?.info('Saving search panel state', {
    module: 'soundboard-search-panel',
    function: 'savePanelState',
    isOpen
  });
}

/**
 * Reinitialize with dependencies
 */
async function reinitializeSoundboardSearchPanel(deps) {
  if (deps.electronAPI) {
    electronAPI = deps.electronAPI;
  }
  if (deps.search) {
    searchModule = deps.search;
  }
  if (deps.debugLog) {
    debugLog = deps.debugLog;
  }
}

export {
  initializeSearchPanel,
  toggleSearchPanel,
  loadPanelState,
  savePanelState,
  setupSearchIntegration,
  reinitializeSoundboardSearchPanel
};

