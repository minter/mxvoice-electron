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

    const seek = sound.seek() || 0;
    const totalDuration = sound.duration() || 0;

    // Wait for duration to be available before computing progress
    if (totalDuration <= 0) {
      const newAnimation = requestAnimationFrame(
        howlerUtils.updateTimeTracker.bind(howlerUtils)
      );
      sharedState.set('globalAnimation', newAnimation);
      return;
    }

    // End-point detection: stop playback when reaching the end trim point
    const endTime = sharedState.get('trackEndTime');
    if (endTime != null && seek >= endTime) {
      sound.stop();
      // sound.stop() doesn't fire onend, so trigger end logic manually
      if (typeof window.songEndedFromTrimPoint === 'function') {
        window.songEndedFromTrimPoint();
      }
      return;
    }

    // Calculate progress relative to trimmed range
    const startTime = sharedState.get('trackStartTime') ?? 0;
    const effectiveEnd = endTime ?? totalDuration;
    const effectiveDuration = effectiveEnd - startTime;
    const effectiveSeek = seek - startTime;
    const remaining = effectiveEnd - seek;
    const currentTime = howlerUtils.formatTime(Math.round(Math.max(0, effectiveSeek)));
    const remainingTime = howlerUtils.formatTime(Math.round(Math.max(0, remaining)));
    const percent_elapsed = effectiveDuration > 0 ? (effectiveSeek / effectiveDuration) : 0;
    const progressBar = document.getElementById('audio_progress');
    if (progressBar) progressBar.style.width = (Math.min(percent_elapsed * 100, 100) || 0) + '%';
    // Sync wavesurfer with full-track position (not trimmed) for accurate waveform display
    const fullPercent = seek / totalDuration;
    if (!isNaN(fullPercent) && wavesurfer) {
      wavesurfer.seekTo(Math.min(fullPercent, 1));
    }
    const timer = document.getElementById('timer');
    const duration = document.getElementById('duration');
    if (timer) timer.textContent = currentTime;
    if (duration) duration.textContent = `-${remainingTime}`;

    // Early crossfade trigger: start next track before current one ends
    if (!sharedState.get('crossfadeTriggered') && remaining > 0) {
      const autoplay = sharedState.get('autoplay');
      const holdingTankMode = sharedState.get('holdingTankMode');
      if (autoplay && holdingTankMode === 'playlist' && typeof window.triggerEarlyCrossfade === 'function') {
        window.triggerEarlyCrossfade(remaining);
      }
    }

    const newAnimation = requestAnimationFrame(
      howlerUtils.updateTimeTracker.bind(howlerUtils)
    );
    sharedState.set('globalAnimation', newAnimation);
  },
};

/**
 * Create a Howl instance with E2E-aware defaults and production optimizations.
 * - In E2E: force Web Audio path (html5: false) and preload for determinism
 * - In production: use Web Audio API WITHOUT preload for fast, high-quality playback
 */
export function createHowl(options = {}) {
  const isE2E = !!(typeof window !== 'undefined' && window.electronTest?.isE2E);
  const coerced = { ...options };
  
  if (isE2E) {
    // Force WebAudio pipeline so the probe can attach
    coerced.html5 = false;
    if (typeof coerced.preload === 'undefined') coerced.preload = true;
  } else {
    // Production: Use HTML5 Audio for true streaming with local files
    // HTML5 Audio handles file:// URLs better and can start playing faster
    // Note: HTML5 Audio caps volume at 1.0, so per-track volume max is 100%
    if (typeof coerced.html5 === 'undefined') coerced.html5 = true; // HTML5 Audio mode
    if (typeof coerced.preload === 'undefined') coerced.preload = 'auto'; // Auto buffer management
    coerced.format = ['mp3', 'ogg', 'm4a', 'aac', 'mp4', 'webm', 'wav', 'wma', 'flac']; // Support all common audio formats
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