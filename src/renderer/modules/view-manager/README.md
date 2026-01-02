# View Manager Module

Manages switching between Traditional View and Soundboard View in the MxVoice application.

## Purpose

The View Manager module provides a centralized way to:
- Switch between Traditional View (three-panel layout) and Soundboard View (grid layout)
- Preserve state when switching views
- Persist view preference per user profile

## Exports

### Default Export
- `viewManager` - Singleton instance of ViewManager class

### Named Exports
- `viewManager` - Same singleton instance

## Usage

```javascript
import viewManager from './modules/view-manager/index.js';

// Get current view
const currentView = viewManager.getCurrentView(); // 'traditional' | 'soundboard'

// Switch views
await viewManager.switchToTraditionalView();
await viewManager.switchToSoundboardView();

// Toggle between views
await viewManager.toggleView();
```

## Initialization

The module is initialized during app bootstrap. Dependencies are injected via `reinitializeViewManager()`:

```javascript
await viewManager.reinitializeViewManager({
  electronAPI: window.secureElectronAPI,
  profileState: profileStateModule,
  debugLog: debugLog
});
```

## Integration

- **Profile State**: View preference is saved as part of profile state
- **Menu Integration**: Updates menu state via IPC to main process
- **Soundboard Module**: Coordinates with soundboard module for state management

## State Management

- `currentView`: Current active view ('traditional' | 'soundboard')
- View preference persisted per profile
- State preservation when switching views

