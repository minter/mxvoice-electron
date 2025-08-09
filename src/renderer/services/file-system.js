/**
 * File System Service
 * 
 * Provides access to the Electron file system API for file operations
 */

// Export the file system API from the global electronAPI
export const fileSystem = {
  /**
   * Read a file
   * @param {string} path - The file path
   * @returns {Promise<string>} - File contents
   */
  readFile: (path) => {
    return window.electronAPI.fileSystem.readFile(path);
  },

  /**
   * Write a file
   * @param {string} path - The file path
   * @param {string} content - The file content
   * @returns {Promise<Object>} - Result of the operation
   */
  writeFile: (path, content) => {
    return window.electronAPI.fileSystem.writeFile(path, content);
  },

  /**
   * Check if a file exists
   * @param {string} path - The file path
   * @returns {Promise<boolean>} - Whether the file exists
   */
  exists: (path) => {
    return window.electronAPI.fileSystem.exists(path);
  },

  /**
   * Get file information
   * @param {string} path - The file path
   * @returns {Promise<Object>} - File information
   */
  stat: (path) => {
    return window.electronAPI.fileSystem.stat(path);
  }
}; 