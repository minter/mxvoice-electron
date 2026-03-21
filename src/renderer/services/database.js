/**
 * Database Service
 *
 * Provides access to the Electron database API for database operations
 */

// Export the database API from the global electronAPI
export const database = {
  /**
   * Get all songs from the database
   * @returns {Promise<Array>} - Array of songs
   */
  getAllSongs: () => {
    return window.secureElectronAPI.database.searchSongs({ category: '*' });
  },

  /**
   * Get a song by ID
   * @param {number} id - The song ID
   * @returns {Promise<Object>} - Song data
   */
  getSongById: (id) => {
    return window.secureElectronAPI.database.getSongById(id);
  },

  /**
   * Search songs in the database
   * @param {string} searchTerm - The search term
   * @returns {Promise<Array>} - Query result
   */
  searchSongs: (searchTerm) => {
    return window.secureElectronAPI.database.searchSongs({ category: '*', searchTerm });
  }
};
