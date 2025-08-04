/**
 * Validation Utilities Module
 * 
 * This module contains utility functions for data validation
 * in the MxVoice Electron application.
 */

/**
 * Validate if a value is a valid song ID
 * 
 * @param {any} songId - The value to validate
 * @returns {boolean} - True if valid song ID, false otherwise
 */
function isValidSongId(songId) {
  return songId && typeof songId === 'string' && songId.trim().length > 0;
}

/**
 * Validate if a value is a valid category code
 * 
 * @param {any} categoryCode - The value to validate
 * @returns {boolean} - True if valid category code, false otherwise
 */
function isValidCategoryCode(categoryCode) {
  return categoryCode && typeof categoryCode === 'string' && categoryCode.trim().length > 0;
}

/**
 * Validate if a value is a valid file path
 * 
 * @param {any} filePath - The value to validate
 * @returns {boolean} - True if valid file path, false otherwise
 */
function isValidFilePath(filePath) {
  return filePath && typeof filePath === 'string' && filePath.trim().length > 0;
}

/**
 * Validate if a value is a valid hotkey identifier
 * 
 * @param {any} hotkey - The value to validate
 * @returns {boolean} - True if valid hotkey, false otherwise
 */
function isValidHotkey(hotkey) {
  return hotkey && typeof hotkey === 'string' && /^f\d+$/.test(hotkey);
}

// Export the validation utilities
module.exports = {
  isValidSongId,
  isValidCategoryCode,
  isValidFilePath,
  isValidHotkey
}; 