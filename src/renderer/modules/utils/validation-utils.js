/**
 * Validation Utilities
 * 
 * Provides validation functions for the MxVoice Electron application
 */

/**
 * Validate song ID format
 * 
 * @param {string} songId - The song ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidSongId(songId) {
  if (!songId || typeof songId !== 'string') {
    return false;
  }
  
  // Song ID should be a non-empty string
  return songId.trim().length > 0;
}

/**
 * Validate category code format
 * 
 * @param {string} categoryCode - The category code to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidCategoryCode(categoryCode) {
  if (!categoryCode || typeof categoryCode !== 'string') {
    return false;
  }
  
  // Category code should be a non-empty string
  return categoryCode.trim().length > 0;
}

/**
 * Validate file path format
 * 
 * @param {string} filePath - The file path to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }
  
  // File path should be a non-empty string
  return filePath.trim().length > 0;
}

/**
 * Validate hotkey format
 * 
 * @param {string} hotkey - The hotkey to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidHotkey(hotkey) {
  if (!hotkey || typeof hotkey !== 'string') {
    return false;
  }
  
  // Hotkey should be a non-empty string
  return hotkey.trim().length > 0;
}

// Default export for module loading
export default {
  isValidSongId,
  isValidCategoryCode,
  isValidFilePath,
  isValidHotkey
}; 