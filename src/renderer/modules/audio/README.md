# Audio Module

The Audio module provides audio playback and control functionality for the MxVoice Electron application. This module handles all audio-related operations including playing, pausing, stopping, and managing audio state.

## Structure

```
audio/
├── audio-manager.js    # Main audio playback functionality
├── audio-controller.js # Audio control functions
├── index.js           # Main module entry point
└── README.md          # This file
```

## Components

### Audio Manager (`audio-manager.js`)

Handles the main audio playback functionality.

**Functions:**
- `playSongFromId(song_id)` - Play a song from its database ID
- `playSelected()` - Play the currently selected song
- `song_ended()` - Handle song end event
- `autoplay_next()` - Autoplay next song in playlist
- `cancel_autoplay()` - Cancel autoplay functionality

**Usage:**
```javascript
import { playSongFromId, playSelected } from './audio/index.js';

// Play a specific song
playSongFromId('123');

// Play the selected song
playSelected();
```

### Audio Controller (`audio-controller.js`)

Handles audio control and UI state management.

**Functions:**
- `stopPlaying(fadeOut)` - Stop audio playback with optional fade out
- `pausePlaying(fadeOut)` - Pause audio playback with optional fade out
- `resetUIState()` - Reset UI state after audio changes
- `toggle_play_button()` - Toggle play button state
- `loop_on(bool)` - Toggle loop mode

**Usage:**
```javascript
import { stopPlaying, pausePlaying, resetUIState } from './audio/index.js';

// Stop audio with fade out
stopPlaying(true);

// Pause audio
pausePlaying();

// Reset UI state
resetUIState();
```

## Module Interface

The main module provides a unified interface for all audio functionality:

```javascript
import audio from './audio/index.js';

// Access individual functions
audio.playSongFromId('123');
audio.stopPlaying(true);
audio.resetUIState();

// Or use the module instance
const audioModule = audio.audio;
audioModule.playSongFromId('123');
```

## Dependencies

- **Howler.js**: Required for audio playback
- **jQuery**: Required for DOM manipulation
- **WaveSurfer**: Required for waveform visualization
- **Electron API**: Required for file system access

## Testing

The module includes built-in testing functionality:

```javascript
import audio from './audio/index.js';

// Test all audio functions
const testResults = audio.audio.test();
console.log(testResults);

// Get module information
const info = audio.audio.getInfo();
console.log(info);
```

## Integration with Module Loader

The Audio module can be integrated with the Module Loader:

```javascript
import audio from './audio/index.js';
import { loader } from '../module-loader.js';

// Register the audio module
loader.registerModule('audio', audio.audio);

// Load the audio module
const loadedAudio = loader.loadModule('audio');

// Use the loaded audio functions
loadedAudio.playSongFromId('123');
```

## Migration from renderer.js

The following functions were extracted from `renderer.js`:

- `playSongFromId()` → `audio-manager.js`
- `playSelected()` → `audio-manager.js`
- `song_ended()` → `audio-manager.js`
- `autoplay_next()` → `audio-manager.js`
- `cancel_autoplay()` → `audio-manager.js`
- `stopPlaying()` → `audio-controller.js`
- `pausePlaying()` → `audio-controller.js`
- `resetUIState()` → `audio-controller.js`
- `toggle_play_button()` → `audio-controller.js`
- `loop_on()` → `audio-controller.js`

## Audio State Management

The module manages several global audio states:

- `sound`: The current Howl audio instance
- `autoplay`: Whether autoplay is enabled
- `loop`: Whether loop mode is enabled
- `holdingTankMode`: Current holding tank mode ('storage' or 'playlist')
- `globalAnimation`: Animation frame for time tracking

## Error Handling

The module includes comprehensive error handling:

- Database query failures
- File system access errors
- Audio loading failures
- Network errors for remote files
- Invalid song IDs

## Performance Considerations

- Audio files are loaded on-demand
- Unused audio instances are properly unloaded
- Animation frames are managed efficiently
- Memory leaks are prevented through proper cleanup

## Future Enhancements

- Add audio format support (MP3, WAV, OGG, etc.)
- Add audio effects and filters
- Add playlist management features
- Add audio visualization options
- Add streaming audio support

## Notes

- All functions maintain the same interface as the original renderer.js functions
- The module is designed to be backward compatible
- Functions are exported both individually and as part of the module instance
- The module includes comprehensive error handling and logging
- Audio state is managed globally to maintain consistency 