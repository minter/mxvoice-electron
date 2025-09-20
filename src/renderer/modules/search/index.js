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

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Search Module Class
 * 
 * Provides a unified interface for all search functionality
 */
class SearchModule {
  constructor() {
    // Initialize module state
    this.searchData = searchEngine.searchData;
    this.triggerLiveSearch = searchEngine.triggerLiveSearch;
    this.performLiveSearch = liveSearch.performLiveSearch;
    this.getCachedCategories = liveSearch.getCachedCategories;
    this.getCategoryName = liveSearch.getCategoryName;
    
    // Advanced search functionality
    this.performAdvancedSearch = advancedSearch.performAdvancedSearch;
  }

  /**
   * Initialize the search module
   * @param {Object} dependencies - Module dependencies
   * @returns {Promise<boolean>} Success status
   */
  async init(dependencies = {}) {
    try {
      debugLog?.info('Search module initializing...', { 
        module: 'search', 
        function: 'init' 
      });
      
      // Initialize advanced search state
      if (typeof advancedSearch.initializeAdvancedSearch === 'function') {
        advancedSearch.initializeAdvancedSearch();
      }
      
      // Set up event listeners
      this.setupEventListeners();
      
      debugLog?.info('Search module initialized successfully', { 
        module: 'search', 
        function: 'init' 
      });
      return true;
    } catch (error) {
      debugLog?.error('Failed to initialize Search module:', { 
        module: 'search', 
        function: 'init', 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Set up event listeners for search functionality
   */
  setupEventListeners() {
    // This will be called when the module is loaded
    // Event listeners will be set up in the main renderer
  }

  /**
   * Clear search results
   */
  clearSearchResults() {
    const tbody = document.querySelector('#search_results tbody');
    const thead = document.querySelector('#search_results thead');
    if (tbody) tbody.querySelectorAll('tr').forEach(tr => tr.remove());
    if (thead) thead.style.display = 'none';
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
    const category = document.getElementById('category_select')?.value;

    // Apply category filter if not "All Categories"
    if (category != "*") {
      querySegments.push("category = ?");
      queryParams.push(category);
    }

    // Apply advanced search filters if advanced search is visible
    const adv = document.getElementById('advanced-search');
    if (adv && adv.offsetParent !== null) {
      const title = (document.getElementById('title-search')?.value || '').trim();
      const artist = (document.getElementById('artist-search')?.value || '').trim();
      const info = (document.getElementById('info-search')?.value || '').trim();
      const since = document.getElementById('date-search')?.value || '';

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
      search: {},
      advanced: {}
    };

    // Test search functions
    try {
      if (typeof this.searchData === 'function') {
        results.search.searchData = '✅ Function exists';
      } else {
        results.search.searchData = '❌ Function missing';
      }

      if (typeof this.performLiveSearch === 'function') {
        results.search.performLiveSearch = '✅ Function exists';
      } else {
        results.search.performLiveSearch = '❌ Function missing';
      }

      if (typeof this.performAdvancedSearch === 'function') {
        results.advanced.performAdvancedSearch = '✅ Function exists';
      } else {
        results.advanced.performAdvancedSearch = '❌ Function missing';
      }
    } catch (error) {
      results.search.error = `❌ Error: ${error.message}`;
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
          'performAdvancedSearch'
        ]
      }
    };
  }

  getPublicInterface() {
    return {
      searchData: this.searchData,
      performLiveSearch: this.performLiveSearch,
      getCachedCategories: this.getCachedCategories,
      getCategoryName: this.getCategoryName,
      performAdvancedSearch: this.performAdvancedSearch,
      triggerLiveSearch: this.triggerLiveSearch,
      clearSearchResults: this.clearSearchResults,
      buildSearchQuery: this.buildSearchQuery
    };
  }
}

// Create and export a singleton instance
const searchModule = new SearchModule();

// Export individual functions for direct access
export const searchData = searchModule.searchData;
export const triggerLiveSearch = searchModule.triggerLiveSearch;
export const performLiveSearch = searchModule.performLiveSearch;
export const getCachedCategories = searchModule.getCachedCategories;
export const getCategoryName = searchModule.getCategoryName;
export const performAdvancedSearch = searchModule.performAdvancedSearch;
export const clearSearchResults = searchModule.clearSearchResults;
export const buildSearchQuery = searchModule.buildSearchQuery;

// Default export for module loading
export default {
  searchData: searchModule.searchData,
  triggerLiveSearch: searchModule.triggerLiveSearch,
  performLiveSearch: searchModule.performLiveSearch,
  getCachedCategories: searchModule.getCachedCategories,
  getCategoryName: searchModule.getCategoryName,
  performAdvancedSearch: searchModule.performAdvancedSearch,
  clearSearchResults: searchModule.clearSearchResults,
  buildSearchQuery: searchModule.buildSearchQuery
}; 