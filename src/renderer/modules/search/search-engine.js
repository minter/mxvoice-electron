/**
 * Search Engine Module
 * 
 * This module handles the main search functionality including
 * search data retrieval, live search, and category management.
 */

// Import shared state
import sharedState from '../shared-state.js';
import Dom from '../dom-utils/index.js';
import { hasActiveAdvancedFilters } from './search-form-utils.js';

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_error) {
  // Debug logger not available
}

// Import live search functionality
import * as liveSearch from './live-search.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';

// Track active search to prevent race conditions
let activeSearchId = 0;

// Synchronous version for immediate use in search results
function getCategoryNameSync(categoryCode) {
  if (!categoryCode) {
    return '';
  }
  
  // Get categories from shared state
  const categories = sharedState.get('categories') || {};
  
  // Return the category name if found, otherwise return the code
  return categories[categoryCode] || categoryCode;
}

/**
 * Perform search and display results
 * This function handles the main search functionality
 */
function searchData() {
  // Increment search ID to invalidate any in-flight searches
  activeSearchId++;
  const thisSearchId = activeSearchId;
  
  debugLog?.info('🔍 Search data function called', { 
    module: 'search-engine',
    function: 'searchData',
    searchId: thisSearchId
  });
  
  // Get search term and category
  const searchTerm = (document.getElementById('omni_search')?.value || '').trim();
  const category = document.getElementById('category_select')?.value;
  
  debugLog?.info('🔍 Search parameters:', { 
    module: 'search-engine',
    function: 'searchData',
    searchTerm: searchTerm,
    category: category
  });
  
  // Build structured search parameters
  const searchParams = {
    category: category,  // '*' for all categories
    searchTerm: null,
    advancedFilters: null
  };

  // Apply advanced search filters if advanced search is visible
  if (Dom.isVisible('#advanced-search')) {
    const title = (Dom.val('#title-search') || '').trim();
    const artist = (Dom.val('#artist-search') || '').trim();
    const info = (Dom.val('#info-search') || '').trim();
    const since = Dom.val('#date-search') || '';

    searchParams.advancedFilters = { title, artist, info, since };
  } else {
    // Apply search term filter for basic search
    if (searchTerm.length) {
      searchParams.searchTerm = searchTerm;
    }
  }

  debugLog?.info('🔍 Search parameters:', {
    module: 'search-engine',
    function: 'searchData',
    searchParams: searchParams
  });

  // Clear previous results and show loading indicator
  const thead = document.querySelector('#search_results thead');
  const tbody = document.querySelector('#search_results tbody');
  if (tbody) tbody.querySelectorAll('tr').forEach(tr => tr.remove());
  if (thead) thead.style.display = '';
  
  // Show loading indicator
  if (tbody) {
    const loadingRow = document.createElement('tr');
    loadingRow.id = 'search-loading-indicator';
    const loadingCell = document.createElement('td');
    loadingCell.colSpan = 5;
    loadingCell.style.textAlign = 'center';
    loadingCell.style.padding = '20px';
    const spinnerIcon = document.createElement('i');
    spinnerIcon.className = 'fas fa-spinner fa-spin';
    loadingCell.appendChild(spinnerIcon);
    loadingCell.appendChild(document.createTextNode(' Searching...'));
    loadingRow.appendChild(loadingCell);
    tbody.appendChild(loadingRow);
  }

  // Get font size from shared state
  const fontSize = sharedState.get('fontSize') || 11;

  // Execute search query
  debugLog?.info('🔍 Checking database API availability', { 
    module: 'search-engine',
    function: 'searchData',
    hasSecureAPI: !!window.secureElectronAPI,
    hasDatabase: !!(window.secureElectronAPI && window.secureElectronAPI.database),
    secureAPIKeys: window.secureElectronAPI ? Object.keys(window.secureElectronAPI) : [],
    databaseKeys: window.secureElectronAPI?.database ? Object.keys(window.secureElectronAPI.database) : []
  });
  
  if (window.secureElectronAPI && window.secureElectronAPI.database) {
    debugLog?.info('🔍 Making searchSongs call', {
      module: 'search-engine',
      function: 'searchData',
      searchParams: searchParams
    });

    window.secureElectronAPI.database.searchSongs(searchParams).then(result => {
      // Check if this search is still the active one
      if (thisSearchId !== activeSearchId) {
        debugLog?.info('🔍 Search cancelled, newer search in progress', { 
          module: 'search-engine',
          function: 'searchData',
          thisSearchId: thisSearchId,
          activeSearchId: activeSearchId
        });
        return;
      }
      
      if (result.success) {
        window.secureElectronAPI?.analytics?.trackEvent?.('search_performed', { result_count: result.data?.length || 0 });
        const tbody = document.querySelector('#search_results tbody');

        // Remove loading indicator
        const loadingIndicator = document.getElementById('search-loading-indicator');
        if (loadingIndicator) {
          loadingIndicator.remove();
        }
        
        const fragment = document.createDocumentFragment();
        result.data.forEach((row) => {
          const categoryName = getCategoryNameSync(row.category);
          const tr = document.createElement('tr');
          tr.className = 'song unselectable context-menu';
          tr.draggable = true;
          tr.style.fontSize = `${fontSize}px`;
          tr.setAttribute('songid', String(row.id));
          tr.addEventListener('dragstart', songDrag);

          const tdCategory = document.createElement('td');
          tdCategory.className = 'hide-1';
          tdCategory.textContent = categoryName || '';
          tr.appendChild(tdCategory);

          const tdInfo = document.createElement('td');
          tdInfo.className = 'hide-2';
          tdInfo.textContent = row.info || '';
          tr.appendChild(tdInfo);

          const tdTitle = document.createElement('td');
          tdTitle.style.fontWeight = 'bold';
          tdTitle.textContent = row.title || '';
          tr.appendChild(tdTitle);

          const tdArtist = document.createElement('td');
          tdArtist.style.fontWeight = 'bold';
          tdArtist.textContent = row.artist || '';
          tr.appendChild(tdArtist);

          const tdTime = document.createElement('td');
          tdTime.textContent = row.time || '';
          tr.appendChild(tdTime);

          fragment.appendChild(tr);
        });
        tbody?.appendChild(fragment);
        if (typeof scaleScrollable === 'function') {
          scaleScrollable();
        }
        document.getElementById('omni_search')?.select();
      } else {
        // Check if this search is still the active one
        if (thisSearchId !== activeSearchId) {
          return;
        }
        
        debugLog?.warn('❌ Search query failed:', { 
          module: 'search-engine',
          function: 'searchData',
          error: result.error
        });
        
        // Remove loading indicator on error
        const loadingIndicator = document.getElementById('search-loading-indicator');
        if (loadingIndicator) {
          loadingIndicator.remove();
        }
      }
    }).catch(error => {
      // Check if this search is still the active one
      if (thisSearchId !== activeSearchId) {
        return;
      }

      debugLog?.warn('❌ Database API error:', {
        module: 'search-engine',
        function: 'searchData',
        error: error.message
      });

      // Remove loading indicator on error
      const loadingIndicator = document.getElementById('search-loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.remove();
      }
    });
  } else {
    debugLog?.warn('❌ Database API not available', { 
      module: 'search-engine',
      function: 'searchData',
      hasSecureAPI: !!window.secureElectronAPI,
      hasDatabase: !!(window.secureElectronAPI && window.secureElectronAPI.database)
    });
  }
}

/**
 * Trigger live search with debouncing
 * This function handles the debounced live search functionality
 */
function triggerLiveSearch() {
  // Get searchTimeout from shared state or global fallback
  let searchTimeout = sharedState.get('searchTimeout') || window.searchTimeout;
  
  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  const searchTerm = (document.getElementById('omni_search')?.value || '').trim();

  // Set new timeout and store in shared state and global
  const newTimeout = setTimeout(() => {
    // Check if we have either a search term or advanced search filters
    const hasSearchTerm = searchTerm.length >= 2;
    const hasAdvancedFilters = hasActiveAdvancedFilters();

    if (hasSearchTerm || hasAdvancedFilters) {
      if (typeof liveSearch.performLiveSearch === 'function') {
        liveSearch.performLiveSearch(searchTerm);
      } else {
        debugLog?.warn('performLiveSearch function not available', { 
          module: 'search-engine',
          function: 'triggerLiveSearch'
        });
      }
    } else {
      // Clear results when no search term and no advanced filters
      const thead2 = document.querySelector('#search_results thead');
      const tbody2 = document.querySelector('#search_results tbody');
      if (tbody2) tbody2.querySelectorAll('tr').forEach(tr => tr.remove());
      if (thead2) thead2.style.display = 'none';
    }
  }, 300); // 300ms debounce
  
  // Store timeout in shared state and global
  sharedState.set('searchTimeout', newTimeout);
  window.searchTimeout = newTimeout;
}

// Export individual functions for direct access
export {
  searchData,
  triggerLiveSearch,
  getCategoryNameSync
};

// Default export for module loading
export default {
  searchData,
  triggerLiveSearch,
  getCategoryNameSync
}; 