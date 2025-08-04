/**
 * Database Module Index
 * 
 * This module serves as the main entry point for all database-related UI operations
 * in the MxVoice Electron application. It handles UI population, data persistence,
 * and database interactions through the preload API.
 */

// Import database sub-modules
const dataPopulation = require('./data-population');
const storeOperations = require('./store-operations');
const uiOperations = require('./ui-operations');
const databaseOperations = require('./database-operations');

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
      population: {},
      store: {},
      ui: {},
      operations: {}
    };

    // Test data population functions
    try {
      if (typeof this.populateCategorySelect === 'function') {
        results.population.populateCategorySelect = '✅ Function exists';
      } else {
        results.population.populateCategorySelect = '❌ Function missing';
      }

      if (typeof this.setLabelFromSongId === 'function') {
        results.population.setLabelFromSongId = '✅ Function exists';
      } else {
        results.population.setLabelFromSongId = '❌ Function missing';
      }

      if (typeof this.addToHoldingTank === 'function') {
        results.population.addToHoldingTank = '✅ Function exists';
      } else {
        results.population.addToHoldingTank = '❌ Function missing';
      }

      if (typeof this.populateHotkeys === 'function') {
        results.population.populateHotkeys = '✅ Function exists';
      } else {
        results.population.populateHotkeys = '❌ Function missing';
      }

      if (typeof this.populateHoldingTank === 'function') {
        results.population.populateHoldingTank = '✅ Function exists';
      } else {
        results.population.populateHoldingTank = '❌ Function missing';
      }

      if (typeof this.populateCategoriesModal === 'function') {
        results.population.populateCategoriesModal = '✅ Function exists';
      } else {
        results.population.populateCategoriesModal = '❌ Function missing';
      }
    } catch (error) {
      results.population.error = `❌ Error: ${error.message}`;
    }

    // Test store operation functions
    try {
      if (typeof this.saveHoldingTankToStore === 'function') {
        results.store.saveHoldingTankToStore = '✅ Function exists';
      } else {
        results.store.saveHoldingTankToStore = '❌ Function missing';
      }

      if (typeof this.saveHotkeysToStore === 'function') {
        results.store.saveHotkeysToStore = '✅ Function exists';
      } else {
        results.store.saveHotkeysToStore = '❌ Function missing';
      }
    } catch (error) {
      results.store.error = `❌ Error: ${error.message}`;
    }

    // Test UI operation functions
    try {
      if (typeof this.scaleScrollable === 'function') {
        results.ui.scaleScrollable = '✅ Function exists';
      } else {
        results.ui.scaleScrollable = '❌ Function missing';
      }
    } catch (error) {
      results.ui.error = `❌ Error: ${error.message}`;
    }

    // Test database operation functions
    try {
      if (typeof this.editCategory === 'function') {
        results.operations.editCategory = '✅ Function exists';
      } else {
        results.operations.editCategory = '❌ Function missing';
      }

      if (typeof this.deleteCategory === 'function') {
        results.operations.deleteCategory = '✅ Function exists';
      } else {
        results.operations.deleteCategory = '❌ Function missing';
      }

      if (typeof this.addNewCategory === 'function') {
        results.operations.addNewCategory = '✅ Function exists';
      } else {
        results.operations.addNewCategory = '❌ Function missing';
      }

      if (typeof this.saveEditedSong === 'function') {
        results.operations.saveEditedSong = '✅ Function exists';
      } else {
        results.operations.saveEditedSong = '❌ Function missing';
      }

      if (typeof this.saveNewSong === 'function') {
        results.operations.saveNewSong = '✅ Function exists';
      } else {
        results.operations.saveNewSong = '❌ Function missing';
      }

      if (typeof this.deleteSong === 'function') {
        results.operations.deleteSong = '✅ Function exists';
      } else {
        results.operations.deleteSong = '❌ Function missing';
      }

      if (typeof this.getSongById === 'function') {
        results.operations.getSongById = '✅ Function exists';
      } else {
        results.operations.getSongById = '❌ Function missing';
      }

      if (typeof this.addSongsByPath === 'function') {
        results.operations.addSongsByPath = '✅ Function exists';
      } else {
        results.operations.addSongsByPath = '❌ Function missing';
      }

      if (typeof this.executeQuery === 'function') {
        results.operations.executeQuery = '✅ Function exists';
      } else {
        results.operations.executeQuery = '❌ Function missing';
      }

      if (typeof this.executeStatement === 'function') {
        results.operations.executeStatement = '✅ Function exists';
      } else {
        results.operations.executeStatement = '❌ Function missing';
      }
    } catch (error) {
      results.operations.error = `❌ Error: ${error.message}`;
    }

    return results;
  }

  /**
   * Get database module information
   * 
   * @returns {Object} - Module information
   */
  getInfo() {
    return {
      name: 'Database Module',
      version: '1.0.0',
      description: 'Handles database-related UI operations including data population, store persistence, and database operations',
      functions: {
        population: [
          'populateCategorySelect',
          'setLabelFromSongId',
          'addToHoldingTank',
          'populateHotkeys',
          'populateHoldingTank',
          'populateCategoriesModal'
        ],
        store: [
          'saveHoldingTankToStore',
          'saveHotkeysToStore'
        ],
        ui: [
          'scaleScrollable'
        ],
        operations: [
          'editCategory',
          'deleteCategory',
          'addNewCategory',
          'saveEditedSong',
          'saveNewSong',
          'deleteSong',
          'getSongById',
          'addSongsByPath',
          'executeQuery',
          'executeStatement'
        ]
      }
    };
  }
}

// Create and export a singleton instance
const databaseModule = new DatabaseModule();

// Export the module instance and individual functions for backward compatibility
module.exports = {
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