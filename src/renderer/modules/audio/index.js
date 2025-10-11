/**
 * Audio Module Index
 * 
 * This module serves as the main entry point for all audio functionality
 * in the MxVoice Electron application.
 */

// Import audio sub-modules
import * as audioManager from './audio-manager.js';
import * as audioController from './audio-controller.js';
import * as audioUtils from './audio-utils.js';
import { enableTestModeCSP } from './audio-utils.js';
import { installAudioProbe, createTestOscillator } from './audio-probe.js';

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
 * Audio Module Class
 * 
 * Provides a unified interface for all audio functionality
 */
class AudioModule {
  constructor() {
    // Initialize audio manager functions
    this.playSongFromId = audioManager.playSongFromId;
    this.playSelected = audioManager.playSelected;
    this.song_ended = audioManager.song_ended;
    this.autoplay_next = audioManager.autoplay_next;
    this.cancel_autoplay = audioManager.cancel_autoplay;
    this.initializeMusicDirectoryCache = audioManager.initializeMusicDirectoryCache;
    this.updateMusicDirectoryCache = audioManager.updateMusicDirectoryCache;
    
    // Initialize audio controller functions
    this.stopPlaying = audioController.stopPlaying;
    this.pausePlaying = audioController.pausePlaying;
    this.resetUIState = audioController.resetUIState;
    this.toggle_play_button = audioController.toggle_play_button;
    this.loop_on = audioController.loop_on;
    
    // Initialize audio utilities
    // this.howlerUtils = audioUtils.howlerUtils; // Function not implemented yet
    
    // Test mode audio components
    this.testOscillator = null;
    this.audioProbe = null;
    this.testAudioContext = null;
    this.testMasterGain = null;
  }

  /**
   * Initialize the audio module
   * @param {Object} dependencies - Module dependencies
   * @returns {Promise<boolean>} Success status
   */
  async init(dependencies = {}) {
    try {
      debugLog?.info('Audio module initializing...', { 
        module: 'audio', 
        function: 'init' 
      });

      // Initialize audio functionality
      this.setupAudioModule();
      
      // Initialize music directory cache to reduce IPC overhead
      await this.initializeMusicDirectoryCache();
      
      // In E2E, relax CSP slightly to allow file: media for WebAudio buffering
      try { enableTestModeCSP(); } catch (_) {}

      // In E2E test mode, set up the audio probe eagerly so tests can measure RMS
      if (window.electronTest?.isE2E) {
        this.setupTestMode();
      }
      
      debugLog?.info('Audio module initialized successfully', { 
        module: 'audio', 
        function: 'init' 
      });
      return true;
    } catch (error) {
      debugLog?.error('Failed to initialize Audio module:', { 
        module: 'audio', 
        function: 'init', 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Set up audio module functionality
   */
  setupAudioModule() {
    // Initialize audio module state and functionality
    debugLog?.info('Setting up audio module functionality', { 
      module: 'audio', 
      function: 'setupAudioModule' 
    });
    
    // Pre-warm audio context for Windows responsiveness
    this.preWarmAudioContext();
    
    // Set up user interaction handlers to resume context
    this.setupUserInteractionHandlers();
  }
  
  /**
   * Pre-warm the Web Audio context to prevent suspension delays
   * Critical for Windows performance
   */
  preWarmAudioContext() {
    try {
      if (window.Howler?.ctx) {
        // Resume context if suspended
        if (window.Howler.ctx.state === 'suspended') {
          window.Howler.ctx.resume().then(() => {
            debugLog?.info('Audio context pre-warmed successfully', {
              module: 'audio',
              function: 'preWarmAudioContext',
              contextState: window.Howler.ctx.state
            });
          }).catch(error => {
            debugLog?.warn('Failed to pre-warm audio context:', {
              module: 'audio',
              function: 'preWarmAudioContext',
              error: error.message
            });
          });
        } else {
          debugLog?.info('Audio context already active', {
            module: 'audio',
            function: 'preWarmAudioContext',
            contextState: window.Howler.ctx.state
          });
        }
      } else {
        debugLog?.warn('Howler context not available for pre-warming', {
          module: 'audio',
          function: 'preWarmAudioContext'
        });
      }
    } catch (error) {
      debugLog?.error('Error pre-warming audio context:', {
        module: 'audio',
        function: 'preWarmAudioContext',
        error: error.message
      });
    }
  }
  
  /**
   * Set up user interaction handlers to resume audio context
   * Windows requires user interaction to resume suspended contexts
   */
  setupUserInteractionHandlers() {
    const resumeContext = () => {
      if (window.Howler?.ctx?.state === 'suspended') {
        window.Howler.ctx.resume().then(() => {
          debugLog?.info('Audio context resumed via user interaction', {
            module: 'audio',
            function: 'setupUserInteractionHandlers'
          });
        }).catch(error => {
          debugLog?.warn('Failed to resume context via user interaction:', {
            module: 'audio',
            function: 'setupUserInteractionHandlers',
            error: error.message
          });
        });
      }
    };
    
    // Add listeners for common user interactions
    document.addEventListener('click', resumeContext, { once: true });
    document.addEventListener('keydown', resumeContext, { once: true });
    document.addEventListener('touchstart', resumeContext, { once: true });
  }

  /**
   * Set up test mode audio components
   */
  setupTestMode() {
    try {
      // Install audio probe for Howler.js
      this.audioProbe = installAudioProbe();
      
      // Create test oscillator
      this.testOscillator = createTestOscillator();
      
      // Expose test oscillator for Playwright access
      if (typeof window !== 'undefined') {
        if (!window.electronTest) {
          window.electronTest = {};
        }
        window.electronTest.testOscillator = this.testOscillator;
      }
      
      debugLog?.info('Test mode audio setup complete with Howler.js', {
        module: 'audio',
        function: 'setupTestMode'
      });
    } catch (error) {
      debugLog?.error('Failed to setup test mode audio:', {
        module: 'audio',
        function: 'setupTestMode',
        error: error.message
      });
    }
  }

  /**
   * Ensure test mode is set up (lazy initialization)
   */
  ensureTestMode() {
    if (window.electronTest?.isE2E && !this.audioProbe) {
      debugLog?.info('Lazy initializing test mode audio components', {
        module: 'audio',
        function: 'ensureTestMode'
      });
      this.setupTestMode();
    }
  }

  /**
   * Get all available audio functions
   * 
   * @returns {Object} - Object containing all audio functions
   */
  getAllAudioFunctions() {
    return {
      // Audio manager functions
      playSongFromId: this.playSongFromId,
      playSelected: this.playSelected,
      song_ended: this.song_ended,
      autoplay_next: this.autoplay_next,
      cancel_autoplay: this.cancel_autoplay,
      
      // Audio controller functions
      stopPlaying: this.stopPlaying,
      pausePlaying: this.pausePlaying,
      resetUIState: this.resetUIState,
      toggle_play_button: this.toggle_play_button,
      loop_on: this.loop_on,
      
      // Audio utilities
      // howlerUtils: this.howlerUtils // Function not implemented yet
    };
  }

  /**
   * Test all audio functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {
      manager: {},
      controller: {}
    };

    // Test audio manager functions
    try {
      if (typeof this.playSongFromId === 'function') {
        results.manager.playSongFromId = '✅ Function exists';
      } else {
        results.manager.playSongFromId = '❌ Function missing';
      }

      if (typeof this.playSelected === 'function') {
        results.manager.playSelected = '✅ Function exists';
      } else {
        results.manager.playSelected = '❌ Function missing';
      }

      if (typeof this.song_ended === 'function') {
        results.manager.song_ended = '✅ Function exists';
      } else {
        results.manager.song_ended = '❌ Function missing';
      }

      if (typeof this.autoplay_next === 'function') {
        results.manager.autoplay_next = '✅ Function exists';
      } else {
        results.manager.autoplay_next = '❌ Function missing';
      }

      if (typeof this.cancel_autoplay === 'function') {
        results.manager.cancel_autoplay = '✅ Function exists';
      } else {
        results.manager.cancel_autoplay = '❌ Function missing';
      }
    } catch (error) {
      results.manager.error = `❌ Error: ${error.message}`;
    }

    // Test audio controller functions
    try {
      if (typeof this.stopPlaying === 'function') {
        results.controller.stopPlaying = '✅ Function exists';
      } else {
        results.controller.stopPlaying = '❌ Function missing';
      }

      if (typeof this.pausePlaying === 'function') {
        results.controller.pausePlaying = '✅ Function exists';
      } else {
        results.controller.pausePlaying = '❌ Function missing';
      }

      if (typeof this.resetUIState === 'function') {
        results.controller.resetUIState = '✅ Function exists';
      } else {
        results.controller.resetUIState = '❌ Function missing';
      }

      if (typeof this.toggle_play_button === 'function') {
        results.controller.toggle_play_button = '✅ Function exists';
      } else {
        results.controller.toggle_play_button = '❌ Function missing';
      }

      if (typeof this.loop_on === 'function') {
        results.controller.loop_on = '✅ Function exists';
      } else {
        results.controller.loop_on = '❌ Function missing';
      }
    } catch (error) {
      results.controller.error = `❌ Error: ${error.message}`;
    }

    return results;
  }

  /**
   * Get audio module information
   * 
   * @returns {Object} - Module information
   */
  getInfo() {
    return {
      name: 'Audio Module',
      version: '1.0.0',
      description: 'Handles audio playback and control functionality',
      functions: {
        manager: [
          'playSongFromId',
          'playSelected', 
          'song_ended',
          'autoplay_next',
          'cancel_autoplay'
        ],
        controller: [
          'stopPlaying',
          'pausePlaying',
          'resetUIState',
          'toggle_play_button',
          'loop_on'
        ]
      }
    };
  }
}

// Create and export a singleton instance
const audioModule = new AudioModule();

// Export individual functions for direct access
export const playSongFromId = audioModule.playSongFromId.bind(audioModule);
export const playSelected = audioModule.playSelected.bind(audioModule);
export const song_ended = audioModule.song_ended.bind(audioModule);
export const autoplay_next = audioModule.autoplay_next.bind(audioModule);
export const cancel_autoplay = audioModule.cancel_autoplay.bind(audioModule);
export const stopPlaying = audioModule.stopPlaying.bind(audioModule);
export const pausePlaying = audioModule.pausePlaying.bind(audioModule);
export const resetUIState = audioModule.resetUIState.bind(audioModule);
export const toggle_play_button = audioModule.toggle_play_button.bind(audioModule);
export const loop_on = audioModule.loop_on.bind(audioModule);
export const initializeMusicDirectoryCache = audioModule.initializeMusicDirectoryCache.bind(audioModule);
export const updateMusicDirectoryCache = audioModule.updateMusicDirectoryCache.bind(audioModule);

// Default export for module loading
export default audioModule; 