# Event Coordination Module

## Overview

The Event Coordination Module is Phase 2 of the renderer.js modularization plan. It extracts all jQuery event handling logic from the main renderer.js file and organizes it into specialized, maintainable modules.

## Architecture

This module follows a coordinated approach to event handling:

```
event-coordination/
├── index.js                 # Main coordinator and entry point
├── search-events.js         # Search form, results, live search events
├── audio-control-events.js  # Play/pause/stop/volume control events  
├── ui-interaction-events.js # Modals, tabs, window resize events
├── dom-initialization.js    # Tab creation, context menus setup
├── event-delegator.js       # Event delegation patterns
└── README.md               # This documentation
```

## Key Features

### 1. Centralized Event Management
- **Coordinated Initialization**: All event handlers are initialized through a single entry point
- **Dependency Injection**: Proper handling of electronAPI, db, store, debugLog, and moduleRegistry
- **Order Management**: Ensures DOM initialization happens before event attachment

### 2. Separation of Concerns
- **Search Events**: Handles all search-related interactions (forms, live search, filters)
- **Audio Control Events**: Manages playback controls (play, pause, stop, volume, progress)
- **UI Interaction Events**: Handles modals, tabs, window operations, context menus
- **DOM Initialization**: Sets up initial DOM structure (tabs, context menus)
- **Event Delegation**: Optimized event delegation patterns

### 3. Module Integration
- **Function Registry Compatibility**: Works with existing function registry system
- **Module Registry Access**: Can call functions from other modules
- **Error Handling**: Graceful fallbacks when modules are unavailable
- **Debug Integration**: Comprehensive logging for troubleshooting

## Usage

### Basic Usage
```javascript
import EventCoordination from './modules/event-coordination/index.js';

// Initialize the event coordination
const eventCoordination = new EventCoordination({
  electronAPI: window.electronAPI,
  db: window.db,
  store: window.store,
  debugLog: window.debugLog,
  moduleRegistry: window.moduleRegistry
});

// Initialize and attach events (typically called after DOM ready)
await eventCoordination.initialize();
await eventCoordination.attachEventHandlers();
```

### Function-based Usage
```javascript
import { initializeEventCoordination } from './modules/event-coordination/index.js';

const eventCoordination = initializeEventCoordination({
  electronAPI: window.electronAPI,
  db: window.db,
  store: window.store,
  debugLog: window.debugLog,
  moduleRegistry: window.moduleRegistry
});

await eventCoordination.attachEventHandlers();
```

## Event Handler Categories

### Search Events (search-events.js)
Extracted from renderer.js lines 774-885:
- Search form submission and reset
- Live search with debouncing
- Category and date filter changes
- Advanced search toggle
- Omni search input handling

### Audio Control Events (audio-control-events.js)
Extracted from renderer.js lines 924-1104:
- Play/pause/stop button clicks
- Volume control and mute functionality
- Progress bar and waveform seeking
- Loop button toggle
- Waveform display toggle

### UI Interaction Events (ui-interaction-events.js)
Extracted from renderer.js lines 1110-1239:
- Modal show/hide events
- Tab double-click for renaming
- Window resize handling
- Form modal events
- Preferences modal events
- First run modal logic

### DOM Initialization (dom-initialization.js)
Extracted from renderer.js lines 684-773:
- Tab structure creation (hotkeys 2-5, holding tanks 2-5)
- Context menu setup
- Song row click/double-click events
- Holding tank and hotkey list events
- Search results interaction setup

## Implementation Details

### Event Delegation
The module uses efficient event delegation patterns:
```javascript
// Instead of individual handlers on each row
$("#search_results").on("click", "tbody tr", function(event) {
  toggleSelectedRow(this);
});

// Instead of
$("tr").each(function() {
  $(this).on("click", handler);
});
```

### Module Function Integration
Event handlers properly integrate with other modules:
```javascript
$("#pause_button").click(function(e) {
  if (window.pausePlaying) {
    if (e.shiftKey) {
      window.pausePlaying(true);
    } else {
      window.pausePlaying();
    }
  }
});
```

### Error Handling
All event handlers include proper error handling:
```javascript
try {
  if (window.searchData) {
    window.searchData();
    this.debugLog?.info('searchData called successfully');
  } else {
    this.debugLog?.warn('searchData function not available');
  }
} catch (error) {
  this.debugLog?.error('Error calling searchData:', error);
}
```

## Benefits

### 1. Maintainability
- **Single Responsibility**: Each file handles one category of events
- **Clear Organization**: Easy to find and modify specific event handlers
- **Reduced Complexity**: Smaller, focused files instead of one massive file

### 2. Testability
- **Unit Testing**: Each event handler category can be tested independently
- **Mock Support**: Easy to mock dependencies for testing
- **Integration Testing**: Can test event coordination as a whole

### 3. Performance
- **Event Delegation**: Efficient event handling with delegation patterns
- **Lazy Loading**: Event handlers only attached when needed
- **Memory Management**: Proper cleanup and detachment support

### 4. Developer Experience
- **Clear Structure**: Easy to understand where events are handled
- **Debug Support**: Comprehensive logging for troubleshooting
- **Hot Reload**: Better development experience with modular structure

## Migration from renderer.js

This module replaces approximately 558 lines of jQuery event handling code from renderer.js (lines 685-1243). The original code has been:

1. **Categorized**: Split into logical event handler groups
2. **Modernized**: Updated with proper error handling and logging
3. **Integrated**: Connected with the existing module ecosystem
4. **Optimized**: Improved with event delegation patterns

## Debugging

### Status Check
```javascript
const status = eventCoordination.getStatus();
console.log('Event Coordination Status:', status);
```

### Module Availability
The module provides comprehensive logging to help debug event handler issues:
- Module initialization status
- Event attachment success/failure
- Function availability checks
- Error details with stack traces

## Future Enhancements

### Planned Features
1. **Dynamic Event Management**: Add/remove event handlers at runtime
2. **Event Analytics**: Track event usage and performance
3. **Custom Event System**: Support for custom application events
4. **Keyboard Shortcut Manager**: Enhanced keyboard shortcut handling

### Performance Optimizations
1. **Event Throttling**: Throttle high-frequency events (resize, scroll)
2. **Event Prioritization**: Priority queue for event handler execution
3. **Memory Optimization**: Automatic cleanup of unused event handlers

## Testing

The module supports comprehensive testing:
- **Unit Tests**: Individual event handler testing
- **Integration Tests**: Full event coordination testing
- **Mock Support**: Easy mocking of dependencies
- **Error Simulation**: Testing error conditions and fallbacks

See `test/test-event-coordination-module-page.html` for testing examples.
