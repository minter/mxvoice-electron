/**
 * Store Service
 * 
 * Provides secure access to store operations using secure adapters
 */

// Import secure adapters
import { secureStore } from '../modules/adapters/secure-adapter.js';

// Export the secure store API
export const store = {
  /**
   * Check if a key exists in the store
   * @param {string} key - The key to check
   * @returns {Promise<boolean>} - Whether the key exists
   */
  has: (key) => {
    return secureStore.has(key);
  },

  /**
   * Get a value from the store
   * @param {string} key - The key to get
   * @returns {Promise<any>} - The stored value
   */
  get: (key) => {
    return secureStore.get(key);
  },

  /**
   * Set a value in the store
   * @param {string} key - The key to set
   * @param {any} value - The value to store
   * @returns {Promise<Object>} - Result of the operation
   */
  set: (key, value) => {
    return secureStore.set(key, value);
  },

  /**
   * Delete a key from the store
   * @param {string} key - The key to delete
   * @returns {Promise<Object>} - Result of the operation
   */
  delete: (key) => {
    return secureStore.delete(key);
  }
}; 