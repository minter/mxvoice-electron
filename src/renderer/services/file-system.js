/**
 * File System Service
 * 
 * Provides secure access to file system operations using secure adapters
 */

// Import secure adapters
import { secureFileSystem } from '../modules/adapters/secure-adapter.js';

// Export the secure file system API
export const fileSystem = {
  /**
   * Check if a file exists
   * @param {string} path - The file path
   * @returns {Promise<Object>} - File exists result
   */
  exists: (path) => {
    return secureFileSystem.exists(path);
  },

  /**
   * Copy a file
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @returns {Promise<Object>} - Copy result
   */
  copy: (sourcePath, destPath) => {
    return secureFileSystem.copy(sourcePath, destPath);
  },

  /**
   * Delete a file
   * @param {string} path - File path to delete
   * @returns {Promise<Object>} - Delete result
   */
  delete: (path) => {
    return secureFileSystem.delete(path);
  }
};