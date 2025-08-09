# Navigation Module

## Overview

The Navigation Module handles all navigation functionality for moving between items and sending songs to different containers. It provides keyboard shortcuts and navigation operations for a smooth user experience.

## Functions

### Core Functions

- **`sendToHotkeys()`** - Sends selected song to hotkeys
- **`sendToHoldingTank()`** - Sends selected song to holding tank
- **`selectNext()`** - Selects next item in list
- **`selectPrev()`** - Selects previous item in list

### Module Functions

- **`initializeNavigation()`** - Initializes the navigation module and sets up event handlers
- **`getNavigationFunctions()`** - Returns all navigation functions as an object

### Event Handlers

- **`setupNavigationEventHandlers()`** - Sets up all navigation event handlers

## Features

### Keyboard Navigation
- **Tab Key** - Sends selected song to hotkeys
- **Shift+Tab Key** - Sends selected song to holding tank
- **Down Arrow** - Selects next item in list
- **Up Arrow** - Selects previous item in list

### Song Transfer
- **Hotkey Assignment** - Assigns selected songs to hotkey containers
- **Holding Tank Addition** - Adds selected songs to holding tank
- **Duplicate Prevention** - Prevents duplicate assignments to hotkeys
- **Visual Feedback** - Updates labels and UI elements

### List Navigation
- **Sequential Selection** - Moves selection up and down in lists
- **ID Management** - Manages selected_row ID for visual feedback
- **Boundary Handling** - Handles navigation at list boundaries

## Event Handlers

### Keyboard Shortcuts
- **Tab** - Triggers sendToHotkeys()
- **Shift+Tab** - Triggers sendToHoldingTank()
- **Down Arrow** - Triggers selectNext()
- **Up Arrow** - Triggers selectPrev()

## Usage

```javascript
// Initialize the navigation module
import { initializeNavigation } from './navigation/index.js';
initializeNavigation();

// Use navigation functions directly
import { sendToHotkeys, selectNext } from './navigation/index.js';
sendToHotkeys();
selectNext();

// Get all navigation functions
import { getNavigationFunctions } from './navigation/index.js';
const navigationFunctions = getNavigationFunctions();
```

## Dependencies

- jQuery for DOM manipulation and selection
- Database module for song information retrieval
- Holding tank module for song addition
- Hotkeys module for song assignment
- Mousetrap for keyboard event handling

## Supported Operations

### Navigation Operations
- Move selection up and down in lists
- Send songs to hotkey containers
- Send songs to holding tank
- Keyboard shortcut handling

### UI Operations
- Update selected row highlighting
- Manage song assignments
- Provide visual feedback
- Handle keyboard events 