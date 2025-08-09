/**
 * Store Service
 * 
 * Provides access to the Electron store API for persistent data storage
 */

// Export the store API from the global electronAPI
export const store = {
  /**
   * Check if a key exists in the store
   * @param {string} key - The key to check
   * @returns {Promise<boolean>} - Whether the key exists
   */
  has: (key) => {
    return window.electronAPI.store.has(key);
  },

  /**
   * Get a value from the store
   * @param {string} key - The key to get
   * @returns {Promise<any>} - The stored value
   */
  get: (key) => {
    return window.electronAPI.store.get(key);
  },

  /**
   * Set a value in the store
   * @param {string} key - The key to set
   * @param {any} value - The value to store
   * @returns {Promise<Object>} - Result of the operation
   */
  set: (key, value) => {
    return window.electronAPI.store.set(key, value);
  },

  /**
   * Delete a key from the store
   * @param {string} key - The key to delete
   * @returns {Promise<Object>} - Result of the operation
   */
  delete: (key) => {
    return window.electronAPI.store.delete(key);
  }
}; 