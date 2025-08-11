## Audio Module

The Audio module provides playback and control for the MxVoice application. It encapsulates the end‑to‑end flow: querying the database for a track, resolving the on‑disk path, creating and managing the Howler sound instance, tracking progress, and coordinating UI state.

### Structure
```
audio/
├── audio-manager.js     # Playback pipeline: DB → path → Howl → UI updates
├── audio-controller.js  # Controls: stop, pause, loop, UI resets
├── audio-utils.js       # Utilities for time/progress tracking
├── function-registry.js # Function names and fallbacks for global registry
├── index.js             # Module entry; exports singleton + named bindings
└── README.md
```

## Exports and interface

- Default export: a singleton instance of the Audio module (class with methods below)
- Named exports: bound function references for direct import

Available methods/functions:
- Playback: `playSongFromId(songId)`, `playSongWithFilename(filename, row, songId)`, `playSelected()`
- Autoplay: `autoplay_next()`, `cancel_autoplay()`
- Controls: `stopPlaying(fadeOut = false)`, `pausePlaying(fadeOut = false)`
- UI helpers: `resetUIState()`, `toggle_play_button()`, `loop_on(bool)`
- Diagnostics: `test()`, `getInfo()`

## Usage

### Option A: Use the singleton instance (default export)
```javascript
import audio from './audio/index.js';

audio.playSongFromId('123');
audio.stopPlaying(true);
audio.resetUIState();

// Diagnostics
const testResults = audio.test();
const info = audio.getInfo();
```

### Option B: Import named functions
```javascript
import { playSongFromId, stopPlaying, pausePlaying } from './audio/index.js';

playSongFromId('123');
stopPlaying(true);
pausePlaying();
```

## Integration with App Bootstrap

The Audio module is included in `module-config.js` and loaded by the App Bootstrap system. Because the default export is an object instance, it is used directly and its `init()` method (if present) is called automatically.

Example access after bootstrap:
```javascript
// After AppBootstrap.loadBasicModules(...)
const audioModule = moduleRegistry.audio; // singleton instance
audioModule.playSelected();
```

## Dependencies

- Howler.js: audio playback (uses global `Howl` instance)
- WaveSurfer (optional): waveform visualization via `sharedState` (`wavesurfer`)
- Secure adapters: `secureStore`, `secureDatabase`, `securePath` from `../adapters/secure-adapter.js`
- Shared state: central state via `../shared-state.js`

## Audio state management

Managed via `sharedState`:
- `sound`: current Howler sound instance
- `autoplay`: whether autoplay is enabled
- `loop`: loop mode
- `holdingTankMode`: 'storage' or 'playlist'
- `globalAnimation`: requestAnimationFrame handle for progress updates
- `wavesurfer`: optional waveform instance

## Error handling

- Robust logging via the centralized DebugLog system
- Database/query, path resolution, and playback errors are handled and logged
- Guards against missing IDs, invalid paths, and unavailable preferences

## Performance considerations

- On‑demand file loading and cleanup of Howler instances
- Progress tracking runs only while playing; animation handles are cleared
- Expensive operations gated behind preferences when applicable

## Migration from renderer.js

Extracted mappings:
- `playSongFromId`, `playSelected`, `song_ended`, `autoplay_next`, `cancel_autoplay` → `audio-manager.js`
- `stopPlaying`, `pausePlaying`, `resetUIState`, `toggle_play_button`, `loop_on` → `audio-controller.js`

## Notes

- The default export is the ready‑to‑use audio singleton; no manual construction required
- Named exports are bound to the singleton for convenient direct import
- If loaded via App Bootstrap, `init()` is invoked automatically