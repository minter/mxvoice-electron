## Categories Module

Unified category management, UI helpers, and data utilities.

### Structure
```
categories/
├── category-operations.js  # CRUD against DB/API
├── category-ui.js          # Modal/dropdown helpers
├── category-data.js        # In‑memory data and validation
├── index.js                # Module entry; singleton with methods
└── README.md
```

## Exports and interface

- Default export: singleton instance
- Named exports: bound methods (via `index.js`)

Methods include:
- Operations: `getCategories`, `getCategoryByCode`, `addNewCategory`, `editCategory`, `deleteCategory`, `updateCategory`
- UI: `populateCategorySelect`, `populateCategoriesModal`, `editCategoryUI`, `openCategoriesModal`, `saveCategories`, `addNewCategoryUI`, `deleteCategoryUI`
- Data: `loadCategories`, `refreshCategories`, `validateCategoryCode`, `generateCategoryCode`
- Lifecycle: `init()` to preload categories

## Usage

```javascript
import categories from './modules/categories/index.js';

await categories.init();
await categories.populateCategorySelect();
await categories.addNewCategory('Rock Music');
```

UI hooks:
```javascript
$('#categoryForm').on('submit', (e) => categories.addNewCategoryUI(e));
$('.delete-category').on('click', (e) => {
  const code = $(e.currentTarget).data('code');
  const description = $(e.currentTarget).data('description');
  categories.deleteCategoryUI(e, code, description);
});
```

## Notes
- Default export is ready‑to‑use singleton; named exports are bound for direct import
- Logs via DebugLog when available
- Works with secure Electron APIs where applicable