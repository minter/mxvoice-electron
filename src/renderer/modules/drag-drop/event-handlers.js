/**
 * Drag & Drop Event Handlers
 * 
 * Handles UI event handlers for drag and drop functionality
 */

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

  // Holding tank drop handlers
  $("#holding_tank").on("drop", function (event) {
    $(event.originalEvent.target).removeClass("dropzone");
    if (!event.originalEvent.dataTransfer.getData("text").length) return;
    holdingTankDrop(event.originalEvent);
  });

  $("#holding_tank").on("dragover", function (event) {
    allowHotkeyDrop(event.originalEvent);
    $(event.originalEvent.target).addClass("dropzone");
  });

  $("#holding_tank").on("dragleave", function (event) {
    allowHotkeyDrop(event.originalEvent);
    $(event.originalEvent.target).removeClass("dropzone");
  });

  // Column drag handlers
  $(".card-header").on("dragover", function (event) {
    event.preventDefault();
  });

  $(".card-header").on("drop", function (event) {
    if (event.originalEvent.dataTransfer.getData("text").length) return;
    var original_column = $(
      `#${event.originalEvent.dataTransfer.getData("application/x-moz-node")}`
    );
    var target_column = $(event.target).closest(".col");
    if (original_column.prop("id") == target_column.prop("id")) return;
    var columns = $("#top-row").children();
    if (columns.index(original_column) > columns.index(target_column)) {
      target_column.before(original_column.detach());
    } else {
      target_column.after(original_column.detach());
    }
    original_column.addClass("animate__animated animate__jello");
    var new_column_order = $("#top-row")
      .children()
      .map(function () {
        return $(this).prop("id");
      })
      .get();
    // Use new store API for column order
    window.electronAPI.store.set("column_order", new_column_order).then(result => {
      if (result.success) {
        console.log('✅ Column order saved successfully');
      } else {
        console.warn('❌ Failed to save column order:', result.error);
        // Fallback to legacy store access
        store.set("column_order", new_column_order);
      }
    }).catch(error => {
      console.warn('❌ Column order save error:', error);
      // Fallback to legacy store access
      store.set("column_order", new_column_order);
    });
  });

  console.log('✅ Drag & Drop Event Handlers initialized');
} 