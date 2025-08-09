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
    this.holdingTankMode = "storage"; // 'storage' or 'playlist'
    this.autoplay = false;
    this.sound = null; // Audio context
  }

  /**
   * Initialize the mode management module
   */
  async initModeManagement() {
    debugLog?.info('Initializing Mode Management Module', { 
      module: 'mode-management',
      function: 'initModeManagement'
    });
    
    // Load saved mode or default to storage
    try {
      const hasMode = await secureStore.has("holding_tank_mode");
      if (hasMode) {
        const mode = await secureStore.get("holding_tank_mode");
        this.holdingTankMode = mode;
        // Initialize the mode UI
        this.setHoldingTankMode(this.holdingTankMode);
        return { success: true, mode: mode };
      } else {
        this.holdingTankMode = "storage"; // Default to storage mode
        // Initialize the mode UI
        this.setHoldingTankMode(this.holdingTankMode);
        return { success: true, mode: this.holdingTankMode };
      }
    } catch (error) {
      debugLog?.error('Failed to initialize mode management', { 
        module: 'mode-management',
        function: 'initModeManagement',
        error: error.message
      });
      return { success: false, error: error.message };
    }
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
      mode: mode
    });
    
    this.holdingTankMode = mode;
    
    // Update shared state for audio manager to read
    if (window.sharedState) {
      window.sharedState.set('holdingTankMode', mode);
    }

    // Update button states
    if (mode === "storage") {
      $("#storage_mode_btn").addClass("active");
      $("#playlist_mode_btn").removeClass("active");
      $("#holding_tank")
        .removeClass("holding-tank-playlist-mode")
        .addClass("holding-tank-storage-mode");
      
      this.autoplay = false;
      // Update shared state for autoplay
      if (window.sharedState) {
        window.sharedState.set('autoplay', false);
      }
      
      $(".now_playing").removeClass("now_playing");
      $("#holding_tank").removeClass("autoplaying");
    } else if (mode === "playlist") {
      $("#playlist_mode_btn").addClass("active");
      $("#storage_mode_btn").removeClass("active");
      $("#holding_tank")
        .removeClass("holding-tank-storage-mode")
        .addClass("holding-tank-playlist-mode");
      
      this.autoplay = true;
      // Update shared state for autoplay
      if (window.sharedState) {
        window.sharedState.set('autoplay', true);
      }

      // Only restore the speaker icon if there's a track currently playing AND it's actually playing
      let currentSongId = $("#song_now_playing").attr("songid");
      let isCurrentlyPlaying = window.sound && window.sound.playing && window.sound.playing();

      if (currentSongId && isCurrentlyPlaying) {
        // Find the track in the holding tank with this song ID and add the now_playing class
        $(`#holding_tank .list-group-item[songid="${currentSongId}"]`).addClass(
          "now_playing"
        );
      }
    }

    // Save mode to store
    try {
      const result = await secureStore.set("holding_tank_mode", mode);
      if (result.success) {
        debugLog?.info('Holding tank mode saved', { 
          module: 'mode-management',
          function: 'setHoldingTankMode',
          mode: mode
        });
      } else {
        debugLog?.warn('Failed to save holding tank mode', { 
          module: 'mode-management',
          function: 'setHoldingTankMode',
          mode: mode,
          error: result.error
        });
      }
      return result;
    } catch (error) {
      debugLog?.warn('Store save error', { 
        module: 'mode-management',
        function: 'setHoldingTankMode',
        mode: mode,
        error: error.message
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
      function: 'toggleAutoPlay'
    });
    
    if (this.holdingTankMode === "storage") {
      return this.setHoldingTankMode("playlist");
    } else {
      return this.setHoldingTankMode("storage");
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
      function: 'setAudioContext'
    });
  }

  /**
   * Reset mode to default (storage)
   * @returns {Promise<Object>} - Result of the operation
   */
  async resetToDefaultMode() {
    debugLog?.info('Resetting to default mode', { 
      module: 'mode-management',
      function: 'resetToDefaultMode'
    });
    return this.setHoldingTankMode("storage");
  }

  /**
   * Initialize the module (alias for initModeManagement)
   */
  async init() {
    return this.initModeManagement();
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
      resetToDefaultMode: this.resetToDefaultMode.bind(this)
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
      'resetToDefaultMode'
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
      functions: this.getAllModeManagementFunctions()
    };
  }
}

// Create and export a singleton instance
const modeManagementModule = new ModeManagementModule();

// Export individual functions for backward compatibility
export const initModeManagement = modeManagementModule.initModeManagement.bind(modeManagementModule);
export const setHoldingTankMode = modeManagementModule.setHoldingTankMode.bind(modeManagementModule);
export const getHoldingTankMode = modeManagementModule.getHoldingTankMode.bind(modeManagementModule);
export const toggleAutoPlay = modeManagementModule.toggleAutoPlay.bind(modeManagementModule);
export const getAutoPlayState = modeManagementModule.getAutoPlayState.bind(modeManagementModule);
export const setAudioContext = modeManagementModule.setAudioContext.bind(modeManagementModule);
export const resetToDefaultMode = modeManagementModule.resetToDefaultMode.bind(modeManagementModule);

// Default export for module loading
export default modeManagementModule; 