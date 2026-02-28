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
- Automatic initialization of soundboard grid when switching to soundboard view

## View Switching Behavior

**When switching TO soundboard view:**
1. Traditional view hidden (`display: none`)
2. Soundboard view shown (`display: flex`)
3. Soundboard grid layout initialized/updated
4. Search panel state restored from profile
5. View preference saved to profile

**When switching FROM soundboard view:**
1. Soundboard state saved to profile (button assignments, tab states)
2. Soundboard view hidden
3. Traditional view restored
4. View preference saved to profile

## Keyboard Shortcuts

View switching is triggered via menu shortcuts (handled by main process):
- Default shortcut available in View menu
- IPC event: `view:toggle-soundboard-mode`

