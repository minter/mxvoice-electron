/**
 * Audio Module Function Registry
 * 
 * Defines which functions from the audio module should be globally available
 */

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
  playSongFromIdFallback: () => console.warn('⚠️ Audio module not available - playSongFromId'),
  stopPlayingFallback: () => console.warn('⚠️ Audio module not available - stopPlaying'),
  pausePlayingFallback: () => console.warn('⚠️ Audio module not available - pausePlaying'),
  resetUIStateFallback: () => console.warn('⚠️ Audio module not available - resetUIState'),
  autoplay_nextFallback: () => console.warn('⚠️ Audio module not available - autoplay_next'),
  cancel_autoplayFallback: () => console.warn('⚠️ Audio module not available - cancel_autoplay'),
  playSelectedFallback: () => console.warn('⚠️ Audio module not available - playSelected'),
  loop_onFallback: () => console.warn('⚠️ Audio module not available - loop_on')
};

export default audioFunctions; 