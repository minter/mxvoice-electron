/**
 * Audio Controller Module
 * 
 * This module handles audio control functionality
 * in the MxVoice Electron application.
 */

// Import shared state
import sharedState from '../shared-state.js';

/**
 * Stop audio playback
 * 
 * @param {boolean} fadeOut - Whether to fade out the audio
 */
function stopPlaying(fadeOut = false) {
  console.log('🔍 stopPlaying called with fadeOut:', fadeOut);
  const sound = sharedState.get('sound');
  const autoplay = sharedState.get('autoplay');
  const holdingTankMode = sharedState.get('holdingTankMode');
  const globalAnimation = sharedState.get('globalAnimation');
  
  console.log('🔍 sound object:', sound);
  console.log('🔍 autoplay:', autoplay);
  console.log('🔍 holdingTankMode:', holdingTankMode);
  
  // Cancel any ongoing animation frame to prevent memory leaks
  if (globalAnimation) {
    cancelAnimationFrame(globalAnimation);
    sharedState.set('globalAnimation', null);
  }
  
  if (sound) {
    console.log('🔍 Sound exists, stopping...');
    if (autoplay && holdingTankMode === "playlist") {
      $(".now_playing").first().removeClass("now_playing");
    }
    if (fadeOut) {
      console.log("Starting fade out...");
      window.electronAPI.store.get("fade_out_seconds").then(fadeSeconds => {
        console.log("Fade out seconds:", fadeSeconds);
        
        // Extract the numeric value from the response
        var fadeSecondsValue = fadeSeconds.value || fadeSeconds;
        var fadeDuration = parseFloat(fadeSecondsValue) * 1000;
        console.log("Fade duration:", fadeDuration);
        
        // Check if sound is still valid
        if (!sound || !sound.volume) {
          console.log("Sound is no longer valid, stopping");
          resetUIState();
          return;
        }
        
        // Remove any existing fade listeners to avoid conflicts
        sound.off("fade");
        
        // Set up fade completion handler
        sound.on("fade", function () {
          console.log("Fade event fired, unloading sound");
          if (sound) {
            sound.unload();
            resetUIState();
          }
        });
        
        // Start the fade
        var currentVolume = sound.volume();
        sound.fade(currentVolume, 0, fadeDuration);
        console.log("Fade started with volume:", currentVolume, "to 0 over", fadeDuration, "ms");
      }).catch(error => {
        console.error("Error getting fade_out_seconds:", error);
        // Fallback to immediate stop
        sound.unload();
        resetUIState();
      });
    } else {
      console.log('🔍 Unloading sound immediately');
      sound.unload();
      resetUIState();
    }
  } else {
    console.log('🔍 No sound object found in shared state');
    resetUIState();
  }
}

/**
 * Pause audio playback
 * 
 * @param {boolean} fadeOut - Whether to fade out the audio
 */
function pausePlaying(fadeOut = false) {
  console.log('🔍 pausePlaying called with fadeOut:', fadeOut);
  const sound = sharedState.get('sound');
  const globalAnimation = sharedState.get('globalAnimation');
  
  console.log('🔍 sound object:', sound);
  console.log('🔍 sound.playing():', sound ? sound.playing() : 'no sound');
  
  if (sound) {
    console.log('🔍 Sound exists, toggling play/pause...');
    toggle_play_button();
    if (sound.playing()) {
      console.log('🔍 Sound is playing, pausing...');
      
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
        var old_volume = sound.volume();
        sound.on("fade", function () {
          sound.pause();
          sound.volume(old_volume);
        });
        window.electronAPI.store.get("fade_out_seconds").then(fadeSeconds => {
          var fadeDuration = fadeSeconds * 1000;
          sound.fade(sound.volume(), 0, fadeDuration);
        });
      } else {
        sound.pause();
      }
    } else {
      console.log('🔍 Sound is paused, playing...');
      sound.play();
      $("#song_spinner").addClass("fa-spin");
      $("#progress_bar .progress-bar").addClass(
        "progress-bar-animated progress-bar-striped"
      );
    }
  } else {
    console.log('🔍 No sound object found in shared state');
  }
}

/**
 * Reset UI state after audio changes
 */
function resetUIState() {
  console.log('🔍 resetUIState called');
  
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
  console.log('🔍 toggle_play_button called');
  $("#play_button").toggleClass("d-none");
  $("#pause_button").toggleClass("d-none");
}

/**
 * Toggle loop mode
 * 
 * @param {boolean} bool - Whether to enable loop mode
 */
function loop_on(bool) {
  console.log('🔍 loop_on called with bool:', bool);
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