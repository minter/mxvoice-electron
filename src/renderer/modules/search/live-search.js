/**
 * Live Search Module
 * 
 * Handles real-time search functionality that provides instant results
 * as the user types. This module implements debounced search with
 * advanced filtering capabilities.
 */

/**
 * Perform live search with real-time results
 * 
 * @param {string} searchTerm - The search term to search for
 */
function performLiveSearch(searchTerm) {
  console.log("performLiveSearch called with:", searchTerm);

  // Check if we have either a search term or advanced search filters
  var hasSearchTerm = searchTerm && searchTerm.length >= 2;
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

  if (!hasSearchTerm && !hasAdvancedFilters) {
    // Clear results if no search term and no advanced filters
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    return;
  }

  $("#search_results tbody").find("tr").remove();
  $("#search_results thead").show();

  var raw_html = [];
  var query_params = [];
  var query_segments = [];
  var query_string = "";
  var category = $("#category_select").val();

  // Apply category filter if not "All Categories"
  if (category != "*") {
    query_segments.push("category = ?");
    query_params.push(category);
  }

  // Apply advanced search filters if advanced search is visible
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
  }

  // Add the live search term to the query (only if we have a search term)
  if (hasSearchTerm) {
    var search_term = "%" + searchTerm + "%";
    query_segments.push("(info LIKE ? OR title LIKE ? OR artist like ?)");
    query_params.push(search_term, search_term, search_term);
  }

  // Build the complete query string
  if (query_segments.length != 0) {
    query_string = " WHERE " + query_segments.join(" AND ");
  }

  console.log("Live search query:", query_string);
  console.log("Live search params:", query_params);

  // Fast, limited search for live results with filters applied
  var stmt = db.prepare(
    "SELECT * from mrvoice" +
      query_string +
      " ORDER BY category,info,title,artist LIMIT 50"
  );
  const rows = stmt.all(query_params);

  console.log("Live search results:", rows.length);

  rows.forEach((row) => {
    raw_html.push(
      `<tr draggable='true' ondragstart='songDrag(event)' style='font-size: ${fontSize}px' class='song unselectable context-menu' songid='${
        row.id
      }'><td class='hide-1'>${
        categories[row.category]
      }</td><td class='hide-2'>${
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

// Export individual functions for direct access
export {
  performLiveSearch
};

// Default export for module loading
export default {
  performLiveSearch
}; 