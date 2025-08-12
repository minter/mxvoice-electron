/**
 * Drag & Drop Event Handlers
 * 
 * Handles UI event handlers for drag and drop functionality
 */

// Import drag and drop functions
import { hotkeyDrop, holdingTankDrop, allowHotkeyDrop } from './drag-drop-functions.js';

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

// Import secure adapters
import { secureStore } from '../adapters/secure-adapter.js';

/**
 * Setup all drag and drop event handlers
 */
export function setupDragDropEventHandlers() {
  // Hotkey drop handlers are owned by the hotkeys module to avoid duplicate bindings

  // Holding tank drop handlers - target the container and list items
  document.querySelectorAll('#holding_tank, .holding_tank li').forEach(target => {
    target.addEventListener('drop', (e) => {
    debugLog?.info('Holding tank drop event triggered', { 
      module: 'drag-drop-event-handlers',
      function: 'setupDragDropEventHandlers'
    });
      (e.target?.classList)?.remove('dropzone');
      const dt = e.dataTransfer || e.originalEvent?.dataTransfer;
      if (!dt || !dt.getData('text')?.length) return;
      holdingTankDrop(e);
    });

    target.addEventListener('dragover', (e) => {
    debugLog?.info('Holding tank dragover event triggered', { 
      module: 'drag-drop-event-handlers',
      function: 'setupDragDropEventHandlers'
    });
      allowHotkeyDrop(e);
      (e.target?.classList)?.add('dropzone');
    });

    target.addEventListener('dragleave', (e) => {
    debugLog?.info('Holding tank dragleave event triggered', { 
      module: 'drag-drop-event-handlers',
      function: 'setupDragDropEventHandlers'
    });
      allowHotkeyDrop(e);
      (e.target?.classList)?.remove('dropzone');
    });
  });

  // Column drag handlers
  document.querySelectorAll('.card-header').forEach(header => {
    header.addEventListener('dragover', (e) => e.preventDefault());

    header.addEventListener('drop', (e) => {
      const dt = e.dataTransfer || e.originalEvent?.dataTransfer;
      if (dt && dt.getData('text')?.length) return;
      const originalId = dt?.getData('application/x-moz-node');
      if (!originalId) return;
      const original_column = document.getElementById(originalId);
      const target_column = (e.target instanceof Element) ? e.target.closest('.col') : null;
      if (!original_column || !target_column) return;
      if (original_column.id === target_column.id) return;
      const columns = Array.from(document.getElementById('top-row')?.children || []);
      if (columns.indexOf(original_column) > columns.indexOf(target_column)) {
        target_column.parentNode?.insertBefore(original_column, target_column);
      } else {
        target_column.parentNode?.insertBefore(original_column, target_column.nextSibling);
      }
      original_column.classList.add('animate__animated', 'animate__jello');
      const new_column_order = Array.from(document.getElementById('top-row')?.children || []).map(el => el.id);
    // Use new store API for column order
    secureStore.set("column_order", new_column_order).then(result => {
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
      }
    }).catch(error => {
      debugLog?.warn('Column order save error', { 
        module: 'drag-drop-event-handlers',
        function: 'setupDragDropEventHandlers',
        error: error
      });
    });
    });
  });

  debugLog?.info('Drag & Drop Event Handlers initialized', { 
    module: 'drag-drop-event-handlers',
    function: 'setupDragDropEventHandlers'
  });
} 