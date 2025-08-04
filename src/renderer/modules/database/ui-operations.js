/**
 * UI Operations Module
 * 
 * Handles UI scaling and adjustments for database-related operations.
 * This module manages the scaling of scrollable elements and other
 * UI adjustments needed when database content changes.
 */

/**
 * Scale scrollable elements
 * Adjusts the height of scrollable elements based on window size and advanced search visibility
 */
function scaleScrollable() {
  var advanced_search_height = $("#advanced-search").is(":visible") ? 38 : 0;
  if ($("#advanced-search").is(":visible")) {
    advanced_search_height = 38;
  }
  $(".table-wrapper-scroll-y").height(
    $(window).height() - 240 - advanced_search_height + "px"
  );
}

module.exports = {
  scaleScrollable
}; 