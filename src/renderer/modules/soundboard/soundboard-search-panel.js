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
async function initializeSearchPanel() {
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
  
  // Initialize search functionality (always set up, doesn't require search module)
  await setupSearchIntegration();
}

/**
 * Setup search integration
 */
async function setupSearchIntegration() {
  const searchPanel = document.getElementById('soundboard-search-panel');
  if (!searchPanel) {
    return;
  }
  
  // Populate category dropdown
  await populateSoundboardCategorySelect();
  
  // Setup search form event listeners
  setupSearchFormListeners();
  
  // Setup search results drag-drop
  setupSearchResultsDragDrop();
}

/**
 * Populate the soundboard category dropdown
 */
async function populateSoundboardCategorySelect() {
  const select = document.getElementById('soundboard-category-select');
  if (!select) {
    debugLog?.warn('Soundboard category select not found', {
      module: 'soundboard-search-panel',
      function: 'populateSoundboardCategorySelect'
    });
    return;
  }
  
  // Store currently selected category
  const selectedCategory = select.value || '*';
  
  // Clear and add "All Categories" option
  select.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = '*';
  optAll.textContent = 'All Categories';
  select.appendChild(optAll);
  
  try {
    // Get categories from database
    if (window.secureElectronAPI?.database?.query) {
      const result = await window.secureElectronAPI.database.query(
        'SELECT * FROM categories ORDER BY description ASC'
      );
      
      if (result.success && result.data && Array.isArray(result.data)) {
        result.data.forEach(row => {
          const opt = document.createElement('option');
          opt.value = row.code;
          opt.textContent = row.description;
          select.appendChild(opt);
        });
        
        // Restore previously selected category if it still exists
        if (selectedCategory !== '*') {
          select.value = selectedCategory;
        }
        
        debugLog?.info('Soundboard category select populated', {
          module: 'soundboard-search-panel',
          function: 'populateSoundboardCategorySelect',
          categoryCount: result.data.length
        });
      }
    }
  } catch (error) {
    debugLog?.error('Failed to populate soundboard category select', {
      module: 'soundboard-search-panel',
      function: 'populateSoundboardCategorySelect',
      error: error.message
    });
  }
}

/**
 * Setup search form event listeners
 */
function setupSearchFormListeners() {
  const searchForm = document.getElementById('soundboard-search-form');
  const omniSearch = document.getElementById('soundboard-omni-search');
  const resetButton = document.getElementById('soundboard-reset-button');
  const advancedButton = document.getElementById('soundboard-advanced-search-button');
  const advancedSearch = document.getElementById('soundboard-advanced-search');
  
  // Form submit handler
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      performSoundboardSearch();
    });
  }
  
  // Live search on input (debounced)
  let liveSearchTimeout = null;
  if (omniSearch) {
    omniSearch.addEventListener('input', () => {
      clearTimeout(liveSearchTimeout);
      liveSearchTimeout = setTimeout(() => {
        performSoundboardSearch();
      }, 300);
    });
  }
  
  // Reset button
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      if (omniSearch) omniSearch.value = '';
      if (advancedSearch) {
        const artistSearch = advancedSearch.querySelector('#soundboard-artist-search');
        const infoSearch = advancedSearch.querySelector('#soundboard-info-search');
        if (artistSearch) artistSearch.value = '';
        if (infoSearch) infoSearch.value = '';
      }
      clearSoundboardSearchResults();
    });
  }
  
  // Advanced search toggle
  if (advancedButton && advancedSearch) {
    advancedButton.addEventListener('click', () => {
      const isVisible = advancedSearch.style.display !== 'none';
      advancedSearch.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        performSoundboardSearch();
      }
    });
  }
  
  // Category change triggers search
  const categorySelect = document.getElementById('soundboard-category-select');
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      performSoundboardSearch();
    });
  }
}

/**
 * Perform search for soundboard view
 */
async function performSoundboardSearch() {
  const searchTerm = (document.getElementById('soundboard-omni-search')?.value || '').trim();
  const category = document.getElementById('soundboard-category-select')?.value || '*';
  const advancedSearch = document.getElementById('soundboard-advanced-search');
  
  // Build query
  const queryParams = [];
  const querySegments = [];
  
  // Category filter
  if (category !== '*') {
    querySegments.push('category = ?');
    queryParams.push(category);
  }
  
  // Advanced search filters
  let hasAdvancedFilters = false;
  if (advancedSearch && advancedSearch.style.display !== 'none') {
    const artist = (advancedSearch.querySelector('#soundboard-artist-search')?.value || '').trim();
    const info = (advancedSearch.querySelector('#soundboard-info-search')?.value || '').trim();
    
    if (artist.length) {
      querySegments.push('artist LIKE ?');
      queryParams.push(`%${artist}%`);
      hasAdvancedFilters = true;
    }
    if (info.length) {
      querySegments.push('info LIKE ?');
      queryParams.push(`%${info}%`);
      hasAdvancedFilters = true;
    }
  }
  
  // Search term filter
  if (searchTerm.length) {
    querySegments.push('(title LIKE ? OR artist LIKE ? OR info LIKE ?)');
    queryParams.push(`%${searchTerm}%`);
    queryParams.push(`%${searchTerm}%`);
    queryParams.push(`%${searchTerm}%`);
  }
  
  // If no filters at all (no category, no search term, no advanced filters), clear results
  if (category === '*' && !searchTerm.length && !hasAdvancedFilters) {
    clearSoundboardSearchResults();
    return;
  }
  
  // Build query string
  let queryString = '';
  if (querySegments.length > 0) {
    queryString = ' WHERE ' + querySegments.join(' AND ');
  }
  
  // Clear previous results
  const tbody = document.querySelector('#soundboard-search-results tbody');
  const thead = document.querySelector('#soundboard-search-results thead');
  if (tbody) tbody.innerHTML = '';
  if (thead) thead.style.display = '';
  
  // Show loading
  if (tbody) {
    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.colSpan = 3;
    loadingCell.style.textAlign = 'center';
    loadingCell.style.padding = '20px';
    loadingCell.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
    loadingRow.appendChild(loadingCell);
    tbody.appendChild(loadingRow);
  }
  
  try {
    // Execute query with parameters
    const sql = `SELECT * FROM mrvoice${queryString} ORDER BY category, info, title, artist`;
    
    debugLog?.info('Executing soundboard search query', {
      module: 'soundboard-search-panel',
      function: 'performSoundboardSearch',
      sql: sql.substring(0, 100) + '...',
      params: queryParams,
      paramCount: queryParams.length
    });
    
    const result = await window.secureElectronAPI.database.query(sql, queryParams);
    
    debugLog?.info('Soundboard search query result', {
      module: 'soundboard-search-panel',
      function: 'performSoundboardSearch',
      success: result.success,
      dataLength: result.data?.length || 0,
      error: result.error
    });
    
    // Remove loading indicator
    if (tbody) tbody.innerHTML = '';
    
    if (result.success && result.data && result.data.length > 0) {
      // Get categories for display
      const categories = {};
      if (window.moduleRegistry?.search?.getCachedCategories) {
        Object.assign(categories, window.moduleRegistry.search.getCachedCategories());
      }
      
      // Display results
      const fragment = document.createDocumentFragment();
      result.data.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = 'song unselectable context-menu';
        tr.draggable = true;
        tr.style.fontSize = '11px';
        tr.setAttribute('songid', String(row.id));
        
        // Add drag handler
        tr.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text', String(row.id));
        });
        
        // Title
        const tdTitle = document.createElement('td');
        tdTitle.style.fontWeight = 'bold';
        tdTitle.textContent = row.title || '';
        tr.appendChild(tdTitle);
        
        // Artist
        const tdArtist = document.createElement('td');
        tdArtist.style.fontWeight = 'bold';
        tdArtist.textContent = row.artist || '';
        tr.appendChild(tdArtist);
        
        // Time
        const tdTime = document.createElement('td');
        tdTime.textContent = row.time || '';
        tr.appendChild(tdTime);
        
        fragment.appendChild(tr);
      });
      
      if (tbody) tbody.appendChild(fragment);
      if (thead) thead.style.display = '';
      
      debugLog?.info('Soundboard search completed', {
        module: 'soundboard-search-panel',
        function: 'performSoundboardSearch',
        resultCount: result.data.length
      });
    } else {
      // No results
      if (thead) thead.style.display = 'none';
      debugLog?.info('Soundboard search returned no results', {
        module: 'soundboard-search-panel',
        function: 'performSoundboardSearch'
      });
    }
  } catch (error) {
    debugLog?.error('Soundboard search error', {
      module: 'soundboard-search-panel',
      function: 'performSoundboardSearch',
      error: error.message
    });
    
    // Remove loading indicator
    if (tbody) tbody.innerHTML = '';
    if (thead) thead.style.display = 'none';
  }
}

/**
 * Clear soundboard search results
 */
function clearSoundboardSearchResults() {
  const tbody = document.querySelector('#soundboard-search-results tbody');
  const thead = document.querySelector('#soundboard-search-results thead');
  if (tbody) tbody.innerHTML = '';
  if (thead) thead.style.display = 'none';
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
  populateSoundboardCategorySelect,
  performSoundboardSearch,
  clearSoundboardSearchResults,
  reinitializeSoundboardSearchPanel
};

