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
   * Read a file
   * @param {string} path - The file path
   * @returns {Promise<Object>} - File read result
   */
  readFile: (path) => {
    return secureFileSystem.read(path);
  },

  /**
   * Write a file
   * @param {string} path - The file path
   * @param {string} content - The file content
   * @returns {Promise<Object>} - Result of the operation
   */
  writeFile: (path, content) => {
    return secureFileSystem.write(path, content);
  },

  /**
   * Check if a file exists
   * @param {string} path - The file path
   * @returns {Promise<Object>} - File exists result
   */
  exists: (path) => {
    return secureFileSystem.exists(path);
  },

  /**
   * Get file information
   * @param {string} path - The file path
   * @returns {Promise<Object>} - File stat result
   */
  stat: (path) => {
    return secureFileSystem.stat(path);
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
  },

  /**
   * Read directory contents
   * @param {string} path - Directory path
   * @returns {Promise<Object>} - Directory listing result
   */
  readdir: (path) => {
    return secureFileSystem.readdir(path);
  }
}; 