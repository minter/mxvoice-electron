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

import { openHotkeyFile, openHoldingTankFile, saveHotkeyFile, saveHoldingTankFile } from './file-operations.js';
import { pickDirectory, installUpdate } from './system-operations.js';

/**
 * File Operations Singleton
 * 
 * Provides a unified interface for all file I/O operations
 */
class FileOperationsModule {
  constructor() {
    // Bind all functions as methods
    this.openHotkeyFile = openHotkeyFile;
    this.openHoldingTankFile = openHoldingTankFile;
    this.saveHotkeyFile = saveHotkeyFile;
    this.saveHoldingTankFile = saveHoldingTankFile;
    this.pickDirectory = pickDirectory;
    this.installUpdate = installUpdate;
  }

  /**
   * Initialize the file operations module
   */
  init() {
    debugLog?.info('File operations module initialized', { 
      module: 'file-operations',
      function: 'init'
    });
  }

  /**
   * Get all available file operations functions
   * 
   * @returns {Object} - Object containing all file operations functions
   */
  getAllFileOperations() {
    return {
      openHotkeyFile: this.openHotkeyFile,
      openHoldingTankFile: this.openHoldingTankFile,
      saveHotkeyFile: this.saveHotkeyFile,
      saveHoldingTankFile: this.saveHoldingTankFile,
      pickDirectory: this.pickDirectory,
      installUpdate: this.installUpdate
    };
  }

  /**
   * Test all file operations functions
   * 
   * @returns {Object} - Test results
   */
  test() {
    const results = {};

    // Test each function
    const functions = [
      'openHotkeyFile',
      'openHoldingTankFile',
      'saveHotkeyFile',
      'saveHoldingTankFile',
      'pickDirectory',
      'installUpdate'
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
      name: 'File Operations Module',
      version: '1.0.0',
      description: 'Provides file I/O operations for the application',
      functions: this.getAllFileOperations()
    };
  }
}

// Create and export a singleton instance
const fileOperationsModule = new FileOperationsModule();

// Default export for module loading
export default fileOperationsModule; 