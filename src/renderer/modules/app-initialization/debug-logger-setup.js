// Debug Logger Setup Module
// Extracted from renderer.js lines 15-79 for app-initialization module

import initializeDebugLogger from '../debug-log/debug-logger.js';

/**
 * Debug Logger Setup class for centralized debug logger initialization
 * Handles initialization, fallback creation, and wrapper functions
 */
export class DebugLoggerSetup {
  constructor() {
    this.debugLogger = null;
  }

  /**
   * Initialize debug logger with fallback
   * @param {Object} context - Context object with electronAPI, db, store
   * @returns {Promise<Object>} Debug logger instance
   */
  async initializeDebugLoggerInstance(context = {}) {
    try {
      this.debugLogger = initializeDebugLogger({
        electronAPI: context.electronAPI || window.electronAPI
      });
      await this.debugLogger.info('Debug logger initialized');
      return this.debugLogger;
    } catch (error) {
      // Create fallback logger
      this.debugLogger = {
        log: (...args) => {},
        warn: (...args) => {},
        error: (...args) => {},
        info: (...args) => {},
        debug: (...args) => {},
        isDebugEnabled: () => Promise.resolve(false),
        setDebugEnabled: () => Promise.resolve(false),
        getLogLevel: () => 2,
        setLogLevel: () => {}
      };
      return this.debugLogger;
    }
  }

  /**
   * Get the current debug logger instance
   * @returns {Object} Debug logger instance
   */
  getDebugLogger() {
    return this.debugLogger;
  }

  /**
   * Synchronous wrapper for info logging with fallback
   * @param {string} message - Log message
   * @param {*} context - Optional context data
   */
  logInfo(message, context = null) {
    if (this.debugLogger) {
      this.debugLogger.info(message, context);
    }
  }

  /**
   * Synchronous wrapper for debug logging with fallback
   * @param {string} message - Log message
   * @param {*} context - Optional context data
   */
  logDebug(message, context = null) {
    if (this.debugLogger) {
      this.debugLogger.debug(message, context);
    }
  }

  /**
   * Synchronous wrapper for warning logging with fallback
   * @param {string} message - Log message
   * @param {*} context - Optional context data
   */
  logWarn(message, context = null) {
    if (this.debugLogger) {
      this.debugLogger.warn(message, context);
    }
  }

  /**
   * Synchronous wrapper for error logging with fallback
   * @param {string} message - Log message
   * @param {*} context - Optional context data
   */
  logError(message, context = null) {
    if (this.debugLogger) {
      this.debugLogger.error(message, context);
    }
  }

  /**
   * Create global logging functions for backward compatibility
   * This allows renderer.js and other modules to use logInfo, logDebug, etc.
   */
  createGlobalLoggers() {
    // Make logging functions available globally for backward compatibility
    window.logInfo = this.logInfo.bind(this);
    window.logDebug = this.logDebug.bind(this);
    window.logWarn = this.logWarn.bind(this);
    window.logError = this.logError.bind(this);
    
    // CRITICAL: Set window.debugLog for modules that expect it
    window.debugLog = this.debugLogger;
  }
}

// Export default instance for immediate use
export { DebugLoggerSetup as default };
