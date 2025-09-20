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
    const minutes = Math.floor(secs / 60) || 0;
    const seconds = secs - minutes * 60 || 0;
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
    let wavesurfer = sharedState.get('wavesurfer');
    
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
    
    const self = this;
    const seek = sound.seek() || 0;
    const remaining = self.duration() - seek;
    const currentTime = howlerUtils.formatTime(Math.round(seek));
    const remainingTime = howlerUtils.formatTime(Math.round(remaining));
    const percent_elapsed = seek / self.duration();
    const progressBar = document.getElementById('audio_progress');
    if (progressBar) progressBar.style.width = ((percent_elapsed * 100) || 0) + '%';
    if (!isNaN(percent_elapsed) && wavesurfer) {
      wavesurfer.seekTo(percent_elapsed);
    }
    const timer = document.getElementById('timer');
    const duration = document.getElementById('duration');
    if (timer) timer.textContent = currentTime;
    if (duration) duration.textContent = `-${remainingTime}`;
    
    const newAnimation = requestAnimationFrame(
      howlerUtils.updateTimeTracker.bind(self)
    );
    sharedState.set('globalAnimation', newAnimation);
  },
};

/**
 * Create a Howl instance with E2E-aware defaults and Windows optimizations.
 * - In E2E: force Web Audio path (html5: false) and preload for determinism
 * - On Windows: optimize for responsiveness with Web Audio and preload
 * - In prod: keep existing behavior unless overridden by opts
 */
export function createHowl(options = {}) {
  const isE2E = !!(typeof window !== 'undefined' && window.electronTest?.isE2E);
  const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
  const coerced = { ...options };
  
  if (isE2E) {
    // Force WebAudio pipeline so the probe can attach
    coerced.html5 = false;
    if (typeof coerced.preload === 'undefined') coerced.preload = true;
  } else if (isWindows) {
    // Windows optimizations for responsiveness
    coerced.html5 = false; // Force Web Audio for better performance
    if (typeof coerced.preload === 'undefined') coerced.preload = true; // Preload for instant playback
    coerced.format = ['mp3']; // Specify format to avoid detection delays
  }
  
  // Howl is global from index.html
  // eslint-disable-next-line no-undef
  return new Howl(coerced);
}

/**
 * E2E-only: ensure CSP allows WebAudio/XHR to load local media
 * Adds file: to connect-src and media-src if missing
 */
export function enableTestModeCSP() {
  try {
    const isE2E = !!(typeof window !== 'undefined' && window.electronTest?.isE2E);
    if (!isE2E) return;
    const tag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!tag) return;
    const content = tag.getAttribute('content') || '';
    // Ensure tokens exist
    const ensureDirective = (c, name) => (c.includes(name) ? c : `${c}; ${name} 'self'`);
    let updated = ensureDirective(content, 'connect-src');
    updated = ensureDirective(updated, 'media-src');
    // Add file: if not present
    const addToken = (c, name, token) => c.replace(new RegExp(`(${name}[^;]*)`), (m, grp) => (grp.includes(token) ? grp : `${grp} ${token}`));
    updated = addToken(updated, 'connect-src', 'file:');
    updated = addToken(updated, 'connect-src', 'blob:');
    updated = addToken(updated, 'connect-src', 'data:');
    updated = addToken(updated, 'media-src', 'file:');
    updated = addToken(updated, 'media-src', 'blob:');
    updated = addToken(updated, 'media-src', 'data:');
    if (updated !== content) tag.setAttribute('content', updated);
  } catch (_) {
    // ignore in tests
  }
}

// Default export for module loading
export default {
  howlerUtils,
  createHowl,
  enableTestModeCSP
}; 