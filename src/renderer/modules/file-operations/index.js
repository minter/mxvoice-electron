/**
 * File Operations Module
 * 
 * This module handles all file I/O operations including:
 * - Opening and saving hotkey files
 * - Opening and saving holding tank files
 * - Directory picking functionality
 * - Update installation
 * 
 * @module file-operations
 */

import { openHotkeyFile, openHoldingTankFile, saveHotkeyFile, saveHoldingTankFile } from './file-operations.js';
import { pickDirectory, installUpdate } from './system-operations.js';

// Export all file operations
export {
  openHotkeyFile,
  openHoldingTankFile,
  saveHotkeyFile,
  saveHoldingTankFile,
  pickDirectory,
  installUpdate
};

// Default export for module loading
export default {
  openHotkeyFile,
  openHoldingTankFile,
  saveHotkeyFile,
  saveHoldingTankFile,
  pickDirectory,
  installUpdate
}; 