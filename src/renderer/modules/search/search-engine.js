/**
 * Search Engine Module
 * 
 * This module handles the main search functionality including
 * search data retrieval, live search, and category management.
 */

// Import shared state
import sharedState from '../shared-state.js';

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

// Get categories for search functionality
function getCategories() {
  if (window.electronAPI && window.electronAPI.database) {
    return window.electronAPI.database.query("SELECT DISTINCT category FROM mrvoice ORDER BY category").then(result => {
      if (result.success) {
        return result.data.map(row => row.category);
      } else {
        debugLog?.warn('❌ Failed to get categories:', { 
          module: 'search-engine',
          function: 'getCategories',
          error: result.error
        });
        return [];
      }
    }).catch(error => {
      debugLog?.warn('❌ Database API error:', { 
        module: 'search-engine',
        function: 'getCategories',
        error: error.message
      });
      return [];
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      const stmt = db.prepare("SELECT DISTINCT category FROM mrvoice ORDER BY category");
      return stmt.all().map(row => row.category);
    }
    return [];
  }
}

// Get category name for display
function getCategoryName(categoryCode) {
  if (window.electronAPI && window.electronAPI.database) {
    return window.electronAPI.database.query("SELECT description FROM categories WHERE code = ?", [categoryCode]).then(result => {
      if (result.success && result.data.length > 0) {
        return result.data[0].description;
      } else {
        return categoryCode;
      }
    }).catch(error => {
      debugLog?.warn('❌ Failed to get category name:', { 
        module: 'search-engine',
        function: 'getCategoryName',
        error: error.message
      });
      return categoryCode;
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      const stmt = db.prepare("SELECT description FROM categories WHERE code = ?");
      const row = stmt.get(categoryCode);
      return row ? row.description : categoryCode;
    }
    return categoryCode;
  }
}

// Synchronous version for immediate use
function getCategoryNameSync(categoryCode) {
  if (typeof db !== 'undefined') {
    try {
      const stmt = db.prepare("SELECT description FROM categories WHERE code = ?");
      const row = stmt.get(categoryCode);
      return row ? row.description : categoryCode;
    } catch (error) {
      debugLog?.warn('❌ Failed to get category name synchronously:', { 
        module: 'search-engine',
        function: 'getCategoryNameSync',
        error: error.message
      });
      return categoryCode;
    }
  }
  return categoryCode;
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
  const searchTerm = $("#omni_search").val().trim();
  const category = $("#category_select").val();
  
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
  if ($("#advanced-search").is(":visible")) {
    const title = $("#title-search").val().trim();
    const artist = $("#artist-search").val().trim();
    const info = $("#info-search").val().trim();
    const since = $("#date-search").val();

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
      querySegments.push("date >= ?");
      queryParams.push(since);
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
  $("#search_results tbody").find("tr").remove();
  $("#search_results thead").show();

  // Get font size from shared state
  const fontSize = sharedState.get('fontSize') || 11;

  // Execute search query
  if (window.electronAPI && window.electronAPI.database) {
    window.electronAPI.database.query("SELECT * from mrvoice" + queryString + " ORDER BY category,info,title,artist", queryParams).then(result => {
      if (result.success) {
        const raw_html = [];
        result.data.forEach((row) => {
          const categoryName = getCategoryNameSync(row.category);
          raw_html.push(
            `<tr draggable='true' ondragstart='songDrag(event)' style='font-size: ${fontSize}px' class='song unselectable context-menu' songid='${
              row.id
            }'><td class='hide-1'>${categoryName}</td><td class='hide-2'>${
              row.info || ""
            }</td><td style='font-weight: bold'>${
              row.title || ""
            }</td><td style='font-weight:bold'>${row.artist || ""}</td><td>${
              row.time
            }</td></tr>`
          );
        });
        $("#search_results").append(raw_html.join(""));
        if (typeof scaleScrollable === 'function') {
          scaleScrollable();
        }
        $("#omni_search").select();
        $("#category_select").prop("selectedIndex", 0);
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
        rows.forEach((row) => {
          const categoryName = getCategoryNameSync(row.category);
          raw_html.push(
            `<tr draggable='true' ondragstart='songDrag(event)' style='font-size: ${fontSize}px' class='song unselectable context-menu' songid='${
              row.id
            }'><td class='hide-1'>${categoryName}</td><td class='hide-2'>${
              row.info || ""
            }</td><td style='font-weight: bold'>${
              row.title || ""
            }</td><td style='font-weight:bold'>${row.artist || ""}</td><td>${
              row.time
            }</td></tr>`
          );
        });
        $("#search_results").append(raw_html.join(""));
        if (typeof scaleScrollable === 'function') {
          scaleScrollable();
        }
        $("#omni_search").select();
        $("#category_select").prop("selectedIndex", 0);
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      const stmt = db.prepare(
        "SELECT * from mrvoice" +
          queryString +
          " ORDER BY category,info,title,artist"
      );
      const rows = stmt.all(queryParams);
      rows.forEach((row) => {
        const categoryName = getCategoryNameSync(row.category);
        raw_html.push(
          `<tr draggable='true' ondragstart='songDrag(event)' style='font-size: ${fontSize}px' class='song unselectable context-menu' songid='${
            row.id
          }'><td class='hide-1'>${categoryName}</td><td class='hide-2'>${
            row.info || ""
          }</td><td style='font-weight: bold'>${
            row.title || ""
          }</td><td style='font-weight:bold'>${row.artist || ""}</td><td>${
            row.time
          }</td></tr>`
        );
      });
      $("#search_results").append(raw_html.join(""));
      if (typeof scaleScrollable === 'function') {
        scaleScrollable();
      }
      $("#omni_search").select();
      $("#category_select").prop("selectedIndex", 0);
    }
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
  
  const searchTerm = $("#omni_search").val().trim();

  // Set new timeout and store in shared state and global
  const newTimeout = setTimeout(() => {
    // Check if we have either a search term or advanced search filters
    const hasSearchTerm = searchTerm.length >= 2;
    const hasAdvancedFilters = false;

    if ($("#advanced-search").is(":visible")) {
      const title = $("#title-search").val().trim();
      const artist = $("#artist-search").val().trim();
      const info = $("#info-search").val().trim();
      const since = $("#date-search").val();
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
      $("#search_results tbody").find("tr").remove();
      $("#search_results thead").hide();
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
  getCategories,
  getCategoryName,
  getCategoryNameSync
};

// Default export for module loading
export default {
  searchData,
  triggerLiveSearch,
  getCategories,
  getCategoryName,
  getCategoryNameSync
}; 