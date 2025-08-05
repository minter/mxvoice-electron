/**
 * Bulk Operations Module
 * 
 * Handles bulk import of songs from directories and processing multiple files
 * Includes event handlers for bulk operations UI
 */

import { showBulkAddModal, addSongsByPath, saveBulkUpload } from './bulk-operations.js';
import { setupBulkEventHandlers } from './event-handlers.js';

/**
 * Bulk Operations Singleton
 * 
 * Provides a unified interface for all bulk operations
 */
class BulkOperationsModule {
  constructor() {
    // Bind all functions as methods
    this.showBulkAddModal = showBulkAddModal;
    this.addSongsByPath = addSongsByPath;
    this.saveBulkUpload = saveBulkUpload;
  }

  /**
   * Initialize the bulk operations module
   */
  initializeBulkOperations() {
    // Setup event handlers for bulk operations
    setupBulkEventHandlers();
    
    console.log('✅ Bulk Operations Module initialized');
  }

  /**
   * Initialize the module (alias for initializeBulkOperations)
   */
  init() {
    this.initializeBulkOperations();
  }

  /**
   * Get all bulk operations functions
   * 
   * @returns {Object} - Object containing all bulk operations functions
   */
  getAllBulkOperations() {
    return {
      showBulkAddModal: this.showBulkAddModal,
      addSongsByPath: this.addSongsByPath,
      saveBulkUpload: this.saveBulkUpload
    };
  }

  /**
   * Test all bulk operations functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {};

    // Test each function
    const functions = [
      'showBulkAddModal',
      'addSongsByPath',
      'saveBulkUpload'
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
      name: 'Bulk Operations Module',
      version: '1.0.0',
      description: 'Provides bulk import and processing operations',
      functions: this.getAllBulkOperations()
    };
  }
}

// Create and export a singleton instance
const bulkOperationsModule = new BulkOperationsModule();

// Export individual functions for backward compatibility
export const showBulkAddModal = bulkOperationsModule.showBulkAddModal;
export const addSongsByPath = bulkOperationsModule.addSongsByPath;
export const saveBulkUpload = bulkOperationsModule.saveBulkUpload;
export const initializeBulkOperations = bulkOperationsModule.initializeBulkOperations.bind(bulkOperationsModule);

// Default export for module loading
export default bulkOperationsModule; 