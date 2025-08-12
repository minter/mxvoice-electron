/**
 * Live Search Module
 * 
 * Handles real-time search functionality that provides instant results
 * as the user types. This module implements debounced search with
 * advanced filtering capabilities.
 */

// Import shared state
import sharedState from '../shared-state.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';
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

// Global variables
let fontSize = 11;

/**
 * Get categories from shared state or fallback to empty object
 * 
 * @returns {Object} - Categories object
 */
function getCategories() {
  try {
    // Try to get categories from shared state first
    const categories = sharedState.get('categories');
    if (categories && Object.keys(categories).length > 0) {
      return categories;
    }
    
    // Fallback to global categories if available
    if (typeof window.categories !== 'undefined' && window.categories) {
      return window.categories;
    }
    
    // Return empty object as last resort
    return {};
  } catch (error) {
    debugLog?.warn('❌ Error getting categories:', { 
      module: 'live-search',
      function: 'getCategories',
      error: error.message
    });
    return {};
  }
}

/**
 * Get category name by code
 * 
 * @param {string} categoryCode - The category code
 * @returns {string} - Category name or code if not found
 */
function getCategoryName(categoryCode) {
  if (!categoryCode) {
    return '';
  }
  
  const categories = getCategories();
  debugLog?.info('🔍 getCategoryName called with:', { 
    module: 'live-search',
    function: 'getCategoryName',
    categoryCode: categoryCode
  });
  debugLog?.info('🔍 Available categories:', { 
    module: 'live-search',
    function: 'getCategoryName',
    categories: categories
  });
  
  const categoryName = categories[categoryCode];
  
  if (categoryName) {
    debugLog?.info('🔍 Found category name:', { 
      module: 'live-search',
      function: 'getCategoryName',
      categoryName: categoryName
    });
    return categoryName;
  }
  
  // If category not found, return the code itself
  debugLog?.warn(`❌ Category not found for code: ${categoryCode}`, { 
    module: 'live-search',
    function: 'getCategoryName',
    categoryCode: categoryCode
  });
  return categoryCode || '';
}

/**
 * Perform live search with real-time results
 * 
 * @param {string} searchTerm - The search term to search for
 */
function performLiveSearch(searchTerm) {
  debugLog?.info("performLiveSearch called with:", { 
    module: 'live-search',
    function: 'performLiveSearch',
    searchTerm: searchTerm
  });

  // Check if we have either a search term or advanced search filters
  const hasSearchTerm = searchTerm && searchTerm.length >= 2;
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

  if (!hasSearchTerm && !hasAdvancedFilters) {
    // Clear results if no search term and no advanced filters
    const tbody = Dom.$('#search_results tbody');
    Array.from(Dom.find(tbody, 'tr')).forEach(tr => Dom.remove(tr));
    Dom.hide('#search_results thead');
    return;
  }

  const tbodyClear = document.querySelector('#search_results tbody');
  if (tbodyClear) tbodyClear.querySelectorAll('tr').forEach(tr => tr.remove());
  const theadShow = document.querySelector('#search_results thead');
  if (theadShow) theadShow.style.display = '';

  const tbody = document.querySelector('#search_results tbody');
  const raw_html = [];
  const query_params = [];
  const query_segments = [];
  let query_string = "";
  const category = document.getElementById('category_select')?.value;

  // Apply category filter if not "All Categories"
  if (category != "*") {
    query_segments.push("category = ?");
    query_params.push(category);
  }

  // Apply advanced search filters if advanced search is visible
  if (adv && adv.offsetParent !== null) {
    const title = (document.getElementById('title-search')?.value || '').trim();
    const artist = (document.getElementById('artist-search')?.value || '').trim();
    const info = (document.getElementById('info-search')?.value || '').trim();
    const since = document.getElementById('date-search')?.value || '';

    if (title.length) {
      query_segments.push("title LIKE ?");
      query_params.push(`%${title}%`);
    }
    if (artist.length) {
      query_segments.push("artist LIKE ?");
      query_params.push(`%${artist}%`);
    }
    if (info.length) {
      query_segments.push("info LIKE ?");
      query_params.push(`%${info}%`);
    }
    if (since.length) {
      query_segments.push("modtime > ?");
      const today = new Date();
      query_params.push(
        Math.round(today.setDate(today.getDate() - since) / 1000)
      );
    }
  } else {
    // Apply omni search filter
    if (searchTerm && searchTerm.length >= 2) {
      query_segments.push("(info LIKE ? OR title LIKE ? OR artist LIKE ?)");
      const search_term = "%" + searchTerm + "%";
      query_params.push(search_term, search_term, search_term);
    }
  }

  if (query_segments.length > 0) {
    query_string = " WHERE " + query_segments.join(" AND ");
  }

  // Use new database API for live search
  if (window.electronAPI && window.electronAPI.database) {
    const sql = "SELECT * from mrvoice" + query_string + " ORDER BY category,info,title,artist LIMIT 50";
    window.electronAPI.database.query(sql, query_params).then(result => {
      if (result.success) {
        debugLog?.info(`🔍 Live search returned ${result.data.length} results`, { 
          module: 'live-search',
          function: 'performLiveSearch',
          resultCount: result.data.length
        });
        const fragment = document.createDocumentFragment();
        result.data.forEach((row) => {
          const categoryName = getCategoryName(row.category);
          debugLog?.info(`🔍 Row category: ${row.category} -> ${categoryName}`, { 
            module: 'live-search',
            function: 'performLiveSearch',
            categoryCode: row.category,
            categoryName: categoryName
          });

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

        // Show indicator if there are more results
        if (result.data.length === 50) {
          const infoRow = document.createElement('tr');
          const infoCell = document.createElement('td');
          infoCell.colSpan = 5;
          infoCell.className = 'text-center text-muted';
          const small = document.createElement('small');
          small.textContent = 'Showing first 50 results. Press Enter for complete search.';
          infoCell.appendChild(small);
          infoRow.appendChild(infoCell);
          (tbody || document.querySelector('#search_results tbody'))?.appendChild(infoRow);
        }

        scale_scrollable();
      } else {
        debugLog?.warn('❌ Live search failed:', { 
          module: 'live-search',
          function: 'performLiveSearch',
          error: result.error
        });
      }
    }).catch(error => {
      debugLog?.warn('❌ Live search database error:', { 
        module: 'live-search',
        function: 'performLiveSearch',
        error: error.message
      });
    });
  }
}

// Export individual functions for direct access
export {
  performLiveSearch,
  getCategories,
  getCategoryName
};

// Default export for module loading
export default {
  performLiveSearch,
  getCategories,
  getCategoryName
}; 