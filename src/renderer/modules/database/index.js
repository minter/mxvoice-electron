/**
 * Database Module Index
 * 
 * This module serves as the main entry point for all database-related UI operations
 * in the MxVoice Electron application. It handles UI population, data persistence,
 * and database interactions through the preload API.
 */

// Import database sub-modules
import * as dataPopulation from './data-population.js';
import * as storeOperations from './store-operations.js';
import * as uiOperations from './ui-operations.js';
import * as databaseOperations from './database-operations.js';

/**
 * Database Module Class
 * 
 * Provides a unified interface for all database-related UI functionality
 */
class DatabaseModule {
  constructor() {
    // Initialize database operation functions
    this.populateCategorySelect = dataPopulation.populateCategorySelect;
    this.setLabelFromSongId = dataPopulation.setLabelFromSongId;
    this.addToHoldingTank = dataPopulation.addToHoldingTank;
    this.populateHotkeys = dataPopulation.populateHotkeys;
    this.populateHoldingTank = dataPopulation.populateHoldingTank;
    this.populateCategoriesModal = dataPopulation.populateCategoriesModal;
    
    // Initialize store operation functions
    this.saveHoldingTankToStore = storeOperations.saveHoldingTankToStore;
    this.saveHotkeysToStore = storeOperations.saveHotkeysToStore;
    
    // Initialize UI operation functions
    this.scaleScrollable = uiOperations.scaleScrollable;
    
    // Initialize database operation functions
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
    
    // Initialize module state
    this.categories = {};
    this.fontSize = 11;
  }

  /**
   * Initialize the database module
   * This method can be called to set up any initialization logic
   */
  init() {
    console.log('Database module initialized');
    this.setupEventListeners();
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
      populateCategorySelect: this.populateCategorySelect,
      setLabelFromSongId: this.setLabelFromSongId,
      addToHoldingTank: this.addToHoldingTank,
      populateHotkeys: this.populateHotkeys,
      populateHoldingTank: this.populateHoldingTank,
      populateCategoriesModal: this.populateCategoriesModal,
      
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
      if (typeof this.populateCategorySelect === 'function') {
        results.dataPopulation.populateCategorySelect = '✅ Function exists';
      } else {
        results.dataPopulation.populateCategorySelect = '❌ Function missing';
      }

      if (typeof this.setLabelFromSongId === 'function') {
        results.dataPopulation.setLabelFromSongId = '✅ Function exists';
      } else {
        results.dataPopulation.setLabelFromSongId = '❌ Function missing';
      }

      if (typeof this.addToHoldingTank === 'function') {
        results.dataPopulation.addToHoldingTank = '✅ Function exists';
      } else {
        results.dataPopulation.addToHoldingTank = '❌ Function missing';
      }

      if (typeof this.populateHotkeys === 'function') {
        results.dataPopulation.populateHotkeys = '✅ Function exists';
      } else {
        results.dataPopulation.populateHotkeys = '❌ Function missing';
      }

      if (typeof this.populateHoldingTank === 'function') {
        results.dataPopulation.populateHoldingTank = '✅ Function exists';
      } else {
        results.dataPopulation.populateHoldingTank = '❌ Function missing';
      }

      if (typeof this.populateCategoriesModal === 'function') {
        results.dataPopulation.populateCategoriesModal = '✅ Function exists';
      } else {
        results.dataPopulation.populateCategoriesModal = '❌ Function missing';
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

// Export the module instance and individual functions for backward compatibility
export {
  // Module instance
  DatabaseModule,
  database: databaseModule,
  
  // Individual functions (for direct access)
  populateCategorySelect: databaseModule.populateCategorySelect,
  setLabelFromSongId: databaseModule.setLabelFromSongId,
  addToHoldingTank: databaseModule.addToHoldingTank,
  populateHotkeys: databaseModule.populateHotkeys,
  populateHoldingTank: databaseModule.populateHoldingTank,
  populateCategoriesModal: databaseModule.populateCategoriesModal,
  saveHoldingTankToStore: databaseModule.saveHoldingTankToStore,
  saveHotkeysToStore: databaseModule.saveHotkeysToStore,
  scaleScrollable: databaseModule.scaleScrollable,
  editCategory: databaseModule.editCategory,
  deleteCategory: databaseModule.deleteCategory,
  addNewCategory: databaseModule.addNewCategory,
  saveEditedSong: databaseModule.saveEditedSong,
  saveNewSong: databaseModule.saveNewSong,
  deleteSong: databaseModule.deleteSong,
  getSongById: databaseModule.getSongById,
  addSongsByPath: databaseModule.addSongsByPath,
  executeQuery: databaseModule.executeQuery,
  executeStatement: databaseModule.executeStatement
};

// Default export for module loading
export default {
  DatabaseModule,
  database: databaseModule,
  populateCategorySelect: databaseModule.populateCategorySelect,
  setLabelFromSongId: databaseModule.setLabelFromSongId,
  addToHoldingTank: databaseModule.addToHoldingTank,
  populateHotkeys: databaseModule.populateHotkeys,
  populateHoldingTank: databaseModule.populateHoldingTank,
  populateCategoriesModal: databaseModule.populateCategoriesModal,
  saveHoldingTankToStore: databaseModule.saveHoldingTankToStore,
  saveHotkeysToStore: databaseModule.saveHotkeysToStore,
  scaleScrollable: databaseModule.scaleScrollable,
  editCategory: databaseModule.editCategory,
  deleteCategory: databaseModule.deleteCategory,
  addNewCategory: databaseModule.addNewCategory,
  saveEditedSong: databaseModule.saveEditedSong,
  saveNewSong: databaseModule.saveNewSong,
  deleteSong: databaseModule.deleteSong,
  getSongById: databaseModule.getSongById,
  addSongsByPath: databaseModule.addSongsByPath,
  executeQuery: databaseModule.executeQuery,
  executeStatement: databaseModule.executeStatement
}; 