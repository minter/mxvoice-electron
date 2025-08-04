/**
 * Drag & Drop Module
 * 
 * Handles all drag and drop functionality for moving songs between containers
 * and rearranging UI elements
 */

import { hotkeyDrop, holdingTankDrop, allowHotkeyDrop, songDrag, columnDrag } from './drag-drop-functions.js';
import { setupDragDropEventHandlers } from './event-handlers.js';

/**
 * Initialize the drag and drop module
 */
export function initializeDragDrop() {
  // Setup event handlers for drag and drop
  setupDragDropEventHandlers();
  
  console.log('✅ Drag & Drop Module initialized');
}

/**
 * Get all drag and drop functions
 */
export function getDragDropFunctions() {
  return {
    hotkeyDrop,
    holdingTankDrop,
    allowHotkeyDrop,
    songDrag,
    columnDrag
  };
}

// Export individual functions for direct access
export {
  hotkeyDrop,
  holdingTankDrop,
  allowHotkeyDrop,
  songDrag,
  columnDrag
}; 