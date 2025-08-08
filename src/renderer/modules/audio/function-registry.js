/**
 * Audio Module Function Registry
 * 
 * Defines which functions from the audio module should be globally available
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

export const audioFunctions = {
  // Core audio playback functions
  playSongFromId: 'playSongFromId',
  stopPlaying: 'stopPlaying',
  pausePlaying: 'pausePlaying',
  resetUIState: 'resetUIState',
  
  // Autoplay functions
  autoplay_next: 'autoplay_next',
  cancel_autoplay: 'cancel_autoplay',
  
  // Playback control functions
  playSelected: 'playSelected',
  loop_on: 'loop_on',
  
  // Fallback functions for when module fails to load
  playSongFromIdFallback: () => debugLog?.warn('⚠️ Audio module not available - playSongFromId', { 
    module: 'audio-function-registry',
    function: 'playSongFromIdFallback'
  }),
  stopPlayingFallback: () => debugLog?.warn('⚠️ Audio module not available - stopPlaying', { 
    module: 'audio-function-registry',
    function: 'stopPlayingFallback'
  }),
  pausePlayingFallback: () => debugLog?.warn('⚠️ Audio module not available - pausePlaying', { 
    module: 'audio-function-registry',
    function: 'pausePlayingFallback'
  }),
  resetUIStateFallback: () => debugLog?.warn('⚠️ Audio module not available - resetUIState', { 
    module: 'audio-function-registry',
    function: 'resetUIStateFallback'
  }),
  autoplay_nextFallback: () => debugLog?.warn('⚠️ Audio module not available - autoplay_next', { 
    module: 'audio-function-registry',
    function: 'autoplay_nextFallback'
  }),
  cancel_autoplayFallback: () => debugLog?.warn('⚠️ Audio module not available - cancel_autoplay', { 
    module: 'audio-function-registry',
    function: 'cancel_autoplayFallback'
  }),
  playSelectedFallback: () => debugLog?.warn('⚠️ Audio module not available - playSelected', { 
    module: 'audio-function-registry',
    function: 'playSelectedFallback'
  }),
  loop_onFallback: () => debugLog?.warn('⚠️ Audio module not available - loop_on', { 
    module: 'audio-function-registry',
    function: 'loop_onFallback'
  })
};

export default audioFunctions; 