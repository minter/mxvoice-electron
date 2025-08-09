# Categories Module

The Categories Module handles all category-related operations in the MxVoice Electron application. It provides a unified interface for category management, UI population, and database interactions.

## Module Structure

```
categories/
├── index.js              # Main module entry point
├── category-operations.js # Database operations for categories
├── category-ui.js        # UI-related operations for categories
├── category-data.js      # Data management and validation
└── README.md            # This documentation
```

## Features

### Category Operations
- **getCategories()** - Retrieve all categories from database
- **getCategoryByCode(code)** - Get specific category by code
- **editCategory(code, description)** - Update category description
- **deleteCategory(code, description)** - Delete category and move songs to "Uncategorized"
- **addNewCategory(description)** - Add new category with auto-generated code

### Category UI
- **populateCategorySelect()** - Populate category dropdown
- **populateCategoriesModal()** - Populate categories management modal
- **editCategoryUI(code)** - Show edit input field for category
- **openCategoriesModal()** - Open categories management modal
- **saveCategories(event)** - Save category changes from modal
- **addNewCategoryUI(event)** - Add new category from UI
- **deleteCategoryUI(event, code, description)** - Delete category from UI

### Category Data
- **loadCategories()** - Load categories into module state
- **refreshCategories()** - Refresh categories from database
- **validateCategoryCode(code)** - Validate category code format and uniqueness
- **generateCategoryCode(description)** - Generate unique category code from description
- **getCategoryDescription(code)** - Get category description by code
- **categoryExists(code)** - Check if category exists
- **getCategoryCount()** - Get total number of categories
- **getSortedCategories()** - Get categories sorted by description
- **filterCategories(filter)** - Filter categories by description

## Usage

### Basic Usage

```javascript
// Load the categories module
import categoriesModule from './modules/categories/index.js';

// Initialize the module
await categoriesModule.categories.init();

// Populate category select dropdown
await categoriesModule.populateCategorySelect();

// Add a new category
const result = await categoriesModule.addNewCategory("Rock Music");
console.log(`Added category: ${result.code} - ${result.description}`);

// Edit a category
await categoriesModule.editCategory("ROCK", "Rock & Roll Music");

// Delete a category
await categoriesModule.deleteCategory("ROCK", "Rock & Roll Music");
```

### UI Integration

```javascript
// Populate category select dropdown
categoriesModule.populateCategorySelect();

// Open categories management modal
categoriesModule.openCategoriesModal();

// Handle category form submission
$("#categoryForm").on("submit", function(event) {
  categoriesModule.addNewCategoryUI(event);
});

// Handle category deletion
$(".delete-category").on("click", function(event) {
  const code = $(this).data("code");
  const description = $(this).data("description");
  categoriesModule.deleteCategoryUI(event, code, description);
});
```

### Data Management

```javascript
// Load categories into module state
await categoriesModule.loadCategories();

// Refresh categories from database
await categoriesModule.refreshCategories();

// Validate a category code
const isValid = await categoriesModule.validateCategoryCode("ROCK");

// Generate unique category code
const code = await categoriesModule.generateCategoryCode("Rock Music");

// Get category information
const description = categoriesModule.getCategoryDescription("ROCK");
const count = categoriesModule.getCategoryCount();
const sorted = categoriesModule.getSortedCategories();
```

## API Reference

### Category Operations

#### getCategories()
Retrieves all categories from the database.

**Returns:** Promise<Object>
- `success` (boolean): Operation success status
- `data` (Array): Array of category objects with `code` and `description`

#### getCategoryByCode(code)
Gets a specific category by its code.

**Parameters:**
- `code` (string): Category code

**Returns:** Promise<Object>
- `success` (boolean): Operation success status
- `data` (Object): Category object with `code` and `description`

#### editCategory(code, description)
Updates a category's description.

**Parameters:**
- `code` (string): Category code
- `description` (string): New category description

**Returns:** Promise<Object>
- `success` (boolean): Operation success status
- `changes` (number): Number of rows affected

#### deleteCategory(code, description)
Deletes a category and moves all songs to "Uncategorized".

**Parameters:**
- `code` (string): Category code to delete
- `description` (string): Category description for confirmation

**Returns:** Promise<Object>
- `success` (boolean): Operation success status
- `changes` (number): Number of rows affected

#### addNewCategory(description)
Adds a new category with auto-generated code.

**Parameters:**
- `description` (string): Category description

**Returns:** Promise<Object>
- `success` (boolean): Operation success status
- `code` (string): Generated category code
- `description` (string): Category description

### Category UI

#### populateCategorySelect()
Populates the category select dropdown with all categories.

**Returns:** Promise<void>

#### populateCategoriesModal()
Populates the categories management modal with edit/delete options.

**Returns:** Promise<void>

#### editCategoryUI(code)
Shows the edit input field for a specific category.

**Parameters:**
- `code` (string): Category code to edit

#### openCategoriesModal()
Opens the categories management modal.

#### saveCategories(event)
Saves category changes from the modal.

**Parameters:**
- `event` (Event): Form submit event

**Returns:** Promise<void>

#### addNewCategoryUI(event)
Adds a new category from the UI form.

**Parameters:**
- `event` (Event): Form submit event

**Returns:** Promise<void>

#### deleteCategoryUI(event, code, description)
Deletes a category from the UI with confirmation.

**Parameters:**
- `event` (Event): Click event
- `code` (string): Category code to delete
- `description` (string): Category description for confirmation

**Returns:** Promise<void>

### Category Data

#### loadCategories()
Loads categories into the module's internal state.

**Returns:** Promise<Object>
- `success` (boolean): Operation success status
- `data` (Object): Categories data object

#### refreshCategories()
Refreshes categories from the database.

**Returns:** Promise<Object>
- `success` (boolean): Operation success status
- `data` (Object): Refreshed categories data

#### validateCategoryCode(code)
Validates a category code format and uniqueness.

**Parameters:**
- `code` (string): Category code to validate

**Returns:** Promise<boolean>
- `true` if valid, `false` otherwise

#### generateCategoryCode(description)
Generates a unique category code from description.

**Parameters:**
- `description` (string): Category description

**Returns:** Promise<string>
- Generated unique category code

#### getCategoryDescription(code)
Gets category description by code.

**Parameters:**
- `code` (string): Category code

**Returns:** string|null
- Category description or null if not found

#### categoryExists(code)
Checks if a category exists.

**Parameters:**
- `code` (string): Category code to check

**Returns:** boolean
- `true` if category exists, `false` otherwise

#### getCategoryCount()
Gets the total number of categories.

**Returns:** number
- Number of categories

#### getSortedCategories()
Gets categories sorted by description.

**Returns:** Array<Object>
- Sorted array of category objects

#### filterCategories(filter)
Filters categories by description.

**Parameters:**
- `filter` (string): Filter string to match against descriptions

**Returns:** Array<Object>
- Filtered array of category objects

## Error Handling

The module includes comprehensive error handling with fallback to legacy database access when the new API is not available. All functions return promises and include proper error logging.

## Legacy Support

The module maintains backward compatibility with the legacy database access pattern while providing modern API interfaces. It automatically falls back to legacy methods when the new API is not available.

## Testing

The module includes built-in testing capabilities:

```javascript
// Test all category functions
const testResults = categoriesModule.categories.test();
console.log(testResults);

// Get module information
const info = categoriesModule.categories.getInfo();
console.log(info);
```

## Migration from renderer.js

This module extracts the following functions from the original renderer.js:

- `populateCategorySelect()`
- `populateCategoriesModal()`
- `editCategory()`
- `deleteCategory()`
- `addNewCategory()`
- `saveCategories()`

The module provides a cleaner, more maintainable interface while preserving all original functionality. 