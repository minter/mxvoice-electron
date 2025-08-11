# Search Module

The Search Module provides comprehensive search functionality for the MxVoice Electron application. It includes basic search, live search with debouncing, and advanced search capabilities.

## Overview

The search module is organized into several sub-modules:

- **search-engine.js** - Core search functionality
- **live-search.js** - Real-time search with debouncing
- **advanced-search.js** - Advanced search interface management
- **index.js** - Main module interface and coordination

## Features

### Basic Search
- Search across title, artist, and info fields
- Category filtering
- Database query optimization
- Fallback support for legacy database access

### Live Search
- Real-time search as user types
- 300ms debouncing for performance
- Limited to 50 results for speed
- Advanced filter integration

### Advanced Search
- Toggle interface for advanced search options
- Title, artist, info, and date filtering
- Smooth animations
- Focus management

## Usage

### Loading the Module

```javascript
import search from './modules/search/index.js';

// Named bindings also exported
import { searchData, performLiveSearch, toggleAdvancedSearch } from './modules/search/index.js';
```

### Basic Search

```javascript
// Perform a basic search
searchData();

// Clear search results
searchModule.clearSearchResults();
```

### Live Search

```javascript
// Perform live search with a term
performLiveSearch('search term');

// Trigger live search with debouncing
search.triggerLiveSearch();
```

### Advanced Search

```javascript
// Toggle advanced search interface
toggleAdvancedSearch();
```

### Query Building

```javascript
// Build a search query
const query = search.buildSearchQuery('search term', true);
console.log(query.queryString);
console.log(query.queryParams);
```

## Module Structure

```
search/
├── index.js           # Main module interface
├── search-engine.js   # Core search functionality
├── live-search.js     # Live search implementation
├── advanced-search.js # Advanced search UI management
└── README.md         # This documentation
```

## Dependencies

The search module depends on:

- DOM utilities: `Dom` helpers from `modules/dom-utils/index.js`
- Global variables: `fontSize`, `categories`, `db`
- Global functions: `scale_scrollable`, `animateCSS`
- Electron API: `window.electronAPI.database`

## Testing

### Browser Testing

1. Open `test-search-module-page.html` in a browser
2. Use the test controls to verify functionality
3. Check console output for detailed results

### Node.js Testing

```bash
node test-search-module-browser.js
```

## API Reference

### searchData()
Performs a search on the database using current form values.

### performLiveSearch(searchTerm)
Performs a live search with the given search term.

**Parameters:**
- `searchTerm` (string) - The search term to search for

### toggleAdvancedSearch()
Toggles the advanced search interface visibility.

### clearSearchResults()
Clears all search results from the UI.

### triggerLiveSearch()
Triggers a live search with debouncing (300ms delay).

### buildSearchQuery(searchTerm, isLiveSearch)
Builds a SQL query string and parameters for search.

**Parameters:**
- `searchTerm` (string) - The search term
- `isLiveSearch` (boolean) - Whether this is a live search

**Returns:**
- `Object` with `queryString` and `queryParams` properties

## Error Handling

The module includes comprehensive error handling:

- Database API fallback to legacy access
- Graceful degradation when dependencies are missing
- Console logging for debugging
- Try-catch blocks around critical operations

## Performance Considerations

- Live search is debounced to 300ms
- Results are limited to 50 for live search
- Database queries are optimized with prepared statements
- UI updates are batched where possible
- Rendering uses safe DOM creation (no HTML string concatenation). Rows are created with `document.createElement`, text is set via `textContent`, and drag handlers are attached with `addEventListener('dragstart', songDrag)`.
- Result rows are appended using `DocumentFragment` to minimize layout thrash and improve rendering performance.

## Security Notes

- User-controlled values (e.g., `title`, `artist`, `info`) are never inserted as HTML. We use `textContent` to prevent XSS.
- Inline DOM event attributes (e.g., `ondragstart`) are avoided; events are bound programmatically.

## Integration

The search module integrates with:

- Main renderer process
- Database module
- UI utilities
- Animation system

## Future Enhancements

- Search result caching
- Search history
- Search suggestions
- Fuzzy search matching
- Search result highlighting 