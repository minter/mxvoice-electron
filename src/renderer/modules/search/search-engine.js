/**
 * Search Engine Module
 * 
 * This module handles the main search functionality including
 * search data retrieval, live search, and category management.
 */

// Import shared state
import sharedState from '../shared-state.js';

// Import live search functionality
import * as liveSearch from './live-search.js';

// Get categories for search functionality
function getCategories() {
  if (window.electronAPI && window.electronAPI.database) {
    return window.electronAPI.database.query("SELECT DISTINCT category FROM mrvoice ORDER BY category").then(result => {
      if (result.success) {
        return result.data.map(row => row.category);
      } else {
        console.warn('❌ Failed to get categories:', result.error);
        return [];
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      return [];
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare("SELECT DISTINCT category FROM mrvoice ORDER BY category");
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
      console.warn('❌ Failed to get category name:', error);
      return categoryCode;
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare("SELECT description FROM categories WHERE code = ?");
      var row = stmt.get(categoryCode);
      return row ? row.description : categoryCode;
    }
    return categoryCode;
  }
}

// Synchronous version for immediate use
function getCategoryNameSync(categoryCode) {
  if (typeof db !== 'undefined') {
    try {
      var stmt = db.prepare("SELECT description FROM categories WHERE code = ?");
      var row = stmt.get(categoryCode);
      return row ? row.description : categoryCode;
    } catch (error) {
      console.warn('❌ Failed to get category name synchronously:', error);
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
  console.log('🔍 Search data function called');
  
  // Get search term and category
  var searchTerm = $("#omni_search").val().trim();
  var category = $("#category_select").val();
  
  console.log('🔍 Search parameters:', { searchTerm, category });
  
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

  console.log('🔍 Query string:', queryString);
  console.log('🔍 Query parameters:', queryParams);

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
        console.warn('❌ Search query failed:', result.error);
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare(
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
      var stmt = db.prepare(
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
  
  var searchTerm = $("#omni_search").val().trim();

  // Set new timeout and store in shared state and global
  const newTimeout = setTimeout(() => {
    // Check if we have either a search term or advanced search filters
    var hasSearchTerm = searchTerm.length >= 2;
    var hasAdvancedFilters = false;

    if ($("#advanced-search").is(":visible")) {
      var title = $("#title-search").val().trim();
      var artist = $("#artist-search").val().trim();
      var info = $("#info-search").val().trim();
      var since = $("#date-search").val();
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
        console.warn('performLiveSearch function not available');
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