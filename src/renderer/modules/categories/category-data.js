/**
 * Category Data Module
 * 
 * Handles data management and validation for categories including loading,
 * refreshing, and validating category data. This module provides the data-level
 * operations for categories.
 */

// Import category operations for data operations
const categoryOperations = require('./category-operations');

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
        
        // Update global categories object if it exists
        if (typeof categories !== 'undefined') {
          Object.assign(categories, categoriesData);
        }
        
        console.log('✅ Categories loaded successfully');
        resolve({ success: true, data: categoriesData });
      } else {
        console.warn('❌ Failed to load categories:', result.error);
        reject(new Error(result.error));
      }
    }).catch(error => {
      console.warn('❌ Error loading categories:', error);
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
  console.log('Refreshing categories...');
  return loadCategories().then(result => {
    console.log('✅ Categories refreshed successfully');
    return result;
  }).catch(error => {
    console.error('❌ Error refreshing categories:', error);
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
      console.log(`✅ Generated unique category code: ${finalCode}`);
      resolve(finalCode);
    }).catch(error => {
      console.error('❌ Error generating category code:', error);
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

module.exports = {
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