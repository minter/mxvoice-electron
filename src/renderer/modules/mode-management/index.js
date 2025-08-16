/**
 * Mode Management Module
 *
 * This module handles mode switching functionality for the application.
 * It manages the holding tank mode (storage vs playlist) and autoplay functionality.
 */

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

// Import secure adapters
import { secureStore } from '../adapters/secure-adapter.js';

/**
 * Mode Management Singleton
 *
 * Provides a unified interface for all mode management operations
 */
class ModeManagementModule {
  constructor() {
    // Initialize module state
    this.holdingTankMode = 'storage'; // 'storage' or 'playlist'
    this.autoplay = false;
    this.sound = null; // Audio context
  }

  /**
   * Initialize the mode management module
   * @param {Object} dependencies - Module dependencies
   * @returns {Promise<boolean>} Success status
   */
  async init(dependencies = {}) {
    try {
      debugLog?.info('Mode management module initializing...', { 
        module: 'mode-management', 
        function: 'init' 
      });

      // Call the existing initialization logic
      const result = await this.initModeManagement();
      
      if (result && result.success) {
        debugLog?.info('Mode management module initialized successfully', { 
          module: 'mode-management', 
          function: 'init' 
        });
        return true;
      } else {
        throw new Error('Mode management initialization failed');
      }
    } catch (error) {
      debugLog?.error('Failed to initialize mode management module:', { 
        module: 'mode-management', 
        function: 'init', 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Set up event listeners for mode management
   */
  setupEventListeners() {
    // Initialize event listeners for mode management functionality
    debugLog?.info('Setting up mode management event listeners', { 
      module: 'mode-management', 
      function: 'setupEventListeners' 
    });
  }

  /**
   * Set the holding tank mode (storage or playlist)
   * @param {string} mode - The mode to set ('storage' or 'playlist')
   * @returns {Promise<Object>} - Result of the operation
   */
  async setHoldingTankMode(mode) {
    debugLog?.info('Setting holding tank mode', {
      module: 'mode-management',
      function: 'setHoldingTankMode',
      mode: mode,
    });

    this.holdingTankMode = mode;

    // Update shared state for audio manager to read
    if (window.sharedState) {
      window.sharedState.set('holdingTankMode', mode);
    }

    // Update button states
    if (mode === 'storage') {
      const storageBtn = document.getElementById('storage_mode_btn');
      const playlistBtn = document.getElementById('playlist_mode_btn');
      const holding = document.getElementById('holding_tank');
      storageBtn?.classList.add('active');
      playlistBtn?.classList.remove('active');
      holding?.classList.remove('holding-tank-playlist-mode');
      holding?.classList.add('holding-tank-storage-mode');

      this.autoplay = false;
      // Update shared state for autoplay
      if (window.sharedState) {
        window.sharedState.set('autoplay', false);
      }

      document
        .querySelectorAll('.now_playing')
        .forEach((el) => el.classList.remove('now_playing'));
      holding?.classList.remove('autoplaying');
    } else if (mode === 'playlist') {
      const storageBtn = document.getElementById('storage_mode_btn');
      const playlistBtn = document.getElementById('playlist_mode_btn');
      const holding = document.getElementById('holding_tank');
      playlistBtn?.classList.add('active');
      storageBtn?.classList.remove('active');
      holding?.classList.remove('holding-tank-storage-mode');
      holding?.classList.add('holding-tank-playlist-mode');

      this.autoplay = true;
      // Update shared state for autoplay
      if (window.sharedState) {
        window.sharedState.set('autoplay', true);
      }

      // Restore the speaker icon and playlist state if there's a track currently playing
      let currentSongId = document
        .getElementById('song_now_playing')
        ?.getAttribute('songid');

      // Check for sound in both possible locations
      const sound = window.sharedState?.get('sound') || window.sound;
      let isCurrentlyPlaying = sound && sound.playing && sound.playing();
      let isPaused = sound && !isCurrentlyPlaying; // Track is loaded but not playing

      debugLog?.info(
        'Checking for currently playing track when switching to playlist mode',
        {
          module: 'mode-management',
          function: 'setHoldingTankMode',
          currentSongId: currentSongId,
          isCurrentlyPlaying: isCurrentlyPlaying,
          isPaused: isPaused,
          hasSound: !!sound,
          soundSource: sound
            ? window.sharedState?.get('sound')
              ? 'sharedState'
              : 'window'
            : 'none',
        }
      );

      // If there's a song loaded (playing or paused), show it in playlist mode
      if (currentSongId && (isCurrentlyPlaying || isPaused)) {
        // Find the track in the holding tank with this song ID and add the now_playing class
        const trackElement = document.querySelector(
          `#holding_tank .list-group-item[songid="${currentSongId}"]`
        );
        if (trackElement) {
          // Clear any existing now_playing indicators first
          document
            .querySelectorAll('.now_playing')
            .forEach((el) => el.classList.remove('now_playing'));

          // Add the now_playing class to show the speaker icon
          trackElement.classList.add('now_playing');

          debugLog?.info('Applied now_playing class to track in holding tank', {
            module: 'mode-management',
            function: 'setHoldingTankMode',
            songId: currentSongId,
            trackTitle: trackElement.textContent?.trim() || 'Unknown',
          });
        } else {
          debugLog?.warn(
            'Could not find track in holding tank with current song ID',
            {
              module: 'mode-management',
              function: 'setHoldingTankMode',
              songId: currentSongId,
            }
          );
        }
      }
    }

    // Save mode to store
    try {
      const result = await secureStore.set('holding_tank_mode', mode);
      if (result.success) {
        debugLog?.info('Holding tank mode saved', {
          module: 'mode-management',
          function: 'setHoldingTankMode',
          mode: mode,
        });
      } else {
        debugLog?.warn('Failed to save holding tank mode', {
          module: 'mode-management',
          function: 'setHoldingTankMode',
          mode: mode,
          error: result.error,
        });
      }
      return result;
    } catch (error) {
      debugLog?.warn('Store save error', {
        module: 'mode-management',
        function: 'setHoldingTankMode',
        mode: mode,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current holding tank mode
   * @returns {string} - Current mode ('storage' or 'playlist')
   */
  getHoldingTankMode() {
    return this.holdingTankMode;
  }

  /**
   * Toggle between storage and playlist modes
   * @returns {Promise<Object>} - Result of the operation
   */
  async toggleAutoPlay() {
    debugLog?.info('Toggling autoplay mode', {
      module: 'mode-management',
      function: 'toggleAutoPlay',
    });

    if (this.holdingTankMode === 'storage') {
      return this.setHoldingTankMode('playlist');
    } else {
      return this.setHoldingTankMode('storage');
    }
  }

  /**
   * Get the current autoplay state
   * @returns {boolean} - Current autoplay state
   */
  getAutoPlayState() {
    return this.autoplay;
  }

  /**
   * Set the audio context reference (called from main renderer)
   * @param {Object} audioContext - The audio context object
   */
  setAudioContext(audioContext) {
    this.sound = audioContext;
    debugLog?.info('Audio context set in mode management', {
      module: 'mode-management',
      function: 'setAudioContext',
    });
  }

  /**
   * Reset mode to default (storage)
   * @returns {Promise<Object>} - Result of the operation
   */
  async resetToDefaultMode() {
    debugLog?.info('Resetting to default mode', {
      module: 'mode-management',
      function: 'resetToDefaultMode',
    });
    return this.setHoldingTankMode('storage');
  }

  /**
   * Initialize the module (alias for initModeManagement)
   */
  async initModeManagement() {
    try {
      debugLog?.info('Mode management module initializing...', { 
        module: 'mode-management', 
        function: 'initModeManagement' 
      });

      // Initialize mode state with default value
      if (typeof this.holdingTankMode === 'undefined') {
        this.holdingTankMode = 'storage'; // Default to storage mode
      }
      
      this.currentMode = this.getHoldingTankMode();
      
      // Set up event listeners
      this.setupEventListeners();
      
      debugLog?.info('Mode management module initialized successfully', { 
        module: 'mode-management', 
        function: 'initModeManagement' 
      });
      return { success: true };
    } catch (error) {
      debugLog?.error('Failed to initialize mode management module:', { 
        module: 'mode-management', 
        function: 'initModeManagement', 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all mode management functions
   *
   * @returns {Object} - Object containing all mode management functions
   */
  getAllModeManagementFunctions() {
    return {
      initModeManagement: this.initModeManagement.bind(this),
      setHoldingTankMode: this.setHoldingTankMode.bind(this),
      getHoldingTankMode: this.getHoldingTankMode.bind(this),
      toggleAutoPlay: this.toggleAutoPlay.bind(this),
      getAutoPlayState: this.getAutoPlayState.bind(this),
      setAudioContext: this.setAudioContext.bind(this),
      resetToDefaultMode: this.resetToDefaultMode.bind(this),
    };
  }

  /**
   * Test all mode management functions
   *
   * @returns {Object} - Test results
   */
  test() {
    const results = {};

    // Test each function
    const functions = [
      'initModeManagement',
      'setHoldingTankMode',
      'getHoldingTankMode',
      'toggleAutoPlay',
      'getAutoPlayState',
      'setAudioContext',
      'resetToDefaultMode',
    ];

    for (const funcName of functions) {
      if (typeof this[funcName] === 'function') {
        results[funcName] = '✅ Function exists';
      } else {
        results[funcName] = '❌ Function missing';
      }
    }

    return results;
  }

  /**
   * Get module information
   *
   * @returns {Object} - Module information
   */
  getInfo() {
    return {
      name: 'Mode Management Module',
      version: '1.0.0',
      description: 'Provides mode switching functionality',
      functions: this.getAllModeManagementFunctions(),
    };
  }
}

// Create and export a singleton instance
const modeManagementModule = new ModeManagementModule();

// Export individual functions for backward compatibility
export const initModeManagement =
  modeManagementModule.initModeManagement.bind(modeManagementModule);
export const setHoldingTankMode =
  modeManagementModule.setHoldingTankMode.bind(modeManagementModule);
export const getHoldingTankMode =
  modeManagementModule.getHoldingTankMode.bind(modeManagementModule);
export const toggleAutoPlay =
  modeManagementModule.toggleAutoPlay.bind(modeManagementModule);
export const getAutoPlayState =
  modeManagementModule.getAutoPlayState.bind(modeManagementModule);
export const setAudioContext =
  modeManagementModule.setAudioContext.bind(modeManagementModule);
export const resetToDefaultMode =
  modeManagementModule.resetToDefaultMode.bind(modeManagementModule);

// Default export for module loading
export default modeManagementModule;
