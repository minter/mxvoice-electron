/**
 * Category UI Module
 * 
 * Handles UI operations for categories including rendering, event handling,
 * and user interactions. This module provides the UI-level operations for categories.
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

// Import category operations for UI operations
import * as categoryOperations from './category-operations.js';

/**
 * Populate the category select dropdown
 * Loads categories from database and populates the select element
 * 
 * @returns {Promise<void>}
 */
function populateCategorySelect() {
  debugLog?.info("Populating categories", { module: 'categories', function: 'populateCategorySelect' });
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
      debugLog?.info('✅ Category select populated successfully', { module: 'categories', function: 'populateCategorySelect' });
    } else {
      debugLog?.warn('❌ Failed to populate category select:', { module: 'categories', function: 'populateCategorySelect', error: result.error });
      throw new Error(result.error);
    }
  }).catch(error => {
    debugLog?.warn('❌ Error populating category select:', { module: 'categories', function: 'populateCategorySelect', error: error });
  });
}

/**
 * Populate the categories management modal
 * Loads categories and populates the modal with edit/delete options
 * 
 * @param {boolean} preserveScroll - Whether to preserve scroll position (default: false)
 * @returns {Promise<void>}
 */
function populateCategoriesModal(preserveScroll = false) {
  // Store current scroll position if preserving
  let scrollPosition = 0;
  if (preserveScroll) {
    const modalBody = document.querySelector('#categoryManagementModal .modal-body');
    if (modalBody) {
      scrollPosition = modalBody.scrollTop;
    }
  }

  $("#categoryList").find("div.row").remove();

  return categoryOperations.getCategories().then(result => {
    if (result.success) {
      debugLog?.info('Categories data:', { module: 'categories', function: 'populateCategoriesModal', data: result.data });
      result.data.forEach(row => {
        debugLog?.info('Category row:', { module: 'categories', function: 'populateCategoriesModal', row: row });
        debugLog?.info('Code:', { module: 'categories', function: 'populateCategoriesModal', code: row.code, description: row.description });
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
      debugLog?.info('✅ Categories modal populated successfully', { module: 'categories', function: 'populateCategoriesModal' });
      
      // Restore scroll position if preserving
      if (preserveScroll && scrollPosition > 0) {
        setTimeout(() => {
          const modalBody = document.querySelector('#categoryManagementModal .modal-body');
          if (modalBody) {
            modalBody.scrollTop = scrollPosition;
          }
        }, 10);
      }
    } else {
      debugLog?.warn('❌ Failed to populate categories modal:', { module: 'categories', function: 'populateCategoriesModal', error: result.error });
      throw new Error(result.error);
    }
  }).catch(error => {
    debugLog?.warn('❌ Error populating categories modal:', { module: 'categories', function: 'populateCategoriesModal', error: error });
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
        debugLog?.info('✅ Categories modal populated successfully (legacy)', { module: 'categories', function: 'populateCategoriesModal' });
        
        // Restore scroll position if preserving
        if (preserveScroll && scrollPosition > 0) {
          setTimeout(() => {
            const modalBody = document.querySelector('#categoryManagementModal .modal-body');
            if (modalBody) {
              modalBody.scrollTop = scrollPosition;
            }
          }, 10);
        }
      } catch (dbError) {
        debugLog?.error('❌ Legacy database error:', { module: 'categories', function: 'populateCategoriesModal', error: dbError });
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
    debugLog?.error('❌ Failed to open categories modal:', { module: 'categories', function: 'openCategoriesModal', error: error });
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
      debugLog?.info(`Checking code ${code}`, { module: 'categories', function: 'saveCategories', code: code });
      promises.push(
        categoryOperations.editCategory(code, description).then(result => {
          if (result.success) {
            debugLog?.info(`Saving changes to ${code} - new description is ${description}`, { module: 'categories', function: 'saveCategories', code: code, description: description });
          }
          return result;
        }).catch(error => {
          debugLog?.error(`❌ Failed to save category ${code}:`, { module: 'categories', function: 'saveCategories', code: code, error: error });
          throw error;
        })
      );
    }
  });
  
  return Promise.all(promises).then(() => {
    // Refresh the UI after saving
    populateCategorySelect();
    populateCategoriesModal();
    debugLog?.info('✅ All categories saved successfully', { module: 'categories', function: 'saveCategories' });
  }).catch(error => {
    debugLog?.error('❌ Error saving categories:', { module: 'categories', function: 'saveCategories', error: error });
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
  debugLog?.info(`Adding new category`, { module: 'categories', function: 'addNewCategoryUI' });
  
  const description = $("#newCategoryDescription").val();
  
  if (!description || description.trim() === '') {
    alert('Category description is required');
    return Promise.reject(new Error('Category description is required'));
  }
  
  return categoryOperations.addNewCategory(description).then(result => {
    if (result.success) {
      debugLog?.info(`Added new row into database`, { module: 'categories', function: 'addNewCategoryUI' });
      $("#newCategoryCode").val("");
      $("#newCategoryDescription").val("");
      populateCategorySelect();
      populateCategoriesModal();
      debugLog?.info('✅ New category added successfully', { module: 'categories', function: 'addNewCategoryUI' });
    } else {
      throw new Error('Failed to add category');
    }
  }).catch(error => {
    debugLog?.error('❌ Error adding new category:', { module: 'categories', function: 'addNewCategoryUI', error: error });
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
async function deleteCategoryUI(event, code, description) {
  event.preventDefault();
  
  try {
    // Use custom confirmation dialog
    if (typeof customConfirm === 'function') {
      const confirmed = await customConfirm(
        `Are you sure you want to delete "${description}" from Mx. Voice permanently? All songs in this category will be changed to the category "Uncategorized."`,
        'Delete Category'
      );
      
      if (confirmed) {
        debugLog?.info(`Deleting category ${code}`, { module: 'categories', function: 'deleteCategoryUI', code: code });
        
        const result = await categoryOperations.deleteCategory(code, description);
        if (result.success) {
          debugLog?.info(`✅ Category ${code} deleted successfully`, { module: 'categories', function: 'deleteCategoryUI', code: code });
          await populateCategorySelect();
          await populateCategoriesModal(true); // Preserve scroll position
          return result;
        } else {
          throw new Error('Failed to delete category');
        }
      }
      // User cancelled
      return;
    } else {
      // Fallback to native confirm
      if (confirm(`Are you sure you want to delete "${description}" from Mx. Voice permanently? All songs in this category will be changed to the category "Uncategorized."`)) {
        debugLog?.info(`Deleting category ${code}`, { module: 'categories', function: 'deleteCategoryUI', code: code });
        
        const result = await categoryOperations.deleteCategory(code, description);
        if (result.success) {
          debugLog?.info(`✅ Category ${code} deleted successfully`, { module: 'categories', function: 'deleteCategoryUI', code: code });
          await populateCategorySelect();
          await populateCategoriesModal(true); // Preserve scroll position
          return result;
        } else {
          throw new Error('Failed to delete category');
        }
      }
      // User cancelled
      return;
    }
  } catch (error) {
    debugLog?.error('❌ Error deleting category:', { module: 'categories', function: 'deleteCategoryUI', error: error });
    throw error;
  }
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