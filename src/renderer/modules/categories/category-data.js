/**
 * Category Data Module
 * 
 * Handles data management and validation for categories including loading,
 * refreshing, and validating category data. This module provides the data-level
 * operations for categories.
 */

// Import debug logger
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

// Import category operations for data operations
import * as categoryOperations from './category-operations.js';
import sharedState from '../shared-state.js';

/**
 * Load categories into the module's internal state
 * 
 * @returns {Promise<Object>} - Loaded categories data
 */
function loadCategories() {
  return new Promise((resolve, reject) => {
    categoryOperations.getCategories().then(result => {
      if (result.success) {
        // Store categories in module state
        const categoriesData = {};
        result.data.forEach(row => {
          categoriesData[row.code] = row.description;
        });
        
        // Store categories in shared state for other modules to access
        sharedState.set('categories', categoriesData);
        
        // Update global categories object if it exists
        if (typeof categories !== 'undefined') {
          Object.assign(categories, categoriesData);
        }
        
        debugLog?.info('✅ Categories loaded successfully:', { module: 'categories', function: 'loadCategories', categoriesData: categoriesData });
        resolve({ success: true, data: categoriesData });
      } else {
        debugLog?.warn('❌ Failed to load categories:', { module: 'categories', function: 'loadCategories', error: result.error });
        reject(new Error(result.error));
      }
    }).catch(error => {
      debugLog?.warn('❌ Error loading categories:', { module: 'categories', function: 'loadCategories', error: error });
      reject(error);
    });
  });
}

/**
 * Refresh categories data
 * Reloads categories from database and updates internal state
 * 
 * @returns {Promise<Object>} - Refreshed categories data
 */
function refreshCategories() {
  debugLog?.info('Refreshing categories...', { module: 'categories', function: 'refreshCategories' });
  return loadCategories().then(result => {
    debugLog?.info('✅ Categories refreshed successfully', { module: 'categories', function: 'refreshCategories' });
    return result;
  }).catch(error => {
    debugLog?.error('❌ Error refreshing categories:', { module: 'categories', function: 'refreshCategories', error: error });
    throw error;
  });
}

/**
 * Validate a category code
 * Checks if the category code is valid and unique
 * 
 * @param {string} code - Category code to validate
 * @returns {Promise<boolean>} - True if valid, false otherwise
 */
function validateCategoryCode(code) {
  return new Promise((resolve, reject) => {
    if (!code || typeof code !== 'string') {
      resolve(false);
      return;
    }
    
    // Check if code follows the pattern (4 characters, uppercase)
    const codePattern = /^[A-Z]{4}$/;
    if (!codePattern.test(code)) {
      resolve(false);
      return;
    }
    
    // Check if code already exists
    categoryOperations.getCategoryByCode(code).then(() => {
      // Code exists, not valid for new category
      resolve(false);
    }).catch(() => {
      // Code doesn't exist, valid for new category
      resolve(true);
    });
  });
}

/**
 * Generate a unique category code from description
 * 
 * @param {string} description - Category description
 * @returns {Promise<string>} - Generated unique category code
 */
function generateCategoryCode(description) {
  return new Promise((resolve, reject) => {
    if (!description || description.trim() === '') {
      reject(new Error('Description is required'));
      return;
    }
    
    // Generate base code from description
    const baseCode = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
    
    // Check for code collisions and generate unique code
    const checkCode = (baseCode, loopCount = 1) => {
      const newCode = loopCount === 1 ? baseCode : `${baseCode}${loopCount}`;
      
      return validateCategoryCode(newCode).then(isValid => {
        if (isValid) {
          return newCode;
        } else {
          // Code exists, try next iteration
          return checkCode(baseCode, loopCount + 1);
        }
      });
    };
    
    checkCode(baseCode).then(finalCode => {
      debugLog?.info(`✅ Generated unique category code: ${finalCode}`, { module: 'categories', function: 'generateCategoryCode', finalCode: finalCode });
      resolve(finalCode);
    }).catch(error => {
      debugLog?.error('❌ Error generating category code:', { module: 'categories', function: 'generateCategoryCode', error: error });
      reject(error);
    });
  });
}

/**
 * Get category description by code
 * 
 * @param {string} code - Category code
 * @returns {string|null} - Category description or null if not found
 */
function getCategoryDescription(code) {
  if (typeof categories !== 'undefined' && categories[code]) {
    return categories[code];
  }
  return null;
}

/**
 * Get all category codes
 * 
 * @returns {Array<string>} - Array of category codes
 */
function getCategoryCodes() {
  if (typeof categories !== 'undefined') {
    return Object.keys(categories);
  }
  return [];
}

/**
 * Get all category descriptions
 * 
 * @returns {Array<string>} - Array of category descriptions
 */
function getCategoryDescriptions() {
  if (typeof categories !== 'undefined') {
    return Object.values(categories);
  }
  return [];
}

/**
 * Check if a category exists
 * 
 * @param {string} code - Category code to check
 * @returns {boolean} - True if category exists, false otherwise
 */
function categoryExists(code) {
  if (typeof categories !== 'undefined') {
    return categories.hasOwnProperty(code);
  }
  return false;
}

/**
 * Get category count
 * 
 * @returns {number} - Number of categories
 */
function getCategoryCount() {
  if (typeof categories !== 'undefined') {
    return Object.keys(categories).length;
  }
  return 0;
}

/**
 * Get categories as array of objects
 * 
 * @returns {Array<Object>} - Array of category objects with code and description
 */
function getCategoriesAsArray() {
  if (typeof categories !== 'undefined') {
    return Object.entries(categories).map(([code, description]) => ({
      code,
      description
    }));
  }
  return [];
}

/**
 * Sort categories by description
 * 
 * @returns {Array<Object>} - Sorted array of category objects
 */
function getSortedCategories() {
  return getCategoriesAsArray().sort((a, b) => {
    return a.description.localeCompare(b.description);
  });
}

/**
 * Filter categories by description
 * 
 * @param {string} filter - Filter string to match against descriptions
 * @returns {Array<Object>} - Filtered array of category objects
 */
function filterCategories(filter) {
  if (!filter || filter.trim() === '') {
    return getSortedCategories();
  }
  
  const lowerFilter = filter.toLowerCase();
  return getSortedCategories().filter(category => {
    return category.description.toLowerCase().includes(lowerFilter);
  });
}

// Export individual functions for direct access
export {
  loadCategories,
  refreshCategories,
  validateCategoryCode,
  generateCategoryCode,
  getCategoryDescription,
  getCategoryCodes,
  getCategoryDescriptions,
  categoryExists,
  getCategoryCount,
  getCategoriesAsArray,
  getSortedCategories,
  filterCategories
};

// Default export for module loading
export default {
  loadCategories,
  refreshCategories,
  validateCategoryCode,
  generateCategoryCode,
  getCategoryDescription,
  getCategoryCodes,
  getCategoryDescriptions,
  categoryExists,
  getCategoryCount,
  getCategoriesAsArray,
  getSortedCategories,
  filterCategories
}; 