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

// Export all song management functions
export {
  saveEditedSong,
  saveNewSong,
  editSelectedSong,
  deleteSelectedSong,
  deleteSong,
  removeFromHoldingTank,
  removeFromHotkey
};

// Default export for module loading
export default {
  saveEditedSong,
  saveNewSong,
  editSelectedSong,
  deleteSelectedSong,
  deleteSong,
  removeFromHoldingTank,
  removeFromHotkey
}; 