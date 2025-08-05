/**
 * Audio Utilities Module
 * 
 * Contains utility functions for audio operations including
 * time formatting, loading state checks, and progress tracking.
 */

// Import shared state
import sharedState from '../shared-state.js';

/**
 * Howler.js utility functions for audio operations
 * 
 * @type {Object}
 */
export const howlerUtils = {
  /**
   * Format seconds into MM:SS format
   * 
   * @param {number} secs - Seconds to format
   * @returns {string} - Formatted time string
   */
  formatTime: function (secs) {
    var minutes = Math.floor(secs / 60) || 0;
    var seconds = secs - minutes * 60 || 0;
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  },

  /**
   * Check if a sound object is loaded
   * 
   * @param {Object} s - Sound object to check
   * @returns {boolean} - True if sound is loaded
   */
  isLoaded: function (s) {
    return s.state() == "loaded";
  },

  /**
   * Update the audio time tracker and progress display
   * This function handles real-time audio progress updates
   */
  updateTimeTracker: function () {
    const sound = sharedState.get('sound');
    const globalAnimation = sharedState.get('globalAnimation');
    const wavesurfer = sharedState.get('wavesurfer');
    
    if (!sound || !howlerUtils.isLoaded(sound)) {
      if (globalAnimation) {
        cancelAnimationFrame(globalAnimation);
        sharedState.set('globalAnimation', null);
      }
      if (wavesurfer) {
        wavesurfer.empty();
      }
      return;
    }
    
    var self = this;
    var seek = sound.seek() || 0;
    var remaining = self.duration() - seek;
    var currentTime = howlerUtils.formatTime(Math.round(seek));
    var remainingTime = howlerUtils.formatTime(Math.round(remaining));
    var percent_elapsed = seek / self.duration();
    $("#audio_progress").width((percent_elapsed * 100 || 0) + "%");
    if (!isNaN(percent_elapsed) && wavesurfer) {
      wavesurfer.seekTo(percent_elapsed);
    }
    $("#timer").text(currentTime);
    $("#duration").text(`-${remainingTime}`);
    
    const newAnimation = requestAnimationFrame(
      howlerUtils.updateTimeTracker.bind(self)
    );
    sharedState.set('globalAnimation', newAnimation);
  },
};

// Default export for module loading
export default {
  howlerUtils
}; 