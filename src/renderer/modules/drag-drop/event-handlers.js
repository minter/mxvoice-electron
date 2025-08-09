/**
 * Drag & Drop Event Handlers
 * 
 * Handles UI event handlers for drag and drop functionality
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
 * Setup all drag and drop event handlers
 */
export function setupDragDropEventHandlers() {
  // Hotkey drop handlers
  $(".hotkeys li").on("drop", function (event) {
    $(this).removeClass("drop_target");
    if (!event.originalEvent.dataTransfer.getData("text").length) return;
    hotkeyDrop(event.originalEvent);
  });

  $(".hotkeys li").on("dragover", function (event) {
    $(this).addClass("drop_target");
    allowHotkeyDrop(event.originalEvent);
  });

  $(".hotkeys li").on("dragleave", function (event) {
    $(this).removeClass("drop_target");
  });

  // Holding tank drop handlers - target the container and list items
  $("#holding_tank, .holding_tank li").on("drop", function (event) {
    debugLog?.info('Holding tank drop event triggered', { 
      module: 'drag-drop-event-handlers',
      function: 'setupDragDropEventHandlers'
    });
    $(event.originalEvent.target).removeClass("dropzone");
    if (!event.originalEvent.dataTransfer.getData("text").length) return;
    holdingTankDrop(event.originalEvent);
  });

  $("#holding_tank, .holding_tank li").on("dragover", function (event) {
    debugLog?.info('Holding tank dragover event triggered', { 
      module: 'drag-drop-event-handlers',
      function: 'setupDragDropEventHandlers'
    });
    allowHotkeyDrop(event.originalEvent);
    $(event.originalEvent.target).addClass("dropzone");
  });

  $("#holding_tank, .holding_tank li").on("dragleave", function (event) {
    debugLog?.info('Holding tank dragleave event triggered', { 
      module: 'drag-drop-event-handlers',
      function: 'setupDragDropEventHandlers'
    });
    allowHotkeyDrop(event.originalEvent);
    $(event.originalEvent.target).removeClass("dropzone");
  });

  // Column drag handlers
  $(".card-header").on("dragover", function (event) {
    event.preventDefault();
  });

  $(".card-header").on("drop", function (event) {
    if (event.originalEvent.dataTransfer.getData("text").length) return;
    const original_column = $(
      `#${event.originalEvent.dataTransfer.getData("application/x-moz-node")}`
    );
    const target_column = $(event.target).closest(".col");
    if (original_column.prop("id") == target_column.prop("id")) return;
    const columns = $("#top-row").children();
    if (columns.index(original_column) > columns.index(target_column)) {
      target_column.before(original_column.detach());
    } else {
      target_column.after(original_column.detach());
    }
    original_column.addClass("animate__animated animate__jello");
    const new_column_order = $("#top-row")
      .children()
      .map(function () {
        return $(this).prop("id");
      })
      .get();
    // Use new store API for column order
    window.electronAPI.store.set("column_order", new_column_order).then(result => {
      if (result.success) {
        debugLog?.info('Column order saved successfully', { 
          module: 'drag-drop-event-handlers',
          function: 'setupDragDropEventHandlers'
        });
      } else {
        debugLog?.warn('Failed to save column order', { 
          module: 'drag-drop-event-handlers',
          function: 'setupDragDropEventHandlers',
          error: result.error
        });
        // Fallback to legacy store access
        store.set("column_order", new_column_order);
      }
    }).catch(error => {
      debugLog?.warn('Column order save error', { 
        module: 'drag-drop-event-handlers',
        function: 'setupDragDropEventHandlers',
        error: error
      });
      // Fallback to legacy store access
      store.set("column_order", new_column_order);
    });
  });

  debugLog?.info('Drag & Drop Event Handlers initialized', { 
    module: 'drag-drop-event-handlers',
    function: 'setupDragDropEventHandlers'
  });
} 