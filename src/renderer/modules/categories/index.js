/**
 * Categories Module Index
 * 
 * This module serves as the main entry point for all category-related operations
 * in the MxVoice Electron application. It handles category management, UI population,
 * and database interactions for categories.
 */

// Import category sub-modules
const categoryOperations = require('./category-operations');
const categoryUI = require('./category-ui');
const categoryData = require('./category-data');

/**
 * Categories Module Class
 * 
 * Provides a unified interface for all category-related functionality
 */
class CategoriesModule {
  constructor() {
    // Initialize category operation functions
    this.editCategory = categoryOperations.editCategory;
    this.deleteCategory = categoryOperations.deleteCategory;
    this.addNewCategory = categoryOperations.addNewCategory;
    this.getCategories = categoryOperations.getCategories;
    this.getCategoryByCode = categoryOperations.getCategoryByCode;
    this.updateCategory = categoryOperations.updateCategory;
    
    // Initialize category UI functions
    this.populateCategorySelect = categoryUI.populateCategorySelect;
    this.populateCategoriesModal = categoryUI.populateCategoriesModal;
    this.editCategoryUI = categoryUI.editCategoryUI;
    this.openCategoriesModal = categoryUI.openCategoriesModal;
    this.saveCategories = categoryUI.saveCategories;
    this.addNewCategoryUI = categoryUI.addNewCategoryUI;
    
    // Initialize category data functions
    this.loadCategories = categoryData.loadCategories;
    this.refreshCategories = categoryData.refreshCategories;
    this.validateCategoryCode = categoryData.validateCategoryCode;
    this.generateCategoryCode = categoryData.generateCategoryCode;
    
    // Initialize module state
    this.categories = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the categories module
   * This method can be called to set up any initialization logic
   */
  async init() {
    console.log('Categories module initializing...');
    
    try {
      // Load initial categories
      await this.loadCategories();
      this.isInitialized = true;
      console.log('Categories module initialized successfully');
    } catch (error) {
      console.error('Failed to initialize categories module:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for category functionality
   */
  setupEventListeners() {
    // This will be called when the module is loaded
    // Event listeners will be set up in the main renderer
  }

  /**
   * Get all available category functions
   * 
   * @returns {Object} - Object containing all category functions
   */
  getAllCategoryFunctions() {
    return {
      // Category operation functions
      editCategory: this.editCategory,
      deleteCategory: this.deleteCategory,
      addNewCategory: this.addNewCategory,
      getCategories: this.getCategories,
      getCategoryByCode: this.getCategoryByCode,
      updateCategory: this.updateCategory,
      
      // Category UI functions
      populateCategorySelect: this.populateCategorySelect,
      populateCategoriesModal: this.populateCategoriesModal,
      editCategoryUI: this.editCategoryUI,
      openCategoriesModal: this.openCategoriesModal,
      saveCategories: this.saveCategories,
      addNewCategoryUI: this.addNewCategoryUI,
      
      // Category data functions
      loadCategories: this.loadCategories,
      refreshCategories: this.refreshCategories,
      validateCategoryCode: this.validateCategoryCode,
      generateCategoryCode: this.generateCategoryCode
    };
  }

  /**
   * Test all category functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {
      operations: {},
      ui: {},
      data: {}
    };

    // Test category operation functions
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

      if (typeof this.getCategories === 'function') {
        results.operations.getCategories = '✅ Function exists';
      } else {
        results.operations.getCategories = '❌ Function missing';
      }

      if (typeof this.getCategoryByCode === 'function') {
        results.operations.getCategoryByCode = '✅ Function exists';
      } else {
        results.operations.getCategoryByCode = '❌ Function missing';
      }

      if (typeof this.updateCategory === 'function') {
        results.operations.updateCategory = '✅ Function exists';
      } else {
        results.operations.updateCategory = '❌ Function missing';
      }
    } catch (error) {
      results.operations.error = `❌ Error: ${error.message}`;
    }

    // Test category UI functions
    try {
      if (typeof this.populateCategorySelect === 'function') {
        results.ui.populateCategorySelect = '✅ Function exists';
      } else {
        results.ui.populateCategorySelect = '❌ Function missing';
      }

      if (typeof this.populateCategoriesModal === 'function') {
        results.ui.populateCategoriesModal = '✅ Function exists';
      } else {
        results.ui.populateCategoriesModal = '❌ Function missing';
      }

      if (typeof this.editCategoryUI === 'function') {
        results.ui.editCategoryUI = '✅ Function exists';
      } else {
        results.ui.editCategoryUI = '❌ Function missing';
      }

      if (typeof this.openCategoriesModal === 'function') {
        results.ui.openCategoriesModal = '✅ Function exists';
      } else {
        results.ui.openCategoriesModal = '❌ Function missing';
      }

      if (typeof this.saveCategories === 'function') {
        results.ui.saveCategories = '✅ Function exists';
      } else {
        results.ui.saveCategories = '❌ Function missing';
      }

      if (typeof this.addNewCategoryUI === 'function') {
        results.ui.addNewCategoryUI = '✅ Function exists';
      } else {
        results.ui.addNewCategoryUI = '❌ Function missing';
      }
    } catch (error) {
      results.ui.error = `❌ Error: ${error.message}`;
    }

    // Test category data functions
    try {
      if (typeof this.loadCategories === 'function') {
        results.data.loadCategories = '✅ Function exists';
      } else {
        results.data.loadCategories = '❌ Function missing';
      }

      if (typeof this.refreshCategories === 'function') {
        results.data.refreshCategories = '✅ Function exists';
      } else {
        results.data.refreshCategories = '❌ Function missing';
      }

      if (typeof this.validateCategoryCode === 'function') {
        results.data.validateCategoryCode = '✅ Function exists';
      } else {
        results.data.validateCategoryCode = '❌ Function missing';
      }

      if (typeof this.generateCategoryCode === 'function') {
        results.data.generateCategoryCode = '✅ Function exists';
      } else {
        results.data.generateCategoryCode = '❌ Function missing';
      }
    } catch (error) {
      results.data.error = `❌ Error: ${error.message}`;
    }

    return results;
  }

  /**
   * Get categories module information
   * 
   * @returns {Object} - Module information
   */
  getInfo() {
    return {
      name: 'Categories Module',
      version: '1.0.0',
      description: 'Handles category-related operations including management, UI population, and database interactions',
      functions: {
        operations: [
          'editCategory',
          'deleteCategory',
          'addNewCategory',
          'getCategories',
          'getCategoryByCode',
          'updateCategory'
        ],
        ui: [
          'populateCategorySelect',
          'populateCategoriesModal',
          'editCategoryUI',
          'openCategoriesModal',
          'saveCategories',
          'addNewCategoryUI'
        ],
        data: [
          'loadCategories',
          'refreshCategories',
          'validateCategoryCode',
          'generateCategoryCode'
        ]
      }
    };
  }

  /**
   * Get current categories data
   * 
   * @returns {Object} - Current categories
   */
  getCategoriesData() {
    return this.categories;
  }

  /**
   * Check if module is initialized
   * 
   * @returns {boolean} - Initialization status
   */
  isModuleInitialized() {
    return this.isInitialized;
  }
}

// Create and export a singleton instance
const categoriesModule = new CategoriesModule();

// Export individual functions for direct access
export {
  editCategory: categoriesModule.editCategory,
  deleteCategory: categoriesModule.deleteCategory,
  addNewCategory: categoriesModule.addNewCategory,
  getCategories: categoriesModule.getCategories,
  getCategoryByCode: categoriesModule.getCategoryByCode,
  updateCategory: categoriesModule.updateCategory,
  populateCategorySelect: categoriesModule.populateCategorySelect,
  populateCategoriesModal: categoriesModule.populateCategoriesModal,
  editCategoryUI: categoriesModule.editCategoryUI,
  openCategoriesModal: categoriesModule.openCategoriesModal,
  saveCategories: categoriesModule.saveCategories,
  addNewCategoryUI: categoriesModule.addNewCategoryUI,
  loadCategories: categoriesModule.loadCategories,
  refreshCategories: categoriesModule.refreshCategories,
  validateCategoryCode: categoriesModule.validateCategoryCode,
  generateCategoryCode: categoriesModule.generateCategoryCode
};

// Default export for module loading
export default {
  editCategory: categoriesModule.editCategory,
  deleteCategory: categoriesModule.deleteCategory,
  addNewCategory: categoriesModule.addNewCategory,
  getCategories: categoriesModule.getCategories,
  getCategoryByCode: categoriesModule.getCategoryByCode,
  updateCategory: categoriesModule.updateCategory,
  populateCategorySelect: categoriesModule.populateCategorySelect,
  populateCategoriesModal: categoriesModule.populateCategoriesModal,
  editCategoryUI: categoriesModule.editCategoryUI,
  openCategoriesModal: categoriesModule.openCategoriesModal,
  saveCategories: categoriesModule.saveCategories,
  addNewCategoryUI: categoriesModule.addNewCategoryUI,
  loadCategories: categoriesModule.loadCategories,
  refreshCategories: categoriesModule.refreshCategories,
  validateCategoryCode: categoriesModule.validateCategoryCode,
  generateCategoryCode: categoriesModule.generateCategoryCode
}; 