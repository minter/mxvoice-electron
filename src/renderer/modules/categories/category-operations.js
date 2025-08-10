/**
 * Category Operations Module
 * 
 * Handles core database operations for categories including CRUD operations,
 * category management, and database interactions. This module provides the
 * database-level operations for categories.
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

/**
 * Get all categories from the database
 * 
 * @returns {Promise<Object>} - Result containing categories data
 */
function getCategories() {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.getCategories().then(result => {
        if (result.success) {
          debugLog?.info('Categories retrieved successfully', { 
            module: 'category-operations',
            function: 'getCategories'
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to get categories', { 
            module: 'category-operations',
            function: 'getCategories',
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'category-operations',
          function: 'getCategories',
          error: error.message
        });
        reject(error);
      });
    } else {
      reject(new Error('Database not available'));
    }
  });
}

/**
 * Get a specific category by its code
 * 
 * @param {string} code - Category code
 * @returns {Promise<Object>} - Result containing category data
 */
function getCategoryByCode(code) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.query(
        "SELECT * FROM categories WHERE code = ?",
        [code]
      ).then(result => {
        if (result.success && result.data.length > 0) {
          debugLog?.info('Category retrieved successfully', { 
            module: 'category-operations',
            function: 'getCategoryByCode',
            code: code
          });
          resolve({ success: true, data: result.data[0] });
        } else {
          debugLog?.warn('Category not found', { 
            module: 'category-operations',
            function: 'getCategoryByCode',
            code: code
          });
          reject(new Error(`Category ${code} not found`));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'category-operations',
          function: 'getCategoryByCode',
          code: code,
          error: error.message
        });
        reject(error);
      });
    } else {
      reject(new Error('Database not available'));
    }
  });
}

/**
 * Edit category in the database
 * Updates the category description in the database
 * 
 * @param {string} code - Category code
 * @param {string} description - New category description
 * @returns {Promise<Object>} - Result of the operation
 */
function editCategory(code, description) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.execute(
        "UPDATE categories SET description = ? WHERE code = ?",
        [description, code]
      ).then(result => {
        if (result.success) {
          debugLog?.info('Category updated successfully', { 
            module: 'category-operations',
            function: 'editCategory',
            code: code,
            description: description
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to update category', { 
            module: 'category-operations',
            function: 'editCategory',
            code: code,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'category-operations',
          function: 'editCategory',
          code: code,
          error: error.message
        });
        reject(error);
      });
    } else {
      reject(new Error('Database not available'));
    }
  });
}

/**
 * Update category (alias for editCategory)
 * 
 * @param {string} code - Category code
 * @param {string} description - New category description
 * @returns {Promise<Object>} - Result of the operation
 */
function updateCategory(code, description) {
  return editCategory(code, description);
}

/**
 * Delete category from the database
 * Deletes a category and moves all songs to "Uncategorized"
 * 
 * @param {string} code - Category code to delete
 * @param {string} description - Category description for confirmation
 * @returns {Promise<Object>} - Result of the operation
 */
function deleteCategory(code, description) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      // First ensure "Uncategorized" category exists
      window.electronAPI.database.execute(
        "INSERT OR REPLACE INTO categories VALUES(?, ?)",
        ["UNC", "Uncategorized"]
      ).then(() => {
        // Update all songs in this category to "Uncategorized"
        return window.electronAPI.database.execute(
          "UPDATE mrvoice SET category = ? WHERE category = ?",
          ["UNC", code]
        );
      }).then(() => {
        // Delete the category
        return window.electronAPI.database.execute(
          "DELETE FROM categories WHERE code = ?",
          [code]
        );
      }).then(result => {
        if (result.success) {
          debugLog?.info('Category deleted successfully', { 
            module: 'category-operations',
            function: 'deleteCategory',
            code: code,
            description: description
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to delete category', { 
            module: 'category-operations',
            function: 'deleteCategory',
            code: code,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'category-operations',
          function: 'deleteCategory',
          code: code,
          error: error.message
        });
        reject(error);
      });
    } else {
      reject(new Error('Database not available'));
    }
  });
}

/**
 * Add new category to the database
 * Creates a new category with auto-generated code
 * 
 * @param {string} description - Category description
 * @returns {Promise<Object>} - Result of the operation
 */
function addNewCategory(description) {
  return new Promise((resolve, reject) => {
    let code = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
    
    if (window.electronAPI && window.electronAPI.database) {
      // Check for code collision and generate unique code
      const checkCode = (baseCode, loopCount = 1) => {
        const testCode = loopCount === 1 ? baseCode : `${baseCode}${loopCount}`;
        
        return window.electronAPI.database.query(
          "SELECT * FROM categories WHERE code = ?",
          [testCode]
        ).then(result => {
          if (result.success && result.data.length > 0) {
            return checkCode(baseCode, loopCount + 1);
          } else {
            return testCode;
          }
        });
      };
      
      checkCode(code).then(finalCode => {
        return window.electronAPI.database.execute(
          "INSERT INTO categories VALUES (?, ?)",
          [finalCode, description]
        );
      }).then(result => {
        if (result.success) {
          debugLog?.info('New category added successfully', { 
            module: 'category-operations',
            function: 'addNewCategory',
            code: code,
            description: description
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to add category', { 
            module: 'category-operations',
            function: 'addNewCategory',
            description: description,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'category-operations',
          function: 'addNewCategory',
          description: description,
          error: error.message
        });
        reject(error);
      });
    } else {
      reject(new Error('Database not available'));
    }
  });
}

export {
  getCategories,
  getCategoryByCode,
  editCategory,
  updateCategory,
  deleteCategory,
  addNewCategory
};

// Default export for module loading
export default {
  getCategories,
  getCategoryByCode,
  editCategory,
  updateCategory,
  deleteCategory,
  addNewCategory
}; 