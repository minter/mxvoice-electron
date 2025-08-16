/**
 * Song Management Module
 * 
 * This module handles all song-related CRUD operations including:
 * - Creating new songs
 * - Editing existing songs
 * - Deleting songs
 * - Removing songs from holding tank and hotkeys
 * - Bulk song operations
 * 
 * @module song-management
 */

// Import debug logger
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

import { saveEditedSong, saveNewSong, editSelectedSong, deleteSelectedSong, startAddNewSong } from './song-crud.js';
import { deleteSong, removeFromHoldingTank, removeFromHotkey } from './song-removal.js';

/**
 * Song Management Singleton
 * 
 * Provides a unified interface for all song-related operations
 */
class SongManagementModule {
  constructor() {
    // Bind all functions as methods
    this.saveEditedSong = saveEditedSong;
    this.saveNewSong = saveNewSong;
    this.editSelectedSong = editSelectedSong;
    this.deleteSelectedSong = deleteSelectedSong;
    this.startAddNewSong = startAddNewSong;
    this.deleteSong = deleteSong;
    this.removeFromHoldingTank = removeFromHoldingTank;
    this.removeFromHotkey = removeFromHotkey;
  }

  /**
   * Initialize the song management module
   * @param {Object} dependencies - Module dependencies
   * @returns {Promise<boolean>} Success status
   */
  async init(dependencies = {}) {
    try {
      debugLog?.info('Song management module initializing...', { 
        module: 'song-management', 
        function: 'init' 
      });

      // Initialize song management functionality
      this.setupSongManagement();
      
      debugLog?.info('Song management module initialized successfully', { 
        module: 'song-management', 
        function: 'init' 
      });
      return true;
    } catch (error) {
      debugLog?.error('Failed to initialize song management module:', { 
        module: 'song-management', 
        function: 'init', 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Set up song management functionality
   */
  setupSongManagement() {
    // Initialize song management state and functionality
    debugLog?.info('Setting up song management functionality', { 
      module: 'song-management', 
      function: 'setupSongManagement' 
    });
  }

  /**
   * Get all available song management functions
   * 
   * @returns {Object} - Object containing all song management functions
   */
  getAllSongManagementFunctions() {
    return {
      saveEditedSong: this.saveEditedSong,
      saveNewSong: this.saveNewSong,
      editSelectedSong: this.editSelectedSong,
      deleteSelectedSong: this.deleteSelectedSong,
      startAddNewSong: this.startAddNewSong,
      deleteSong: this.deleteSong,
      removeFromHoldingTank: this.removeFromHoldingTank,
      removeFromHotkey: this.removeFromHotkey
    };
  }

  /**
   * Test all song management functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {};

    // Test each function
    const functions = [
      'saveEditedSong',
      'saveNewSong',
      'editSelectedSong',
      'deleteSelectedSong',
      'deleteSong',
      'removeFromHoldingTank',
      'removeFromHotkey'
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
      name: 'Song Management Module',
      version: '1.0.0',
      description: 'Provides song-related CRUD operations',
      functions: this.getAllSongManagementFunctions()
    };
  }
}

// Create and export a singleton instance
const songManagementModule = new SongManagementModule();

// Default export for module loading
export default songManagementModule; 