/**
 * Database Service
 * 
 * Provides access to the Electron database API for database operations
 */

// Export the database API from the global electronAPI
export const database = {
  /**
   * Execute a database query
   * @param {string} query - The SQL query to execute
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query result
   */
  query: (query, params = []) => {
    return window.secureElectronAPI.database.query(query, params);
  },

  /**
   * Get all songs from the database
   * @returns {Promise<Array>} - Array of songs
   */
  getAllSongs: () => {
    return window.secureElectronAPI.database.getAllSongs();
  },

  /**
   * Get a song by ID
   * @param {number} id - The song ID
   * @returns {Promise<Object>} - Song data
   */
  getSongById: (id) => {
    return window.secureElectronAPI.database.query("SELECT * FROM mrvoice WHERE id = ?", [id]);
  },

  /**
   * Search songs in the database
   * @param {string} searchTerm - The search term
   * @returns {Promise<Array>} - Query result
   */
  searchSongs: (searchTerm) => {
    return window.secureElectronAPI.database.query("SELECT * FROM mrvoice WHERE title LIKE ? OR artist LIKE ? OR info LIKE ?", [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);
  }
}; 