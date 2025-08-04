/**
 * Category UI Module
 * 
 * Handles UI operations for categories including rendering, event handling,
 * and user interactions. This module provides the UI-level operations for categories.
 */

// Import category operations for UI operations
import * as categoryOperations from './category-operations.js';

/**
 * Populate the category select dropdown
 * Loads categories from database and populates the select element
 * 
 * @returns {Promise<void>}
 */
function populateCategorySelect() {
  console.log("Populating categories");
  $("#category_select option").remove();
  $("#category_select").append(`<option value="*">All Categories</option>`);
  
  return categoryOperations.getCategories().then(result => {
    if (result.success) {
      result.data.forEach(row => {
        // Update global categories object
        if (typeof categories !== 'undefined') {
          categories[row.code] = row.description;
        }
        $("#category_select").append(
          `<option value="${row.code}">${row.description}</option>`
        );
      });
      console.log('✅ Category select populated successfully');
    } else {
      console.warn('❌ Failed to populate category select:', result.error);
      throw new Error(result.error);
    }
  }).catch(error => {
    console.warn('❌ Error populating category select:', error);
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      try {
        const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
        for (const row of stmt.iterate()) {
          if (typeof categories !== 'undefined') {
            categories[row.code] = row.description;
          }
          $("#category_select").append(
            `<option value="${row.code}">${row.description}</option>`
          );
        }
        console.log('✅ Category select populated successfully (legacy)');
      } catch (dbError) {
        console.error('❌ Legacy database error:', dbError);
      }
    }
  });
}

/**
 * Populate the categories management modal
 * Loads categories and populates the modal with edit/delete options
 * 
 * @returns {Promise<void>}
 */
function populateCategoriesModal() {
  $("#categoryList").find("div.row").remove();

  return categoryOperations.getCategories().then(result => {
    if (result.success) {
      result.data.forEach(row => {
        $("#categoryList").append(`<div class="form-group row">

          <div class="col-sm-8">
            <div catcode="${row.code}" class="category-description">${row.description}</div>
            <input style="display: none;" type="text" class="form-control form-control-sm categoryDescription" catcode="${row.code}" id="categoryDescription-${row.code}" value="${row.description}" required>
          </div>
          <div class="col-sm-4">
          <a href="#" class="btn btn-primary btn-xs" onclick="editCategoryUI('${row.code}')">Edit</a>&nbsp;
          <a class="delete_link btn btn-danger btn-xs" href="#" onclick="deleteCategory(event,'${row.code}','${row.description}')">Delete</a>
          </div>

        </div>`);
      });
      console.log('✅ Categories modal populated successfully');
    } else {
      console.warn('❌ Failed to populate categories modal:', result.error);
      throw new Error(result.error);
    }
  }).catch(error => {
    console.warn('❌ Error populating categories modal:', error);
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      try {
        const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
        for (const row of stmt.iterate()) {
          $("#categoryList").append(`<div class="form-group row">

            <div class="col-sm-8">
              <div catcode="${row.code}" class="category-description">${row.description}</div>
              <input style="display: none;" type="text" class="form-control form-control-sm categoryDescription" catcode="${row.code}" id="categoryDescription-${row.code}" value="${row.description}" required>
            </div>
            <div class="col-sm-4">
            <a href="#" class="btn btn-primary btn-xs" onclick="editCategoryUI('${row.code}')">Edit</a>&nbsp;
            <a class="delete_link btn btn-danger btn-xs" href="#" onclick="deleteCategory(event,'${row.code}','${row.description}')">Delete</a>
            </div>

          </div>`);
        }
        console.log('✅ Categories modal populated successfully (legacy)');
      } catch (dbError) {
        console.error('❌ Legacy database error:', dbError);
      }
    }
  });
}

/**
 * Edit category UI (show edit input field)
 * 
 * @param {string} code - Category code to edit
 */
function editCategoryUI(code) {
  $(".categoryDescription").hide();
  $(".category-description").show();
  $(`.category-description[catcode=${code}]`).hide();
  $(`.categoryDescription[catcode=${code}]`).show().select();
}

/**
 * Open the categories management modal
 * 
 */
function openCategoriesModal() {
  populateCategoriesModal().then(() => {
    $("#categoryManagementModal").modal();
  }).catch(error => {
    console.error('❌ Failed to open categories modal:', error);
    // Still open the modal even if population fails
    $("#categoryManagementModal").modal();
  });
}

/**
 * Save categories from the modal
 * Updates category descriptions in the database
 * 
 * @param {Event} event - Form submit event
 * @returns {Promise<void>}
 */
function saveCategories(event) {
  event.preventDefault();
  
  const promises = [];
  
  $("#categoryList div.row").each(function () {
    const code = $(this).find(".categoryDescription").attr("catcode");
    const description = $(this).find(".categoryDescription").val();
    
    if (code && description) {
      console.log(`Checking code ${code}`);
      promises.push(
        categoryOperations.editCategory(code, description).then(result => {
          if (result.success) {
            console.log(`Saving changes to ${code} - new description is ${description}`);
          }
          return result;
        }).catch(error => {
          console.error(`❌ Failed to save category ${code}:`, error);
          throw error;
        })
      );
    }
  });
  
  return Promise.all(promises).then(() => {
    // Refresh the UI after saving
    populateCategorySelect();
    populateCategoriesModal();
    console.log('✅ All categories saved successfully');
  }).catch(error => {
    console.error('❌ Error saving categories:', error);
    // Still refresh UI even if some saves failed
    populateCategorySelect();
    populateCategoriesModal();
  });
}

/**
 * Add new category from UI
 * 
 * @param {Event} event - Form submit event
 * @returns {Promise<void>}
 */
function addNewCategoryUI(event) {
  event.preventDefault();
  console.log(`Adding new category`);
  
  const description = $("#newCategoryDescription").val();
  
  if (!description || description.trim() === '') {
    alert('Category description is required');
    return Promise.reject(new Error('Category description is required'));
  }
  
  return categoryOperations.addNewCategory(description).then(result => {
    if (result.success) {
      console.log(`Added new row into database`);
      $("#newCategoryCode").val("");
      $("#newCategoryDescription").val("");
      populateCategorySelect();
      populateCategoriesModal();
      console.log('✅ New category added successfully');
    } else {
      throw new Error('Failed to add category');
    }
  }).catch(error => {
    console.error('❌ Error adding new category:', error);
    if (error.message.includes('already exists')) {
      $("#newCategoryDescription").val("");
      alert(`Couldn't add a category named "${description}" - apparently one already exists!`);
    } else {
      alert(`Error adding category: ${error.message}`);
    }
    throw error;
  });
}

/**
 * Delete category from UI
 * 
 * @param {Event} event - Click event
 * @param {string} code - Category code to delete
 * @param {string} description - Category description for confirmation
 * @returns {Promise<void>}
 */
function deleteCategoryUI(event, code, description) {
  event.preventDefault();
  
  return new Promise((resolve, reject) => {
    // Use custom confirmation dialog
    if (typeof customConfirm === 'function') {
      customConfirm(
        `Are you sure you want to delete "${description}" from Mx. Voice permanently? All songs in this category will be changed to the category "Uncategorized."`,
        function () {
          console.log(`Deleting category ${code}`);
          
          categoryOperations.deleteCategory(code, description).then(result => {
            if (result.success) {
              console.log(`✅ Category ${code} deleted successfully`);
              populateCategorySelect();
              populateCategoriesModal();
              resolve(result);
            } else {
              reject(new Error('Failed to delete category'));
            }
          }).catch(error => {
            console.error('❌ Error deleting category:', error);
            reject(error);
          });
        }
      );
    } else {
      // Fallback to native confirm
      if (confirm(`Are you sure you want to delete "${description}" from Mx. Voice permanently? All songs in this category will be changed to the category "Uncategorized."`)) {
        console.log(`Deleting category ${code}`);
        
        categoryOperations.deleteCategory(code, description).then(result => {
          if (result.success) {
            console.log(`✅ Category ${code} deleted successfully`);
            populateCategorySelect();
            populateCategoriesModal();
            resolve(result);
          } else {
            reject(new Error('Failed to delete category'));
          }
        }).catch(error => {
          console.error('❌ Error deleting category:', error);
          reject(error);
        });
      } else {
        resolve(); // User cancelled
      }
    }
  });
}

// Export individual functions for direct access
export {
  populateCategorySelect,
  populateCategoriesModal,
  editCategoryUI,
  openCategoriesModal,
  saveCategories,
  addNewCategoryUI,
  deleteCategoryUI
};

// Default export for module loading
export default {
  populateCategorySelect,
  populateCategoriesModal,
  editCategoryUI,
  openCategoriesModal,
  saveCategories,
  addNewCategoryUI,
  deleteCategoryUI
}; 