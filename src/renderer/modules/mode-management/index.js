/**
 * Mode Management Module
 * 
 * This module handles mode switching functionality for the application.
 * It manages the holding tank mode (storage vs playlist) and autoplay functionality.
 */

// Global variables (these should be available from the main renderer context)
let holdingTankMode = "storage"; // 'storage' or 'playlist'
let autoplay = false;
let sound; // Audio context

/**
 * Initialize the mode management module
 */
export function initModeManagement() {
  console.log('🎛️ Initializing Mode Management Module');
  
  // Load saved mode or default to storage
  return window.electronAPI.store.has("holding_tank_mode").then(hasMode => {
    if (hasMode) {
      return window.electronAPI.store.get("holding_tank_mode").then(mode => {
        holdingTankMode = mode;
        // Initialize the mode UI
        setHoldingTankMode(holdingTankMode);
        return { success: true, mode: mode };
      });
    } else {
      holdingTankMode = "storage"; // Default to storage mode
      // Initialize the mode UI
      setHoldingTankMode(holdingTankMode);
      return { success: true, mode: holdingTankMode };
    }
  }).catch(error => {
    console.error('❌ Failed to initialize mode management:', error);
    return { success: false, error: error.message };
  });
}

/**
 * Set the holding tank mode (storage or playlist)
 * @param {string} mode - The mode to set ('storage' or 'playlist')
 * @returns {Promise<Object>} - Result of the operation
 */
export function setHoldingTankMode(mode) {
  console.log('🎛️ Setting holding tank mode:', mode);
  
  holdingTankMode = mode;

  // Update button states
  if (mode === "storage") {
    $("#storage_mode_btn").addClass("active");
    $("#playlist_mode_btn").removeClass("active");
    $("#holding_tank")
      .removeClass("holding-tank-playlist-mode")
      .addClass("holding-tank-storage-mode");
    autoplay = false;
    $(".now_playing").removeClass("now_playing");
    $("#holding_tank").removeClass("autoplaying");
  } else if (mode === "playlist") {
    $("#playlist_mode_btn").addClass("active");
    $("#storage_mode_btn").removeClass("active");
    $("#holding_tank")
      .removeClass("holding-tank-storage-mode")
      .addClass("holding-tank-playlist-mode");
    autoplay = true;

    // Only restore the speaker icon if there's a track currently playing AND it's actually playing
    var currentSongId = $("#song_now_playing").attr("songid");
    var isCurrentlyPlaying = window.sound && window.sound.playing && window.sound.playing();

    if (currentSongId && isCurrentlyPlaying) {
      // Find the track in the holding tank with this song ID and add the now_playing class
      $(`#holding_tank .list-group-item[songid="${currentSongId}"]`).addClass(
        "now_playing"
      );
    }
  }

  // Save mode to store
  return window.electronAPI.store.set("holding_tank_mode", mode).then(result => {
    if (result.success) {
      console.log('✅ Holding tank mode saved:', mode);
    } else {
      console.warn('❌ Failed to save holding tank mode:', result.error);
    }
    return result;
  }).catch(error => {
    console.warn('❌ Store save error:', error);
    return { success: false, error: error.message };
  });
}

/**
 * Get the current holding tank mode
 * @returns {string} - Current mode ('storage' or 'playlist')
 */
export function getHoldingTankMode() {
  return holdingTankMode;
}

/**
 * Toggle between storage and playlist modes
 * @returns {Promise<Object>} - Result of the operation
 */
export function toggleAutoPlay() {
  console.log('🎛️ Toggling autoplay mode');
  
  if (holdingTankMode === "storage") {
    return setHoldingTankMode("playlist");
  } else {
    return setHoldingTankMode("storage");
  }
}

/**
 * Get the current autoplay state
 * @returns {boolean} - Current autoplay state
 */
export function getAutoPlayState() {
  return autoplay;
}

/**
 * Set the audio context reference (called from main renderer)
 * @param {Object} audioContext - The audio context object
 */
export function setAudioContext(audioContext) {
  sound = audioContext;
  console.log('🎛️ Audio context set in mode management');
}

/**
 * Reset mode to default (storage)
 * @returns {Promise<Object>} - Result of the operation
 */
export function resetToDefaultMode() {
  console.log('🎛️ Resetting to default mode');
  return setHoldingTankMode("storage");
}

// Export all functions
export default {
  initModeManagement,
  setHoldingTankMode,
  getHoldingTankMode,
  toggleAutoPlay,
  getAutoPlayState,
  setAudioContext,
  resetToDefaultMode
}; 