/**
 * Bulk Operations Event Handlers
 * 
 * Handles UI event handlers for bulk operations functionality
 */

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

/**
 * Setup all bulk operations event handlers
 */
export function setupBulkEventHandlers() {
  // Handle bulk add category dropdown change
  $("#bulk-add-category")
    .change(function () {
      $(this)
        .find("option:selected")
        .each(function () {
          var optionValue = $(this).attr("value");
          if (optionValue == "--NEW--") {
            $("#bulkSongFormNewCategory").show();
            $("#bulk-song-form-new-category").attr("required", "required");
          } else {
            $("#bulkSongFormNewCategory").hide();
            $("#bulk-song-form-new-category").removeAttr("required");
          }
        });
    })
    .change();

  // Handle bulk add modal hidden event
  $("#bulkAddModal").on("hidden.bs.modal", function (e) {
    $("#bulkSongFormNewCategory").hide();
    $("#bulk-song-form-new-category").val("");
  });

  debugLog?.info('Bulk Operations Event Handlers initialized', { 
    module: 'bulk-operations-event-handlers',
    function: 'setupBulkEventHandlers'
  });
} 