/**
 * Audio Controller Module
 * 
 * This module handles audio control functionality
 * in the MxVoice Electron application.
 */

/**
 * Stop audio playback
 * 
 * @param {boolean} fadeOut - Whether to fade out the audio
 */
function stopPlaying(fadeOut = false) {
  if (sound) {
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
      sound.unload();
      resetUIState();
    }
  }
}

/**
 * Pause audio playback
 * 
 * @param {boolean} fadeOut - Whether to fade out the audio
 */
function pausePlaying(fadeOut = false) {
  if (sound) {
    toggle_play_button();
    if (sound.playing()) {
      sound.on("fade", function () {
        sound.pause();
        sound.volume(old_volume);
      });
      $("#song_spinner").removeClass("fa-spin");
      $("#progress_bar .progress-bar").removeClass(
        "progress-bar-animated progress-bar-striped"
      );
      if (fadeOut) {
        var old_volume = sound.volume();
        window.electronAPI.store.get("fade_out_seconds").then(fadeSeconds => {
          var fadeDuration = fadeSeconds * 1000;
          sound.fade(sound.volume(), 0, fadeDuration);
        });
      } else {
        sound.pause();
      }
    } else {
      sound.play();
      $("#song_spinner").addClass("fa-spin");
      $("#progress_bar .progress-bar").addClass(
        "progress-bar-animated progress-bar-striped"
      );
    }
  }
}

/**
 * Reset UI state after audio changes
 */
function resetUIState() {
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
  $("#play_button").toggleClass("d-none");
  $("#pause_button").toggleClass("d-none");
}

/**
 * Toggle loop mode
 * 
 * @param {boolean} bool - Whether to enable loop mode
 */
function loop_on(bool) {
  if (bool == true) {
    $("#loop_button").addClass("active");
  } else {
    $("#loop_button").removeClass("active");
  }
}

// Export the audio controller functions
module.exports = {
  stopPlaying,
  pausePlaying,
  resetUIState,
  toggle_play_button,
  loop_on
}; 