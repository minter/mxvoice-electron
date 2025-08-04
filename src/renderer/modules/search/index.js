/**
 * Search Module Index
 * 
 * This module serves as the main entry point for all search functionality
 * in the MxVoice Electron application.
 */

// Import search sub-modules
import * as searchEngine from './search-engine.js';
import * as liveSearch from './live-search.js';
import * as advancedSearch from './advanced-search.js';

/**
 * Search Module Class
 * 
 * Provides a unified interface for all search functionality
 */
class SearchModule {
  constructor() {
    // Initialize search engine functions
    this.searchData = searchEngine.searchData;
    this.triggerLiveSearch = searchEngine.triggerLiveSearch;
    this.performLiveSearch = liveSearch.performLiveSearch;
    this.toggleAdvancedSearch = advancedSearch.toggleAdvancedSearch;
    
    // Initialize search state
    this.searchTimeout = null;
    this.fontSize = 11;
    this.categories = {};
  }

  /**
   * Initialize the search module
   * This method can be called to set up any initialization logic
   */
  init() {
    console.log('Search module initialized');
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for search functionality
   */
  setupEventListeners() {
    // This will be called when the module is loaded
    // Event listeners will be set up in the main renderer
  }

  /**
   * Get all available search functions
   * 
   * @returns {Object} - Object containing all search functions
   */
  getAllSearchFunctions() {
    return {
      // Search engine functions
      searchData: this.searchData,
      performLiveSearch: this.performLiveSearch,
      toggleAdvancedSearch: this.toggleAdvancedSearch,
      
      // Utility functions
      clearSearchResults: this.clearSearchResults,
      triggerLiveSearch: this.triggerLiveSearch,
      buildSearchQuery: this.buildSearchQuery
    };
  }

  /**
   * Clear search results
   */
  clearSearchResults() {
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
  }

  // triggerLiveSearch function moved to search-engine module

  /**
   * Build search query string and parameters
   * 
   * @param {string} searchTerm - The search term
   * @param {boolean} isLiveSearch - Whether this is a live search
   * @returns {Object} - Object containing query string and parameters
   */
  buildSearchQuery(searchTerm, isLiveSearch = false) {
    const queryParams = [];
    const querySegments = [];
    let queryString = "";
    const category = $("#category_select").val();

    // Apply category filter if not "All Categories"
    if (category != "*") {
      querySegments.push("category = ?");
      queryParams.push(category);
    }

    // Apply advanced search filters if advanced search is visible
    if ($("#advanced-search").is(":visible")) {
      const title = $("#title-search").val().trim();
      const artist = $("#artist-search").val().trim();
      const info = $("#info-search").val().trim();
      const since = $("#date-search").val();

      if (title.length) {
        querySegments.push("title LIKE ?");
        queryParams.push(`%${title}%`);
      }
      if (artist.length) {
        querySegments.push("artist LIKE ?");
        queryParams.push(`%${artist}%`);
      }
      if (info.length) {
        querySegments.push("info LIKE ?");
        queryParams.push(`%${info}%`);
      }
      if (since.length) {
        querySegments.push("modtime > ?");
        const today = new Date();
        queryParams.push(
          Math.round(today.setDate(today.getDate() - since) / 1000)
        );
      }
    }

    // Add the search term to the query (only if we have a search term)
    if (searchTerm && searchTerm.length > 0) {
      const searchTermParam = "%" + searchTerm + "%";
      querySegments.push("(info LIKE ? OR title LIKE ? OR artist like ?)");
      queryParams.push(searchTermParam, searchTermParam, searchTermParam);
    }

    // Build the complete query string
    if (querySegments.length != 0) {
      queryString = " WHERE " + querySegments.join(" AND ");
    }

    // Add ORDER BY clause
    queryString += " ORDER BY category,info,title,artist";
    
    // Add LIMIT for live search
    if (isLiveSearch) {
      queryString += " LIMIT 50";
    }

    return {
      queryString,
      queryParams
    };
  }

  /**
   * Test all search functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {
      engine: {},
      live: {},
      advanced: {}
    };

    // Test search engine functions
    try {
      if (typeof this.searchData === 'function') {
        results.engine.searchData = '✅ Function exists';
      } else {
        results.engine.searchData = '❌ Function missing';
      }
    } catch (error) {
      results.engine.error = `❌ Error: ${error.message}`;
    }

    // Test live search functions
    try {
      if (typeof this.performLiveSearch === 'function') {
        results.live.performLiveSearch = '✅ Function exists';
      } else {
        results.live.performLiveSearch = '❌ Function missing';
      }

      if (typeof this.triggerLiveSearch === 'function') {
        results.live.triggerLiveSearch = '✅ Function exists';
      } else {
        results.live.triggerLiveSearch = '❌ Function missing';
      }
    } catch (error) {
      results.live.error = `❌ Error: ${error.message}`;
    }

    // Test advanced search functions
    try {
      if (typeof this.toggleAdvancedSearch === 'function') {
        results.advanced.toggleAdvancedSearch = '✅ Function exists';
      } else {
        results.advanced.toggleAdvancedSearch = '❌ Function missing';
      }
    } catch (error) {
      results.advanced.error = `❌ Error: ${error.message}`;
    }

    return results;
  }

  /**
   * Get search module information
   * 
   * @returns {Object} - Module information
   */
  getInfo() {
    return {
      name: 'Search Module',
      version: '1.0.0',
      description: 'Handles search functionality including live search and advanced search',
      functions: {
        engine: [
          'searchData',
          'buildSearchQuery'
        ],
        live: [
          'performLiveSearch',
          'triggerLiveSearch',
          'clearSearchResults'
        ],
        advanced: [
          'toggleAdvancedSearch'
        ]
      }
    };
  }
}

// Create and export a singleton instance
const searchModule = new SearchModule();

// Export individual functions for direct access
export const searchData = searchModule.searchData.bind(searchModule);
export const performLiveSearch = searchModule.performLiveSearch.bind(searchModule);
export const toggleAdvancedSearch = searchModule.toggleAdvancedSearch.bind(searchModule);
export const clearSearchResults = searchModule.clearSearchResults.bind(searchModule);
export const triggerLiveSearch = searchModule.triggerLiveSearch.bind(searchModule);
export const buildSearchQuery = searchModule.buildSearchQuery.bind(searchModule);

// Default export for module loading
export default {
  searchData: searchModule.searchData,
  performLiveSearch: searchModule.performLiveSearch,
  toggleAdvancedSearch: searchModule.toggleAdvancedSearch,
  clearSearchResults: searchModule.clearSearchResults,
  triggerLiveSearch: searchModule.triggerLiveSearch,
  buildSearchQuery: searchModule.buildSearchQuery
}; 