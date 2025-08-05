/**
 * Drag & Drop Module
 * 
 * Handles all drag and drop functionality for moving songs between containers
 * and rearranging UI elements
 */

import { hotkeyDrop, holdingTankDrop, allowHotkeyDrop, songDrag, columnDrag } from './drag-drop-functions.js';
import { setupDragDropEventHandlers } from './event-handlers.js';

/**
 * Drag & Drop Singleton
 * 
 * Provides a unified interface for all drag and drop operations
 */
class DragDropModule {
  constructor() {
    // Bind all functions as methods
    this.hotkeyDrop = hotkeyDrop;
    this.holdingTankDrop = holdingTankDrop;
    this.allowHotkeyDrop = allowHotkeyDrop;
    this.songDrag = songDrag;
    this.columnDrag = columnDrag;
  }

  /**
   * Initialize the drag and drop module
   */
  initializeDragDrop() {
    // Setup event handlers for drag and drop
    setupDragDropEventHandlers();
    
    console.log('✅ Drag & Drop Module initialized');
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
      hotkeyDrop: this.hotkeyDrop,
      holdingTankDrop: this.holdingTankDrop,
      allowHotkeyDrop: this.allowHotkeyDrop,
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
      'hotkeyDrop',
      'holdingTankDrop',
      'allowHotkeyDrop',
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

// Export individual functions for backward compatibility
export const hotkeyDrop = dragDropModule.hotkeyDrop;
export const holdingTankDrop = dragDropModule.holdingTankDrop;
export const allowHotkeyDrop = dragDropModule.allowHotkeyDrop;
export const songDrag = dragDropModule.songDrag;
export const columnDrag = dragDropModule.columnDrag;
export const initializeDragDrop = dragDropModule.initializeDragDrop.bind(dragDropModule);

// Default export for module loading
export default dragDropModule; 