/**
 * Search Engine Module
 * 
 * This module handles the main search functionality including
 * search data retrieval, live search, and category management.
 */

// Import shared state
import sharedState from '../shared-state.js';
import Dom from '../dom-utils/index.js';

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

// Import live search functionality
import * as liveSearch from './live-search.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';

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
  debugLog?.info('🔍 Search data function called', { 
    module: 'search-engine',
    function: 'searchData'
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
  
  // Build query string and parameters
  const queryParams = [];
  const querySegments = [];
  let queryString = "";

  // Apply category filter if not "All Categories"
  if (category != "*") {
    querySegments.push("category = ?");
    queryParams.push(category);
  }

  // Apply advanced search filters if advanced search is visible
  if (Dom.isVisible('#advanced-search')) {
    const title = (Dom.val('#title-search') || '').trim();
    const artist = (Dom.val('#artist-search') || '').trim();
    const info = (Dom.val('#info-search') || '').trim();
    const since = Dom.val('#date-search') || '';

    if (title.length) {
      querySegments.push("title LIKE ?");
      queryParams.push(`%${title}%`);
    }
    if (artist.length) {
      querySegments.push("artist LIKE ?");
      queryParams.push(`%${artist}%`);
    }
    if (info.length) {
      querySegments.push("info LIKE ?");
      queryParams.push(`%${info}%`);
    }
    if (since.length) {
      let thresholdSeconds = null;
      if (/^\d+$/.test(since)) {
        // since is number of days
        const days = parseInt(since, 10);
        thresholdSeconds = Math.floor(Date.now() / 1000) - (days * 86400);
      } else {
        // since is a date string
        const parsed = Date.parse(since);
        if (!Number.isNaN(parsed)) {
          thresholdSeconds = Math.floor(parsed / 1000);
        }
      }
      if (thresholdSeconds !== null) {
        querySegments.push("modtime >= ?");
        queryParams.push(thresholdSeconds);
      }
    }
  } else {
    // Apply search term filter for basic search
    if (searchTerm.length) {
      querySegments.push("(title LIKE ? OR artist LIKE ? OR info LIKE ?)");
      queryParams.push(`%${searchTerm}%`);
      queryParams.push(`%${searchTerm}%`);
      queryParams.push(`%${searchTerm}%`);
    }
  }

  // Build final query string
  if (querySegments.length > 0) {
    queryString = " WHERE " + querySegments.join(" AND ");
  }

  debugLog?.info('🔍 Query string:', { 
    module: 'search-engine',
    function: 'searchData',
    queryString: queryString
  });
  debugLog?.info('🔍 Query parameters:', { 
    module: 'search-engine',
    function: 'searchData',
    queryParams: queryParams
  });

  // Clear previous results
  const thead = document.querySelector('#search_results thead');
  const tbody = document.querySelector('#search_results tbody');
  if (tbody) tbody.querySelectorAll('tr').forEach(tr => tr.remove());
  if (thead) thead.style.display = '';

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
    debugLog?.info('🔍 Making database query', { 
      module: 'search-engine',
      function: 'searchData',
      sql: "SELECT * from mrvoice" + queryString + " ORDER BY category,info,title,artist",
      params: queryParams
    });
    
    window.secureElectronAPI.database.query("SELECT * from mrvoice" + queryString + " ORDER BY category,info,title,artist", queryParams).then(result => {
      if (result.success) {
        const tbody = document.querySelector('#search_results tbody');
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
        debugLog?.warn('❌ Search query failed:', { 
          module: 'search-engine',
          function: 'searchData',
          error: result.error
        });
      }
    }).catch(error => {
      debugLog?.warn('❌ Database API error:', { 
        module: 'search-engine',
        function: 'searchData',
        error: error.message
      });
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        const stmt = db.prepare(
          "SELECT * from mrvoice" +
            queryString +
            " ORDER BY category,info,title,artist"
        );
        const rows = stmt.all(queryParams);
        const tbody2 = document.querySelector('#search_results tbody');
        const fragment2 = document.createDocumentFragment();
        rows.forEach((row) => {
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

          fragment2.appendChild(tr);
        });
        tbody2?.appendChild(fragment2);
        if (typeof scaleScrollable === 'function') {
          scaleScrollable();
        }
        document.getElementById('omni_search')?.select();
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
    let hasAdvancedFilters = false;

    const adv = document.getElementById('advanced-search');
    if (adv && adv.offsetParent !== null) {
      const title = (document.getElementById('title-search')?.value || '').trim();
      const artist = (document.getElementById('artist-search')?.value || '').trim();
      const info = (document.getElementById('info-search')?.value || '').trim();
      const since = document.getElementById('date-search')?.value || '';
      hasAdvancedFilters =
        title.length > 0 ||
        artist.length > 0 ||
        info.length > 0 ||
        since.length > 0;
    }

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