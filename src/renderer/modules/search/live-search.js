/**
 * Live Search Module
 * 
 * Handles real-time search functionality that provides instant results
 * as the user types. This module implements debounced search with
 * advanced filtering capabilities.
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

  if (!hasSearchTerm && !hasAdvancedFilters) {
    // Clear results if no search term and no advanced filters
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    return;
  }

  $("#search_results tbody").find("tr").remove();
  $("#search_results thead").show();

  const raw_html = [];
  const query_params = [];
  const query_segments = [];
  let query_string = "";
  const category = $("#category_select").val();

  // Apply category filter if not "All Categories"
  if (category != "*") {
    query_segments.push("category = ?");
    query_params.push(category);
  }

  // Apply advanced search filters if advanced search is visible
  if ($("#advanced-search").is(":visible")) {
    const title = $("#title-search").val().trim();
    const artist = $("#artist-search").val().trim();
    const info = $("#info-search").val().trim();
    const since = $("#date-search").val();

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
        result.data.forEach((row) => {
          const categoryName = getCategoryName(row.category);
          debugLog?.info(`🔍 Row category: ${row.category} -> ${categoryName}`, { 
            module: 'live-search',
            function: 'performLiveSearch',
            categoryCode: row.category,
            categoryName: categoryName
          });
          
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

        // Show indicator if there are more results
        if (result.data.length === 50) {
          $("#search_results").append(
            `<tr><td colspan="5" class="text-center text-muted"><small>Showing first 50 results. Press Enter for complete search.</small></td></tr>`
          );
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
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        const stmt = db.prepare(
          "SELECT * from mrvoice" +
            query_string +
            " ORDER BY category,info,title,artist LIMIT 50"
        );
        const rows = stmt.all(query_params);

        debugLog?.info("Live search results:", { 
          module: 'live-search',
          function: 'performLiveSearch',
          resultCount: rows.length
        });

        rows.forEach((row) => {
          const categoryName = getCategoryName(row.category);
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

        // Show indicator if there are more results
        if (rows.length === 50) {
          $("#search_results").append(
            `<tr><td colspan="5" class="text-center text-muted"><small>Showing first 50 results. Press Enter for complete search.</small></td></tr>`
          );
        }

        scale_scrollable();
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      const stmt = db.prepare(
        "SELECT * from mrvoice" +
          query_string +
          " ORDER BY category,info,title,artist LIMIT 50"
      );
      const rows = stmt.all(query_params);

      debugLog?.info("Live search results:", { 
        module: 'live-search',
        function: 'performLiveSearch',
        resultCount: rows.length
      });

      rows.forEach((row) => {
        const categoryName = getCategoryName(row.category);
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

      // Show indicator if there are more results
      if (rows.length === 50) {
        $("#search_results").append(
          `<tr><td colspan="5" class="text-center text-muted"><small>Showing first 50 results. Press Enter for complete search.</small></td></tr>`
        );
      }

      scale_scrollable();
    }
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