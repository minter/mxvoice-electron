/**
 * Audio Controller Module
 * 
 * This module handles audio control functionality
 * in the MxVoice Electron application.
 * 
 * PHASE 2 SECURITY MIGRATION: Now uses secure adapters for store operations
 */

// Import secure adapters for Phase 2 migration
import { secureStore } from '../adapters/secure-adapter.js';

// Import shared state
import sharedState from '../shared-state.js';

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

/**
 * Stop audio playback
 * 
 * @param {boolean} fadeOut - Whether to fade out the audio
 */
function stopPlaying(fadeOut = false) {
  const sound = sharedState.get('sound');
  const autoplay = sharedState.get('autoplay');
  const holdingTankMode = sharedState.get('holdingTankMode');
  const globalAnimation = sharedState.get('globalAnimation');
  
  // Cancel any ongoing animation frame to prevent memory leaks
  if (globalAnimation) {
    cancelAnimationFrame(globalAnimation);
    sharedState.set('globalAnimation', null);
  }
  
  if (sound) {
    if (autoplay && holdingTankMode === "playlist") {
      const np = document.querySelector('.now_playing');
      if (np) np.classList.remove('now_playing');
    }
    if (fadeOut) {
      debugLog?.info("Taking fade out path", { 
        module: 'audio-controller',
        function: 'stopPlaying',
        fadeOut: fadeOut
      });
      secureStore.get("fade_out_seconds").then(result => {
        if (!result.success || !result.value) {
          debugLog?.warn('Failed to get fade_out_seconds:', { 
            module: 'audio-controller',
            function: 'stopPlaying',
            result: result
          });
          // Fallback to immediate stop
          try {
            if (sound.stop && typeof sound.stop === 'function') {
              sound.stop();
            }
          } catch (error) {
            debugLog?.warn('Error stopping sound in fade fallback', {
              module: 'audio-controller',
              function: 'stopPlaying',
              error: error.message
            });
          }
          sound.unload();
          sharedState.set('sound', null);
          resetUIState();
          return;
        }
        const fadeSeconds = result.value;
        debugLog?.info("Fade out seconds:", { 
          module: 'audio-controller',
          function: 'stopPlaying',
          fadeSeconds: fadeSeconds
        });
        
        // Extract the numeric value from the response  
        const fadeDuration = parseFloat(fadeSeconds) * 1000;
        debugLog?.info("Fade duration:", { 
          module: 'audio-controller',
          function: 'stopPlaying',
          fadeDuration: fadeDuration
        });
        
        // Check if sound is still valid
        if (!sound || !sound.volume) {
          debugLog?.info("Sound is no longer valid, stopping", { 
            module: 'audio-controller',
            function: 'stopPlaying'
          });
          resetUIState();
          return;
        }
        
        // Remove any existing fade listeners to avoid conflicts
        sound.off("fade");
        
        // Set up fade completion handler
        sound.on("fade", function () {
          debugLog?.info("Fade event fired, unloading sound", { 
            module: 'audio-controller',
            function: 'stopPlaying'
          });
          if (sound) {
            // Stop before unloading
            try {
              if (sound.stop && typeof sound.stop === 'function') {
                sound.stop();
              }
            } catch (error) {
              debugLog?.warn('Error stopping sound during fade', {
                module: 'audio-controller',
                function: 'stopPlaying',
                error: error.message
              });
            }
            sound.unload();
            // Clear from sharedState
            sharedState.set('sound', null);
            resetUIState();
          }
        });
        
        // Start the fade
        const currentVolume = sound.volume();
        sound.fade(currentVolume, 0, fadeDuration);
        debugLog?.info("Fade started with volume:", { 
          module: 'audio-controller',
          function: 'stopPlaying',
          currentVolume: currentVolume,
          fadeDuration: fadeDuration
        });
      }).catch(error => {
        debugLog?.error("Error getting fade_out_seconds:", { 
          module: 'audio-controller',
          function: 'stopPlaying',
          error: error.message
        });
        // Fallback to immediate stop
        try {
          if (sound.stop && typeof sound.stop === 'function') {
            sound.stop();
          }
        } catch (error) {
          debugLog?.warn('Error stopping sound in fade error handler', {
            module: 'audio-controller',
            function: 'stopPlaying',
            error: error.message
          });
        }
        sound.unload();
        sharedState.set('sound', null);
        resetUIState();
      });
    } else {
      // Stop playback first - check if actually playing using Howler's playing() method
      // This is more reliable than checking _state, which can be inconsistent
      try {
        const isActuallyPlaying = sound.playing && typeof sound.playing === 'function' ? sound.playing() : false;
        
        if (isActuallyPlaying || sound.stop) {
          // Stop all playing instances - Howler's stop() stops all sounds
          if (sound.stop && typeof sound.stop === 'function') {
            sound.stop();
          }
          
          // Also stop any individual sound instances in _sounds array if they exist
          if (sound._sounds && Array.isArray(sound._sounds)) {
            sound._sounds.forEach((snd) => {
              try {
                if (snd && snd.stop && typeof snd.stop === 'function') {
                  snd.stop();
                }
              } catch (err) {
                debugLog?.warn('Error stopping individual sound instance', {
                  module: 'audio-controller',
                  function: 'stopPlaying',
                  error: err.message
                });
              }
            });
          }
        }
      } catch (error) {
        debugLog?.warn('Error stopping sound', {
          module: 'audio-controller',
          function: 'stopPlaying',
          error: error.message
        });
      }
      
      // Unload the sound
      try {
        if (sound.unload && typeof sound.unload === 'function') {
          sound.unload();
        }
      } catch (error) {
        debugLog?.warn('Error unloading sound', {
          module: 'audio-controller',
          function: 'stopPlaying',
          error: error.message
        });
      }
      
      // Use Howler's global stop() to ensure ALL sounds stop
      // This handles edge cases where sound object is stale but audio is still playing
      if (typeof window !== 'undefined' && window.Howler && typeof window.Howler.stop === 'function') {
        try {
          window.Howler.stop();
        } catch (error) {
          debugLog?.warn('Error calling Howler.stop()', {
            module: 'audio-controller',
            function: 'stopPlaying',
            error: error.message
          });
        }
      }
      
      // Clear sound from sharedState to prevent processing the same unloaded sound again
      sharedState.set('sound', null);
      resetUIState();
    }
  } else {
    // Fallback: Use Howler's global stop() method to stop all sounds
    // This handles cases where the sound object is missing but audio is still playing
    if (typeof window !== 'undefined' && window.Howler && typeof window.Howler.stop === 'function') {
      try {
        window.Howler.stop();
      } catch (error) {
        debugLog?.warn('Error calling Howler.stop()', {
          module: 'audio-controller',
          function: 'stopPlaying',
          error: error.message
        });
      }
    }
    
    resetUIState();
  }
}

/**
 * Pause audio playback
 * 
 * @param {boolean} fadeOut - Whether to fade out the audio
 */
function pausePlaying(fadeOut = false) {
  const sound = sharedState.get('sound');
  const globalAnimation = sharedState.get('globalAnimation');
  
  if (sound) {
    toggle_play_button();
    if (sound.playing()) {
      
      // Cancel animation frame to prevent memory leaks
      if (globalAnimation) {
        cancelAnimationFrame(globalAnimation);
        sharedState.set('globalAnimation', null);
      }
      
      // Clear any existing fade event handlers to prevent conflicts
      sound.off("fade");
      
      document.getElementById('song_spinner')?.classList.remove('fa-spin');
      document.querySelector('#progress_bar .progress-bar')?.classList.remove('progress-bar-animated', 'progress-bar-striped');
      if (fadeOut) {
        const old_volume = sound.volume();
        sound.on("fade", function () {
          sound.pause();
          sound.volume(old_volume);
        });
        secureStore.get("fade_out_seconds").then(result => {
          if (!result.success || !result.value) {
            debugLog?.warn('Failed to get fade_out_seconds:', { 
              module: 'audio-controller',
              function: 'pausePlaying',
              result: result
            });
            // Fallback to immediate pause
            sound.pause();
            return;
          }
          const fadeSeconds = result.value;
          const fadeDuration = fadeSeconds * 1000;
          sound.fade(sound.volume(), 0, fadeDuration);
        });
      } else {
        sound.pause();
      }
    } else {
      sound.play();
      document.getElementById('song_spinner')?.classList.add('fa-spin');
      document.querySelector('#progress_bar .progress-bar')?.classList.add('progress-bar-animated', 'progress-bar-striped');
    }
  }
}

/**
 * Reset UI state after audio changes
 */
function resetUIState() {
  debugLog?.debug('resetUIState called', { 
    module: 'audio-controller',
    function: 'resetUIState'
  });
  
  // Cancel any ongoing animation frame to prevent memory leaks
  const globalAnimation = sharedState.get('globalAnimation');
  if (globalAnimation) {
    cancelAnimationFrame(globalAnimation);
    sharedState.set('globalAnimation', null);
  }
  
  const duration = document.getElementById('duration'); if (duration) duration.textContent = '0:00';
  const timer = document.getElementById('timer'); if (timer) timer.textContent = '0:00';
  const progress = document.getElementById('audio_progress'); if (progress) progress.style.width = '0%';
  const now = document.getElementById('song_now_playing'); if (now) { now.style.display = 'none'; now.removeAttribute('songid'); }
  document.getElementById('play_button')?.classList.remove('d-none');
  document.getElementById('pause_button')?.classList.add('d-none');
  document.getElementById('song_spinner')?.classList.remove('fa-spin');
  document.querySelector('#progress_bar .progress-bar')?.classList.remove('progress-bar-animated', 'progress-bar-striped');
  if (!document.getElementById('selected_row')) {
    const playBtn = document.getElementById('play_button');
    if (playBtn) playBtn.setAttribute('disabled', 'true');
  }
  const stopBtn = document.getElementById('stop_button'); if (stopBtn) stopBtn.setAttribute('disabled', 'true');
}

/**
 * Toggle play button state
 */
function toggle_play_button() {
  document.getElementById('play_button')?.classList.toggle('d-none');
  document.getElementById('pause_button')?.classList.toggle('d-none');
}

/**
 * Toggle loop mode
 * 
 * @param {boolean} bool - Whether to enable loop mode
 */
function loop_on(bool) {
  debugLog?.debug('loop_on called', { 
    module: 'audio-controller',
    function: 'loop_on',
    bool: bool
  });
  if (bool == true) {
    document.getElementById('loop_button')?.classList.add('active');
  } else {
    document.getElementById('loop_button')?.classList.remove('active');
  }
}

// Export individual functions for direct access
export {
  stopPlaying,
  pausePlaying,
  resetUIState,
  toggle_play_button,
  loop_on
};

// Default export for module loading
export default {
  stopPlaying,
  pausePlaying,
  resetUIState,
  toggle_play_button,
  loop_on
}; 