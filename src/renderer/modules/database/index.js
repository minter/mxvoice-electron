/**
 * Database Module Index
 * 
 * This module serves as the main entry point for all database-related UI operations
 * in the MxVoice Electron application. It handles UI population, data persistence,
 * and database interactions through the preload API.
 */

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

// Import database sub-modules
import dataPopulation from './data-population.js';
import storeOperations from './store-operations.js';
import uiOperations from './ui-operations.js';
import databaseOperations from './database-operations.js';

/**
 * Database Module Class
 * 
 * Provides a unified interface for all database-related UI functionality
 */
class DatabaseModule {
  constructor() {
    // Initialize module state
    this.categories = {};
    this.fontSize = 11;
    
    // Bind all functions from sub-modules as methods
    this.addToHoldingTank = dataPopulation.addToHoldingTank;
    this.populateHoldingTank = dataPopulation.populateHoldingTank;
    
    this.saveHoldingTankToStore = storeOperations.saveHoldingTankToStore;
    this.saveHotkeysToStore = storeOperations.saveHotkeysToStore;
    
    this.scaleScrollable = uiOperations.scaleScrollable;
    
    this.editCategory = databaseOperations.editCategory;
    this.deleteCategory = databaseOperations.deleteCategory;
    this.addNewCategory = databaseOperations.addNewCategory;
    this.saveEditedSong = databaseOperations.saveEditedSong;
    this.saveNewSong = databaseOperations.saveNewSong;
    this.deleteSong = databaseOperations.deleteSong;
    this.getSongById = databaseOperations.getSongById;
    this.addSongsByPath = databaseOperations.addSongsByPath;
    this.executeQuery = databaseOperations.executeQuery;
    this.executeStatement = databaseOperations.executeStatement;
  }

  /**
   * Initialize the database module
   * @param {Object} dependencies - Module dependencies
   * @returns {Promise<boolean>} Success status
   */
  async init(dependencies = {}) {
    try {
      debugLog?.info('Database module initializing...', { 
        module: 'database-index', 
        function: 'init' 
      });

      // Set up event listeners
      this.setupEventListeners();
      
      debugLog?.info('Database module initialized successfully', { 
        module: 'database-index', 
        function: 'init' 
      });
      return true;
    } catch (error) {
      debugLog?.error('Failed to initialize Database module:', { 
        module: 'database-index', 
        function: 'init', 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Set up event listeners for database functionality
   */
  setupEventListeners() {
    // This will be called when the module is loaded
    // Event listeners will be set up in the main renderer
  }

  /**
   * Get all available database functions
   * 
   * @returns {Object} - Object containing all database functions
   */
  getAllDatabaseFunctions() {
    return {
      // Data population functions
      addToHoldingTank: this.addToHoldingTank,
      populateHoldingTank: this.populateHoldingTank,
      
      // Store operation functions
      saveHoldingTankToStore: this.saveHoldingTankToStore,
      saveHotkeysToStore: this.saveHotkeysToStore,
      
      // UI operation functions
      scaleScrollable: this.scaleScrollable,
      
      // Database operation functions
      editCategory: this.editCategory,
      deleteCategory: this.deleteCategory,
      addNewCategory: this.addNewCategory,
      saveEditedSong: this.saveEditedSong,
      saveNewSong: this.saveNewSong,
      deleteSong: this.deleteSong,
      getSongById: this.getSongById,
      addSongsByPath: this.addSongsByPath,
      executeQuery: this.executeQuery,
      executeStatement: this.executeStatement
    };
  }

  /**
   * Test all database functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {
      dataPopulation: {},
      storeOperations: {},
      uiOperations: {},
      databaseOperations: {}
    };

    // Test data population functions
    try {
      if (typeof this.addToHoldingTank === 'function') {
        results.dataPopulation.addToHoldingTank = '✅ Function exists';
      } else {
        results.dataPopulation.addToHoldingTank = '❌ Function missing';
      }

      if (typeof this.populateHoldingTank === 'function') {
        results.dataPopulation.populateHoldingTank = '✅ Function exists';
      } else {
        results.dataPopulation.populateHoldingTank = '❌ Function missing';
      }
    } catch (error) {
      results.dataPopulation.error = `❌ Error: ${error.message}`;
    }

    // Test store operation functions
    try {
      if (typeof this.saveHoldingTankToStore === 'function') {
        results.storeOperations.saveHoldingTankToStore = '✅ Function exists';
      } else {
        results.storeOperations.saveHoldingTankToStore = '❌ Function missing';
      }

      if (typeof this.saveHotkeysToStore === 'function') {
        results.storeOperations.saveHotkeysToStore = '✅ Function exists';
      } else {
        results.storeOperations.saveHotkeysToStore = '❌ Function missing';
      }
    } catch (error) {
      results.storeOperations.error = `❌ Error: ${error.message}`;
    }

    // Test UI operation functions
    try {
      if (typeof this.scaleScrollable === 'function') {
        results.uiOperations.scaleScrollable = '✅ Function exists';
      } else {
        results.uiOperations.scaleScrollable = '❌ Function missing';
      }
    } catch (error) {
      results.uiOperations.error = `❌ Error: ${error.message}`;
    }

    // Test database operation functions
    try {
      if (typeof this.editCategory === 'function') {
        results.databaseOperations.editCategory = '✅ Function exists';
      } else {
        results.databaseOperations.editCategory = '❌ Function missing';
      }

      if (typeof this.deleteCategory === 'function') {
        results.databaseOperations.deleteCategory = '✅ Function exists';
      } else {
        results.databaseOperations.deleteCategory = '❌ Function missing';
      }

      if (typeof this.addNewCategory === 'function') {
        results.databaseOperations.addNewCategory = '✅ Function exists';
      } else {
        results.databaseOperations.addNewCategory = '❌ Function missing';
      }

      if (typeof this.saveEditedSong === 'function') {
        results.databaseOperations.saveEditedSong = '✅ Function exists';
      } else {
        results.databaseOperations.saveEditedSong = '❌ Function missing';
      }

      if (typeof this.saveNewSong === 'function') {
        results.databaseOperations.saveNewSong = '✅ Function exists';
      } else {
        results.databaseOperations.saveNewSong = '❌ Function missing';
      }

      if (typeof this.deleteSong === 'function') {
        results.databaseOperations.deleteSong = '✅ Function exists';
      } else {
        results.databaseOperations.deleteSong = '❌ Function missing';
      }

      if (typeof this.getSongById === 'function') {
        results.databaseOperations.getSongById = '✅ Function exists';
      } else {
        results.databaseOperations.getSongById = '❌ Function missing';
      }

      if (typeof this.addSongsByPath === 'function') {
        results.databaseOperations.addSongsByPath = '✅ Function exists';
      } else {
        results.databaseOperations.addSongsByPath = '❌ Function missing';
      }

      if (typeof this.executeQuery === 'function') {
        results.databaseOperations.executeQuery = '✅ Function exists';
      } else {
        results.databaseOperations.executeQuery = '❌ Function missing';
      }

      if (typeof this.executeStatement === 'function') {
        results.databaseOperations.executeStatement = '✅ Function exists';
      } else {
        results.databaseOperations.executeStatement = '❌ Function missing';
      }
    } catch (error) {
      results.databaseOperations.error = `❌ Error: ${error.message}`;
    }

    return results;
  }

  /**
   * Get module information
   * 
   * @returns {Object} - Module information
   */
  getInfo() {
    return {
      name: 'Database Module',
      version: '1.0.0',
      description: 'Provides database-related UI operations and data persistence',
      functions: this.getAllDatabaseFunctions()
    };
  }
}

// Create and export a singleton instance
const databaseModule = new DatabaseModule();

// Export individual functions for backward compatibility
export const addToHoldingTank = databaseModule.addToHoldingTank;
export const populateHoldingTank = databaseModule.populateHoldingTank;
export const saveHoldingTankToStore = databaseModule.saveHoldingTankToStore;
export const saveHotkeysToStore = databaseModule.saveHotkeysToStore;
export const scaleScrollable = databaseModule.scaleScrollable;
export const editCategory = databaseModule.editCategory;
export const deleteCategory = databaseModule.deleteCategory;
export const addNewCategory = databaseModule.addNewCategory;
export const saveEditedSong = databaseModule.saveEditedSong;
export const saveNewSong = databaseModule.saveNewSong;
export const deleteSong = databaseModule.deleteSong;
export const getSongById = databaseModule.getSongById;
export const addSongsByPath = databaseModule.addSongsByPath;
export const executeQuery = databaseModule.executeQuery;
export const executeStatement = databaseModule.executeStatement;

// Default export for module loading - export the instance directly
export default databaseModule; 