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

  // Column drag and drop handlers - improved with better visual feedback
  setupColumnDragAndDrop();

  debugLog?.info('Drag & Drop Event Handlers initialized', { 
    module: 'drag-drop-event-handlers',
    function: 'setupDragDropEventHandlers'
  });
}

/**
 * Setup improved column drag and drop functionality
 */
function setupColumnDragAndDrop() {
  const topRow = document.getElementById('top-row');
  if (!topRow) return;

  // Create drop zones between columns
  createColumnDropZones();

  // Add drag and drop handlers to column HEADERS only (not entire columns)
  const columnHeaders = topRow.querySelectorAll('.col .card-header');
  columnHeaders.forEach(header => {
    // Make only the header draggable for column reordering
    header.addEventListener('dragover', handleColumnDragOver);
    header.addEventListener('dragleave', handleColumnDragLeave);
    header.addEventListener('drop', handleColumnDrop);
    
    // Add drag start handler to the header
    header.addEventListener('dragstart', handleColumnDragStart);
    
    // Add drag end handler to clean up dragging state
    header.addEventListener('dragend', handleColumnDragEnd);
    
    // Make the header draggable instead of the entire column
    const column = header.closest('.col');
    if (column) {
      header.setAttribute('draggable', 'true');
    }
  });

  // Add handlers for the drop zones between columns
  const dropZones = topRow.querySelectorAll('.column-drop-zone');
  dropZones.forEach(zone => {
    zone.addEventListener('dragover', handleDropZoneDragOver);
    zone.addEventListener('dragleave', handleDropZoneDragLeave);
    zone.addEventListener('drop', handleDropZoneDrop);
  });
}

/**
 * Create visual drop zones between columns
 */
function createColumnDropZones() {
  const topRow = document.getElementById('top-row');
  if (!topRow) return;

  // Remove existing drop zones
  topRow.querySelectorAll('.column-drop-zone').forEach(zone => zone.remove());

  // Add drop zones between columns (look for columns by ID pattern)
  const columns = topRow.querySelectorAll('#holding-tank-column, #search-column, #hotkeys-column');
  columns.forEach((column, index) => {
    if (index > 0) {
      const dropZone = document.createElement('div');
      dropZone.className = 'column-drop-zone';
      dropZone.setAttribute('data-position', index);
      topRow.insertBefore(dropZone, column);
    }
  });
}

/**
 * Handle column drag start
 */
function handleColumnDragStart(event) {
  const header = event.currentTarget;
  const column = header.closest('.col');
  if (!column) return;
  
  const columnId = column.id;
  event.dataTransfer.setData('application/x-moz-node', columnId);
  event.dataTransfer.effectAllowed = 'move';
  
  // Add dragging class to the column being dragged
  column.classList.add('column-dragging');
  
  debugLog?.info('Starting drag for column', { 
    module: 'drag-drop-event-handlers',
    function: 'handleColumnDragStart',
    columnId: columnId
  });
}

/**
 * Handle column drag over
 */
function handleColumnDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  
  const header = event.currentTarget;
  const targetColumn = header.closest('.col');
  
  if (!targetColumn) return;
  
  // Add drop indicator - we'll check the dragged column ID during drop
  targetColumn.classList.add('column-drop-target');
}

/**
 * Handle column drag leave
 */
function handleColumnDragLeave(event) {
  const header = event.currentTarget;
  const targetColumn = header.closest('.col');
  
  if (!targetColumn) return;
  
  // Only remove class if we're leaving the column entirely
  if (!targetColumn.contains(event.relatedTarget)) {
    targetColumn.classList.remove('column-drop-target');
  }
}

/**
 * Handle column drop
 */
function handleColumnDrop(event) {
  event.preventDefault();
  
  const draggedColumnId = event.dataTransfer.getData('application/x-moz-node');
  const header = event.currentTarget;
  const targetColumn = header.closest('.col');
  
  if (!targetColumn || !draggedColumnId) return;
  
  // Don't allow dropping on itself
  if (draggedColumnId === targetColumn.id) {
    return;
  }
  
  // Remove drop indicators
  targetColumn.classList.remove('column-drop-target');
  
  // Perform the column reordering
  reorderColumns(draggedColumnId, targetColumn.id, 'replace');
}

/**
 * Handle column drag end
 */
function handleColumnDragEnd(event) {
  const header = event.currentTarget;
  const column = header.closest('.col');
  if (!column) return;

  // Remove dragging class
  column.classList.remove('column-dragging');

  debugLog?.info('Drag ended for column', { 
    module: 'drag-drop-event-handlers',
    function: 'handleColumnDragEnd',
    columnId: column.id
  });
}

/**
 * Handle drop zone drag over
 */
function handleDropZoneDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  
  // Highlight the drop zone - we'll check the dragged column ID during drop
  event.currentTarget.classList.add('drop-zone-active');
}

/**
 * Handle drop zone drag leave
 */
function handleDropZoneDragLeave(event) {
  // Only remove class if we're leaving the drop zone entirely
  if (!event.currentTarget.contains(event.relatedTarget)) {
    event.currentTarget.classList.remove('drop-zone-active');
  }
}

/**
 * Handle drop zone drop
 */
function handleDropZoneDrop(event) {
  event.preventDefault();
  
  const draggedColumnId = event.dataTransfer.getData('application/x-moz-node');
  if (!draggedColumnId) return;
  
  // Remove drop zone highlighting
  event.currentTarget.classList.remove('drop-zone-active');
  
  // Get the position where to insert
  const position = parseInt(event.currentTarget.getAttribute('data-position'));
  
  // Perform the column reordering
  reorderColumns(draggedColumnId, position, 'insert');
}

/**
 * Reorder columns based on drop target
 */
function reorderColumns(draggedColumnId, targetId, mode) {
  const topRow = document.getElementById('top-row');
  if (!topRow) return;
  
  const draggedColumn = document.getElementById(draggedColumnId);
  const targetColumn = typeof targetId === 'number' ? null : document.getElementById(targetId);
  
  debugLog?.info('Reordering columns', { 
    module: 'drag-drop-event-handlers',
    function: 'reorderColumns',
    draggedColumnId: draggedColumnId,
    targetId: targetId,
    mode: mode,
    hasDraggedColumn: !!draggedColumn,
    hasTargetColumn: !!targetColumn
  });
  
  if (!draggedColumn) return;
  
  // Remove dragging class
  draggedColumn.classList.remove('column-dragging');
  
  if (mode === 'insert' && typeof targetId === 'number') {
    // Insert at specific position
    const columns = topRow.querySelectorAll('#holding-tank-column, #search-column, #hotkeys-column');
    const targetIndex = targetId;
    
    debugLog?.info('Insert mode', { 
      module: 'drag-drop-event-handlers',
      function: 'reorderColumns',
      targetIndex: targetIndex,
      columnsLength: columns.length
    });
    
    if (targetIndex >= 0 && targetIndex <= columns.length) {
      const targetElement = columns[targetIndex] || null;
      if (targetElement) {
        topRow.insertBefore(draggedColumn, targetElement);
      } else {
        topRow.appendChild(draggedColumn);
      }
    }
  } else if (mode === 'replace' && targetColumn) {
    // Replace the target column
    const columns = Array.from(topRow.querySelectorAll('#holding-tank-column, #search-column, #hotkeys-column'));
    const draggedIndex = columns.indexOf(draggedColumn);
    const targetIndex = columns.indexOf(targetColumn);
    
    debugLog?.info('Replace mode', { 
      module: 'drag-drop-event-handlers',
      function: 'reorderColumns',
      draggedIndex: draggedIndex,
      targetIndex: targetIndex
    });
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      if (draggedIndex < targetIndex) {
        topRow.insertBefore(draggedColumn, targetColumn.nextSibling);
      } else {
        topRow.insertBefore(draggedColumn, targetColumn);
      }
    }
  }
  
  // Recreate drop zones after reordering
  createColumnDropZones();
  
  // Save the new column order
  const newColumnOrder = Array.from(topRow.querySelectorAll('#holding-tank-column, #search-column, #hotkeys-column')).map(el => el.id);
  saveColumnOrder(newColumnOrder);
  
  // Add animation feedback
  draggedColumn.classList.add('animate__animated', 'animate__jello');
  setTimeout(() => {
    draggedColumn.classList.remove('animate__animated', 'animate__jello');
  }, 1000);
}

/**
 * Save column order to store
 */
function saveColumnOrder(columnOrder) {
  secureStore.set("column_order", columnOrder).then(result => {
    if (result.success) {
      debugLog?.info('Column order saved successfully', { 
        module: 'drag-drop-event-handlers',
        function: 'saveColumnOrder',
        columnOrder: columnOrder
      });
    } else {
      debugLog?.warn('Failed to save column order', { 
        module: 'drag-drop-event-handlers',
        function: 'saveColumnOrder',
        error: result.error
      });
    }
  }).catch(error => {
    debugLog?.warn('Column order save error', { 
      module: 'drag-drop-event-handlers',
      function: 'saveColumnOrder',
      error: error
    });
  });
} 