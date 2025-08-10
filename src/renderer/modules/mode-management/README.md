## Mode Management Module

Handles holding tank mode (storage vs playlist) and autoplay, with persistence via secure store.

### Structure
```
mode-management/
├── index.js              # Singleton with methods
└── README.md
```

## Exports and interface
- Default export: singleton instance
- Methods:
  - `initModeManagement()` / `init()`
  - `setHoldingTankMode(mode)`
  - `getHoldingTankMode()`
  - `toggleAutoPlay()`
  - `getAutoPlayState()`
  - `setAudioContext(audioContext)`
  - `resetToDefaultMode()`

## Usage
```javascript
import mode from './modules/mode-management/index.js';

await mode.initModeManagement();
await mode.setHoldingTankMode('playlist');
await mode.toggleAutoPlay();
const currentMode = mode.getHoldingTankMode();
```

## Notes
- Persists mode using secure store (`secureStore`)
- Updates shared state keys `holdingTankMode` and `autoplay`
- Adjusts DOM classes for mode buttons and container