/**
 * Path Service
 * 
 * Provides secure access to path operations using the secure adapter pattern
 * 
 * PHASE 2 SECURITY MIGRATION: Now uses secure adapters for path operations
 */

import { securePath } from '../modules/adapters/secure-adapter.js';

// Export secure path operations
export const path = {
  /**
   * Join path segments
   * @param {...string} segments - Path segments to join
   * @returns {Promise<string>} - Joined path
   */
  join: (...segments) => {
    return securePath.join(...segments);
  },

  /**
   * Get the directory name of a path
   * @param {string} path - The path
   * @returns {Promise<string>} - Directory name
   */
  dirname: (path) => {
    return securePath.dirname(path);
  },

  /**
   * Get the base name of a path
   * @param {string} path - The path
   * @param {string} ext - Optional extension to remove
   * @returns {Promise<string>} - Base name
   */
  basename: (path, ext) => {
    return securePath.basename(path, ext);
  },

  /**
   * Get the extension of a path
   * @param {string} path - The path
   * @returns {Promise<string>} - File extension
   */
  extname: (path) => {
    return securePath.extname(path);
  },

  /**
   * Resolve a path to an absolute path
   * @param {...string} paths - Path segments to resolve
   * @returns {Promise<string>} - Absolute path
   */
  resolve: (...paths) => {
    return securePath.resolve(...paths);
  },

  /**
   * Parse a file path into components
   * @param {string} filePath - File path to parse
   * @returns {Promise<Object>} - Path components (dir, name, ext, base, root)
   */
  parse: (filePath) => {
    return securePath.parse(filePath);
  }
}; 