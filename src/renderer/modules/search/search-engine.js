/**
 * Search Engine Module
 * 
 * Handles search functionality including live search, debouncing,
 * and database queries for the MxVoice Electron application.
 */

// Import dependencies
import * as liveSearch from './live-search.js';

// Module-level variables
let searchTimeout = null;
let fontSize = 11; // Default font size

/**
 * Get all available categories from the database
 * 
 * @returns {Array} Array of category objects
 */
function getCategories() {
  const categories = [];
  
  // Try to use the new database API first
  if (window.electronAPI && window.electronAPI.store) {
    try {
      window.electronAPI.store.getCategories().then((result) => {
        if (result && result.length > 0) {
          result.forEach((category) => {
            categories.push({
              code: category.code,
              description: category.description
            });
          });
        }
      }).catch(error => {
        console.warn('Failed to get categories from store:', error);
      });
    } catch (error) {
      console.warn('Error accessing store for categories:', error);
    }
  }
  
  // Fallback to legacy database access
  if (typeof db !== 'undefined') {
    try {
      const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
      for (const row of stmt.iterate()) {
        categories.push({
          code: row.code,
          description: row.description
        });
      }
    } catch (error) {
      console.warn('Failed to get categories from legacy database:', error);
    }
  }
  
  return categories;
}

/**
 * Get category name by code
 * 
 * @param {string} categoryCode - The category code
 * @returns {string} The category description
 */
function getCategoryName(categoryCode) {
  if (!categoryCode) return "Unknown";
  
  // Try to use the new database API first
  if (window.electronAPI && window.electronAPI.store) {
    try {
      // For now, return the code as fallback
      // In a full implementation, you'd query the store for the category name
      return categoryCode;
    } catch (error) {
      console.warn('Failed to get category name from store:', error);
    }
  }
  
  // Fallback to legacy database access
  if (typeof db !== 'undefined') {
    try {
      const stmt = db.prepare("SELECT description FROM categories WHERE code = ?");
      const result = stmt.get(categoryCode);
      return result ? result.description : categoryCode;
    } catch (error) {
      console.warn('Failed to get category name from legacy database:', error);
      return categoryCode;
    }
  }
  
  return categoryCode;
}

/**
 * Perform a search on the database
 * This is the main search function that handles both basic and advanced search
 */
function searchData() {
  console.log('🔍 searchData called');
  $("#search_results tbody").find("tr").remove();
  $("#search_results thead").show();

  var raw_html = [];
  var query_params = [];
  var query_segments = [];
  var query_string = "";
  var category = $("#category_select").val();

  if (category != "*") {
    query_segments.push("category = ?");
    query_params.push(category);
  }

  if ($("#advanced-search").is(":visible")) {
    var title = $("#title-search").val().trim();
    var artist = $("#artist-search").val().trim();
    var info = $("#info-search").val().trim();
    var since = $("#date-search").val();
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
      var today = new Date();
      query_params.push(
        Math.round(today.setDate(today.getDate() - since) / 1000)
      );
    }
    if (query_segments.length != 0) {
      query_string = " WHERE " + query_segments.join(" AND ");
    }
  } else {
    var omni = $("#omni_search").val().trim();
    var search_term = "%" + omni + "%";
    if (omni != "") {
      query_segments.push("(info LIKE ? OR title LIKE ? OR artist like ?)");
      query_params.push(search_term, search_term, search_term);
    }
    if (query_segments.length != 0) {
      query_string = " WHERE " + query_segments.join(" AND ");
    }
  }

  console.log("Query string is" + query_string);

  // Use new database API for search query
  if (window.electronAPI && window.electronAPI.database) {
    const sql = "SELECT * from mrvoice" + query_string + " ORDER BY category,info,title,artist";
    window.electronAPI.database.query(sql, query_params).then(result => {
      if (result.success) {
        console.log(`🔍 Search returned ${result.data.length} results`);
        result.data.forEach((row) => {
          const categoryName = getCategoryName(row.category);
          console.log(`🔍 Row category: ${row.category} -> ${categoryName}`);
          
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
        console.warn('❌ Failed to search songs:', result.error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          var stmt = db.prepare(
            "SELECT * from mrvoice" +
              query_string +
              " ORDER BY category,info,title,artist"
          );
          const rows = stmt.all(query_params);
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
        if (typeof scaleScrollable === 'function') {
          scaleScrollable();
        }
        $("#omni_search").select();
          $("#category_select").prop("selectedIndex", 0);
        }
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare(
          "SELECT * from mrvoice" +
            query_string +
            " ORDER BY category,info,title,artist"
        );
        const rows = stmt.all(query_params);
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
          query_string +
          " ORDER BY category,info,title,artist"
      );
      const rows = stmt.all(query_params);
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
  clearTimeout(searchTimeout);
  var searchTerm = $("#omni_search").val().trim();

  searchTimeout = setTimeout(() => {
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
}

// Export individual functions for direct access
export {
  searchData,
  triggerLiveSearch,
  getCategories,
  getCategoryName
};

// Default export for module loading
export default {
  searchData,
  triggerLiveSearch,
  getCategories,
  getCategoryName
}; 