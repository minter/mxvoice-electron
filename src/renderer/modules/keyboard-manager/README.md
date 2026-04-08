## Keyboard Manager Module

Comprehensive keyboard shortcut management including F1-F12 hotkey bindings, navigation shortcuts, and dynamic shortcut registration. Uses Mousetrap for key binding.

### Structure
```
keyboard-manager/
├── index.js                # KeyboardManager class coordinator
├── hotkey-bindings.js      # F1-F12 hotkey tab playback bindings
├── navigation-shortcuts.js # Arrow key, Enter, Escape navigation
├── shortcut-registry.js    # Dynamic shortcut registration and management
└── README.md
```

### Components

- **KeyboardManager** (`index.js`) — Coordinates all keyboard shortcut functionality. Initializes components in order: registry, hotkey bindings, navigation shortcuts.

- **HotkeyBindings** (`hotkey-bindings.js`) — Manages F1-F12 key bindings for playing songs from hotkey tabs. Handles binding/unbinding as hotkey tabs are loaded or cleared.

- **NavigationShortcuts** (`navigation-shortcuts.js`) — Arrow key navigation through search results, Enter to play selected song, Escape to clear selection. Handles focus management between search field and results.

- **ShortcutRegistry** (`shortcut-registry.js`) — Central registry for all keyboard shortcuts. Supports registering, unregistering, and listing active shortcuts. Prevents conflicts between shortcut groups.

### Usage

```javascript
import { KeyboardManager } from './modules/keyboard-manager/index.js';

const keyboard = new KeyboardManager({ debugLog });
await keyboard.init({ registry: {}, moduleRegistry });
```

### Notes

- Extracted from renderer.js as part of Phase 5 modularization
- All shortcuts are managed through the central registry to prevent conflicts
- Hotkey bindings update dynamically when hotkey tab content changes
