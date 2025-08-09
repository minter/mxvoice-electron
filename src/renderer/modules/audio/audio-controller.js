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
  debugLog?.info('stopPlaying called with parameters', { 
    module: 'audio-controller',
    function: 'stopPlaying',
    fadeOut: fadeOut,
    typeof_fadeOut: typeof fadeOut,
    argumentsLength: arguments.length
  });
  const sound = sharedState.get('sound');
  const autoplay = sharedState.get('autoplay');
  const holdingTankMode = sharedState.get('holdingTankMode');
  const globalAnimation = sharedState.get('globalAnimation');
  
  debugLog?.info('🔍 sound object:', { 
    module: 'audio-controller',
    function: 'stopPlaying',
    sound: sound
  });
  debugLog?.info('🔍 autoplay:', { 
    module: 'audio-controller',
    function: 'stopPlaying',
    autoplay: autoplay
  });
  debugLog?.info('🔍 holdingTankMode:', { 
    module: 'audio-controller',
    function: 'stopPlaying',
    holdingTankMode: holdingTankMode
  });
  
  // Cancel any ongoing animation frame to prevent memory leaks
  if (globalAnimation) {
    cancelAnimationFrame(globalAnimation);
    sharedState.set('globalAnimation', null);
  }
  
  if (sound) {
    debugLog?.info('🔍 Sound exists, stopping...', { 
      module: 'audio-controller',
      function: 'stopPlaying'
    });
    if (autoplay && holdingTankMode === "playlist") {
      $(".now_playing").first().removeClass("now_playing");
    }
    if (fadeOut) {
      debugLog?.info("Taking fade out path", { 
        module: 'audio-controller',
        function: 'stopPlaying',
        fadeOut: fadeOut
      });
      secureStore.get("fade_out_seconds").then(fadeSeconds => {
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
            sound.unload();
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
        sound.unload();
        resetUIState();
      });
    } else {
      debugLog?.info('Taking immediate stop path', { 
        module: 'audio-controller',
        function: 'stopPlaying',
        fadeOut: fadeOut
      });
      sound.unload();
      resetUIState();
    }
  } else {
    debugLog?.info('🔍 No sound object found in shared state', { 
      module: 'audio-controller',
      function: 'stopPlaying'
    });
    resetUIState();
  }
}

/**
 * Pause audio playback
 * 
 * @param {boolean} fadeOut - Whether to fade out the audio
 */
function pausePlaying(fadeOut = false) {
  debugLog?.info('🔍 pausePlaying called with fadeOut:', { 
    module: 'audio-controller',
    function: 'pausePlaying',
    fadeOut: fadeOut
  });
  const sound = sharedState.get('sound');
  const globalAnimation = sharedState.get('globalAnimation');
  
  debugLog?.info('🔍 sound object:', { 
    module: 'audio-controller',
    function: 'pausePlaying',
    sound: sound
  });
  debugLog?.info('🔍 sound.playing():', { 
    module: 'audio-controller',
    function: 'pausePlaying',
    playing: sound ? sound.playing() : 'no sound'
  });
  
  if (sound) {
    debugLog?.info('🔍 Sound exists, toggling play/pause...', { 
      module: 'audio-controller',
      function: 'pausePlaying'
    });
    toggle_play_button();
    if (sound.playing()) {
      debugLog?.info('🔍 Sound is playing, pausing...', { 
        module: 'audio-controller',
        function: 'pausePlaying'
      });
      
      // Cancel animation frame to prevent memory leaks
      if (globalAnimation) {
        cancelAnimationFrame(globalAnimation);
        sharedState.set('globalAnimation', null);
      }
      
      // Clear any existing fade event handlers to prevent conflicts
      sound.off("fade");
      
      $("#song_spinner").removeClass("fa-spin");
      $("#progress_bar .progress-bar").removeClass(
        "progress-bar-animated progress-bar-striped"
      );
      if (fadeOut) {
        const old_volume = sound.volume();
        sound.on("fade", function () {
          sound.pause();
          sound.volume(old_volume);
        });
        secureStore.get("fade_out_seconds").then(fadeSeconds => {
          const fadeDuration = fadeSeconds * 1000;
          sound.fade(sound.volume(), 0, fadeDuration);
        });
      } else {
        sound.pause();
      }
    } else {
      debugLog?.info('🔍 Sound is paused, playing...', { 
        module: 'audio-controller',
        function: 'pausePlaying'
      });
      sound.play();
      $("#song_spinner").addClass("fa-spin");
      $("#progress_bar .progress-bar").addClass(
        "progress-bar-animated progress-bar-striped"
      );
    }
  } else {
    debugLog?.info('🔍 No sound object found in shared state', { 
      module: 'audio-controller',
      function: 'pausePlaying'
    });
  }
}

/**
 * Reset UI state after audio changes
 */
function resetUIState() {
  debugLog?.info('🔍 resetUIState called', { 
    module: 'audio-controller',
    function: 'resetUIState'
  });
  
  // Cancel any ongoing animation frame to prevent memory leaks
  const globalAnimation = sharedState.get('globalAnimation');
  if (globalAnimation) {
    cancelAnimationFrame(globalAnimation);
    sharedState.set('globalAnimation', null);
  }
  
  $("#duration").html("0:00");
  $("#timer").html("0:00");
  $("#audio_progress").width("0%");
  $("#song_now_playing").fadeOut(100);
  $("#song_now_playing").removeAttr("songid");
  $("#play_button").removeClass("d-none");
  $("#pause_button").addClass("d-none");
  $("#song_spinner").removeClass("fa-spin");
  $("#progress_bar .progress-bar").removeClass(
    "progress-bar-animated progress-bar-striped"
  );
  if (!$("#selected_row").length) {
    $("#play_button").attr("disabled", true);
  }
  $("#stop_button").attr("disabled", true);
}

/**
 * Toggle play button state
 */
function toggle_play_button() {
  debugLog?.info('🔍 toggle_play_button called', { 
    module: 'audio-controller',
    function: 'toggle_play_button'
  });
  $("#play_button").toggleClass("d-none");
  $("#pause_button").toggleClass("d-none");
}

/**
 * Toggle loop mode
 * 
 * @param {boolean} bool - Whether to enable loop mode
 */
function loop_on(bool) {
  debugLog?.info('🔍 loop_on called with bool:', { 
    module: 'audio-controller',
    function: 'loop_on',
    bool: bool
  });
  if (bool == true) {
    $("#loop_button").addClass("active");
  } else {
    $("#loop_button").removeClass("active");
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