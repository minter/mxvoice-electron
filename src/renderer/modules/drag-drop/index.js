/**
 * Drag & Drop Module
 * 
 * Handles all drag and drop functionality for moving songs between containers
 * and rearranging UI elements
 */

import { songDrag, columnDrag } from './drag-drop-functions.js';
import { setupDragDropEventHandlers } from './event-handlers.js';

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
 * Drag & Drop Singleton
 * 
 * Provides a unified interface for all drag and drop operations
 */
class DragDropModule {
  constructor() {
    // Bind all functions as methods (excluding hotkeyDrop, allowHotkeyDrop, and holdingTankDrop which are handled by their respective modules)
    this.songDrag = songDrag;
    this.columnDrag = columnDrag;
  }

  /**
   * Initialize the drag and drop module
   */
  initializeDragDrop() {
    // Setup event handlers for drag and drop
    setupDragDropEventHandlers();
    
    // Note: Functions are now registered through the function registry system
    // to prevent duplicate registration warnings
    debugLog?.info('Drag & Drop Module initialized', { 
      module: 'drag-drop',
      function: 'initializeDragDrop',
      note: 'Functions registered through function registry system'
    });
  }

  /**
   * Initialize the module (alias for initializeDragDrop)
   */
  init() {
    this.initializeDragDrop();
  }

  /**
   * Get all drag and drop functions
   * 
   * @returns {Object} - Object containing all drag and drop functions
   */
  getAllDragDropFunctions() {
    return {
      songDrag: this.songDrag,
      columnDrag: this.columnDrag
    };
  }

  /**
   * Test all drag and drop functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {};

    // Test each function
    const functions = [
      'songDrag',
      'columnDrag'
    ];

    for (const funcName of functions) {
      if (typeof this[funcName] === 'function') {
        results[funcName] = '✅ Function exists';
      } else {
        results[funcName] = '❌ Function missing';
      }
    }

    return results;
  }

  /**
   * Get module information
   * 
   * @returns {Object} - Module information
   */
  getInfo() {
    return {
      name: 'Drag & Drop Module',
      version: '1.0.0',
      description: 'Provides drag and drop functionality',
      functions: this.getAllDragDropFunctions()
    };
  }
}

// Create and export a singleton instance
const dragDropModule = new DragDropModule();

// Export individual functions for backward compatibility (excluding hotkeyDrop, allowHotkeyDrop, and holdingTankDrop which are handled by their respective modules)
export const initializeDragDrop = dragDropModule.initializeDragDrop.bind(dragDropModule);

// Default export for module loading
export default dragDropModule; 