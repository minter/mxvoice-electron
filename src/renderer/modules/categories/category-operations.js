/**
 * Category Operations Module
 * 
 * Handles core database operations for categories including CRUD operations,
 * category management, and database interactions. This module provides the
 * database-level operations for categories.
 */

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
          console.log('✅ Categories retrieved successfully');
          resolve(result);
        } else {
          console.warn('❌ Failed to get categories:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
          const categories = [];
          for (const row of stmt.iterate()) {
            categories.push(row);
          }
          console.log('✅ Categories retrieved successfully (legacy)');
          resolve({ success: true, data: categories });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
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
          console.log(`✅ Category ${code} retrieved successfully`);
          resolve({ success: true, data: result.data[0] });
        } else {
          console.warn(`❌ Category ${code} not found`);
          reject(new Error(`Category ${code} not found`));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare("SELECT * FROM categories WHERE code = ?");
          const category = stmt.get(code);
          if (category) {
            console.log(`✅ Category ${code} retrieved successfully (legacy)`);
            resolve({ success: true, data: category });
          } else {
            reject(new Error(`Category ${code} not found`));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
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
          console.log(`✅ Category ${code} updated successfully`);
          resolve(result);
        } else {
          console.warn('❌ Failed to update category:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare("UPDATE categories SET description = ? WHERE code = ?");
          const info = stmt.run(description, code);
          if (info.changes > 0) {
            console.log(`✅ Category ${code} updated successfully`);
            resolve({ success: true, changes: info.changes });
          } else {
            reject(new Error('No changes made to category'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Update category in the database (alias for editCategory)
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
          console.log(`✅ Category ${code} deleted successfully`);
          resolve(result);
        } else {
          console.warn('❌ Failed to delete category:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          // Ensure "Uncategorized" category exists
          const uncategorizedCheckStmt = db.prepare(
            "INSERT OR REPLACE INTO categories VALUES(?, ?);"
          );
          const uncategorizedCheckInfo = uncategorizedCheckStmt.run(
            "UNC",
            "Uncategorized"
          );
          if (uncategorizedCheckInfo.changes == 1) {
            console.log(`Had to upsert Uncategorized table`);
          }
          
          // Update all songs in this category to "Uncategorized"
          const stmt = db.prepare(
            "UPDATE mrvoice SET category = ? WHERE category = ?"
          );
          const info = stmt.run("UNC", code);
          console.log(`Updated ${info.changes} rows to uncategorized`);

          // Delete the category
          const deleteStmt = db.prepare("DELETE FROM categories WHERE code = ?");
          const deleteInfo = deleteStmt.run(code);
          if (deleteInfo.changes == 1) {
            console.log(`✅ Category ${code} deleted successfully`);
            resolve({ success: true, changes: deleteInfo.changes });
          } else {
            reject(new Error('Failed to delete category'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Add a new category to the database
 * 
 * @param {string} description - Category description
 * @returns {Promise<Object>} - Result of the operation
 */
function addNewCategory(description) {
  return new Promise((resolve, reject) => {
    if (!description || description.trim() === '') {
      reject(new Error('Category description is required'));
      return;
    }

    // Generate category code from description
    const code = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
    
    // Check for code collisions and generate unique code
    const checkCode = (baseCode, loopCount = 1) => {
      const newCode = loopCount === 1 ? baseCode : `${baseCode}${loopCount}`;
      
      return getCategoryByCode(newCode).then(() => {
        // Code exists, try next iteration
        return checkCode(baseCode, loopCount + 1);
      }).catch(() => {
        // Code doesn't exist, use this one
        return newCode;
      });
    };

    checkCode(code).then(finalCode => {
      if (window.electronAPI && window.electronAPI.database) {
        window.electronAPI.database.execute(
          "INSERT INTO categories VALUES (?, ?)",
          [finalCode, description]
        ).then(result => {
          if (result.success) {
            console.log(`✅ Category ${finalCode} added successfully`);
            resolve({ success: true, code: finalCode, description });
          } else {
            console.warn('❌ Failed to add category:', result.error);
            reject(new Error(result.error));
          }
        }).catch(error => {
          console.warn('❌ Database API error:', error);
          reject(error);
        });
      } else {
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          try {
            const stmt = db.prepare("INSERT INTO categories VALUES (?, ?)");
            const info = stmt.run(finalCode, description);
            if (info.changes == 1) {
              console.log(`✅ Category ${finalCode} added successfully`);
              resolve({ success: true, code: finalCode, description });
            } else {
              reject(new Error('Failed to add category'));
            }
          } catch (error) {
            if (error.message.match(/UNIQUE constraint/)) {
              reject(new Error(`Category "${description}" already exists`));
            } else {
              reject(error);
            }
          }
        } else {
          reject(new Error('Database not available'));
        }
      }
    }).catch(error => {
      reject(error);
    });
  });
}

// Export individual functions for direct access
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