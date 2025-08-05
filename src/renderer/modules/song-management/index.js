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

import { saveEditedSong, saveNewSong, editSelectedSong, deleteSelectedSong } from './song-crud.js';
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
    this.deleteSong = deleteSong;
    this.removeFromHoldingTank = removeFromHoldingTank;
    this.removeFromHotkey = removeFromHotkey;
  }

  /**
   * Initialize the song management module
   */
  init() {
    console.log('Song management module initialized');
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