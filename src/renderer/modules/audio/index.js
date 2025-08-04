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
    
    // Initialize audio controller functions
    this.stopPlaying = audioController.stopPlaying;
    this.pausePlaying = audioController.pausePlaying;
    this.resetUIState = audioController.resetUIState;
    this.toggle_play_button = audioController.toggle_play_button;
    this.loop_on = audioController.loop_on;
    
    // Initialize audio utilities
    this.howlerUtils = audioUtils.howlerUtils;
  }

  /**
   * Initialize the audio module
   * This method can be called to set up any initialization logic
   */
  init() {
    console.log('Audio module initialized');
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
      howlerUtils: this.howlerUtils
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

// Default export for module loading
export default {
  playSongFromId: audioModule.playSongFromId,
  playSelected: audioModule.playSelected,
  song_ended: audioModule.song_ended,
  autoplay_next: audioModule.autoplay_next,
  cancel_autoplay: audioModule.cancel_autoplay,
  stopPlaying: audioModule.stopPlaying,
  pausePlaying: audioModule.pausePlaying,
  resetUIState: audioModule.resetUIState,
  toggle_play_button: audioModule.toggle_play_button,
  loop_on: audioModule.loop_on
}; 