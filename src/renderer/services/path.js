/**
 * Path Service
 * 
 * Provides access to the Electron path API for path operations
 */

// Export the path API from the global electronAPI
export const path = {
  /**
   * Join path segments
   * @param {...string} segments - Path segments to join
   * @returns {string} - Joined path
   */
  join: (...segments) => {
    return window.electronAPI.path.join(...segments);
  },

  /**
   * Get the directory name of a path
   * @param {string} path - The path
   * @returns {string} - Directory name
   */
  dirname: (path) => {
    return window.electronAPI.path.dirname(path);
  },

  /**
   * Get the base name of a path
   * @param {string} path - The path
   * @param {string} ext - Optional extension to remove
   * @returns {string} - Base name
   */
  basename: (path, ext) => {
    return window.electronAPI.path.basename(path, ext);
  },

  /**
   * Get the extension of a path
   * @param {string} path - The path
   * @returns {string} - File extension
   */
  extname: (path) => {
    return window.electronAPI.path.extname(path);
  },

  /**
   * Resolve a path to an absolute path
   * @param {...string} paths - Path segments to resolve
   * @returns {string} - Absolute path
   */
  resolve: (...paths) => {
    return window.electronAPI.path.resolve(...paths);
  }
}; 