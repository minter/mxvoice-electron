/**
 * Bulk Operations Module
 * 
 * Handles bulk import of songs from directories and processing multiple files
 * Includes event handlers for bulk operations UI
 */

import { showBulkAddModal, addSongsByPath, saveBulkUpload } from './bulk-operations.js';
import { setupBulkEventHandlers } from './event-handlers.js';

/**
 * Initialize the bulk operations module
 */
export function initializeBulkOperations() {
  // Setup event handlers for bulk operations
  setupBulkEventHandlers();
  
  console.log('✅ Bulk Operations Module initialized');
}

/**
 * Get all bulk operations functions
 */
export function getBulkOperations() {
  return {
    showBulkAddModal,
    addSongsByPath,
    saveBulkUpload
  };
}

// Export individual functions for direct access
export {
  showBulkAddModal,
  addSongsByPath,
  saveBulkUpload
};

// Default export for module loading
export default {
  showBulkAddModal,
  addSongsByPath,
  saveBulkUpload,
  initializeBulkOperations
}; 