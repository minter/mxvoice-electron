/**
 * DebugLog Module Index
 * 
 * This module serves as the main entry point for all debug logging functionality
 * in the MxVoice Electron application.
 */

// Import debug log sub-modules
import debugLogger from './debug-logger.js';
import logFormatter from './log-formatter.js';

/**
 * Initialize the DebugLog module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} DebugLog module interface
 */
function initializeDebugLog(options = {}) {
  const { electronAPI, db, store } = options;
  
  // Initialize sub-modules
  const logger = debugLogger({ electronAPI, db, store });
  const formatter = logFormatter({ electronAPI, db, store });
  
  return {
    // Debug Logger functions
    log: logger.log,
    warn: logger.warn,
    error: logger.error,
    info: logger.info,
    debug: logger.debug,
    
    // Log Formatter functions
    formatMessage: formatter.formatMessage,
    formatTimestamp: formatter.formatTimestamp,
    formatContext: formatter.formatContext,
    
    // Utility functions
    isDebugEnabled: logger.isDebugEnabled,
    setDebugEnabled: logger.setDebugEnabled,
    getLogLevel: logger.getLogLevel,
    setLogLevel: logger.setLogLevel,
    
    // Module info
    version: '1.0.0',
    description: 'DebugLog Module for MxVoice Application'
  };
}

// Create and export a singleton instance
// Note: This will be re-initialized with proper dependencies when the module is loaded
let debugLogModule = initializeDebugLog();

// Function to re-initialize with proper dependencies
function reinitializeDebugLog(options = {}) {
  debugLogModule = initializeDebugLog(options);
  return debugLogModule;
}

// Export individual functions for direct access
export const log = debugLogModule.log;
export const warn = debugLogModule.warn;
export const error = debugLogModule.error;
export const info = debugLogModule.info;
export const debug = debugLogModule.debug;
export const formatMessage = debugLogModule.formatMessage;
export const formatTimestamp = debugLogModule.formatTimestamp;
export const formatContext = debugLogModule.formatContext;
export const isDebugEnabled = debugLogModule.isDebugEnabled;
export const setDebugEnabled = debugLogModule.setDebugEnabled;
export const getLogLevel = debugLogModule.getLogLevel;
export const setLogLevel = debugLogModule.setLogLevel;
export { reinitializeDebugLog };

// Add reinitialize function to the default export
debugLogModule.reinitializeDebugLog = reinitializeDebugLog;

// Default export for module loading
export default debugLogModule; 