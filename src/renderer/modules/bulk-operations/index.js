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
    
    window.debugLog?.info('✅ Bulk Operations Module initialized', { module: 'bulk-operations', function: 'initializeBulkOperations' });
  }

  /**
   * Initialize the module (standardized method)
   * @param {Object} dependencies - Module dependencies
   * @returns {Promise<boolean>} Success status
   */
  async init(dependencies = {}) {
    try {
      window.debugLog?.info('Bulk Operations module initializing...', { 
        module: 'bulk-operations', 
        function: 'init' 
      });

      // Call the existing initialization logic
      this.initializeBulkOperations();
      
      window.debugLog?.info('Bulk Operations module initialized successfully', { 
        module: 'bulk-operations', 
        function: 'init' 
      });
      return true;
    } catch (error) {
      window.debugLog?.error('Failed to initialize Bulk Operations module:', { 
        module: 'bulk-operations', 
        function: 'init', 
        error: error.message 
      });
      return false;
    }
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

// Default export for module loading
export default bulkOperationsModule; 