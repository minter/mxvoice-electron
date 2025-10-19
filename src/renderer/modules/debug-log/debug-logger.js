/**
 * Debug Logger
 * 
 * Handles centralized logging functionality with respect to debug preferences.
 * 
 * @module debug-logger
 */

import { safeStringify } from './utils.js';

/**
 * Initialize the debug logger
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Debug logger interface
 */
function initializeDebugLogger(options = {}) {
  const { electronAPI } = options;
  
  // Log levels
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };
  
  // Default log level (temporarily set to DEBUG for migration testing)
  let currentLogLevel = LOG_LEVELS.DEBUG;
  
  // Cache for debug enabled state (temporarily enabled for migration testing)
  let debugEnabledCache = true;
  let debugEnabledCacheTime = Date.now();
  const CACHE_DURATION = 5000; // 5 seconds
  
  /**
   * Check if debug logging is enabled
   * Uses caching to avoid repeated preference checks
   * @returns {Promise<boolean>} Whether debug logging is enabled
   */
  async function isDebugEnabled() {
    const now = Date.now();
    
    // Return cached value if still valid
    if (now - debugEnabledCacheTime < CACHE_DURATION) {
      return debugEnabledCache;
    }
    
    try {
      if (electronAPI && electronAPI.store) {
        const result = await electronAPI.store.get("debug_log_enabled");
        if (result.success) {
          debugEnabledCache = result.value || false;
        } else {
          debugEnabledCache = false;
        }
      } else {
        debugEnabledCache = false;
      }
    } catch (error) {
              // Note: This is the fallback for when debug logging fails - avoid infinite recursion
        // In production, this should rarely be reached
      debugEnabledCache = false;
    }
    
    debugEnabledCacheTime = now;
    return debugEnabledCache;
  }
  
  /**
   * Set debug logging enabled state
   * @param {boolean} enabled - Whether debug logging should be enabled
   * @returns {Promise<boolean>} Success status
   */
  async function setDebugEnabled(enabled) {
    try {
      if (electronAPI && electronAPI.store) {
        const result = await electronAPI.store.set("debug_log_enabled", enabled);
        if (result.success) {
          debugEnabledCache = enabled;
          debugEnabledCacheTime = Date.now();
          return true;
        } else {
          // Note: This is the fallback for when debug logging fails - avoid infinite recursion
        // In production, this should rarely be reached
          return false;
        }
      } else {
        // Note: This is the fallback for when debug logging fails - avoid infinite recursion
        // In production, this should rarely be reached
        return false;
      }
    } catch (error) {
              // Note: This is the fallback for when debug logging fails - avoid infinite recursion
        // In production, this should rarely be reached
      return false;
    }
  }
  
  /**
   * Get current log level
   * @returns {number} Current log level
   */
  function getLogLevel() {
    return currentLogLevel;
  }
  
  /**
   * Set log level
   * @param {number} level - New log level
   */
  function setLogLevel(level) {
    if (LOG_LEVELS.hasOwnProperty(level) || Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
    }
  }
  
  /**
   * Format a log message with level and context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Additional context (optional)
   * @returns {string} Formatted log message
   */
  function formatLogMessage(level, message, context = null) {
    const timestamp = new Date().toISOString();
    const levelIcon = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : 'ℹ️';
    
    let formattedMessage = `${levelIcon} [${timestamp}] [${level}] ${message}`;
    
    if (context) {
      if (typeof context === 'object') {
        formattedMessage += ` | Context: ${safeStringify(context)}`;
      } else {
        formattedMessage += ` | Context: ${context}`;
      }
    }
    
    return formattedMessage;
  }
  
  /**
   * Log an error message
   * Always logged regardless of debug preference
   * @param {string} message - Error message
   * @param {Object} context - Additional context (optional)
   */
  function error(message, context = null) {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      const formattedMessage = formatLogMessage('ERROR', message, context);
              // Note: This is the fallback for when debug logging fails - avoid infinite recursion
        // In production, this should rarely be reached
      try { 
        electronAPI?.logs?.write('ERROR', message, context, { source: 'app' }); 
      } catch (_) {
        // Intentional fallback to prevent infinite recursion in debug logger
        // This catch block prevents the debug logger from crashing when logging fails
      }
    }
  }
  
  /**
   * Log a warning message
   * Always logged regardless of debug preference
   * @param {string} message - Warning message
   * @param {Object} context - Additional context (optional)
   */
  function warn(message, context = null) {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      const formattedMessage = formatLogMessage('WARN', message, context);
      // Output to console for immediate visibility during development
      console.warn(formattedMessage);
      try { 
        electronAPI?.logs?.write('WARN', message, context, { source: 'app' }); 
      } catch (_) {
        // Intentional fallback to prevent infinite recursion in debug logger
        // This catch block prevents the debug logger from crashing when logging fails
      }
    }
  }
  
  /**
   * Log an info message
   * Only logged if debug logging is enabled
   * @param {string} message - Info message
   * @param {Object} context - Additional context (optional)
   */
  async function info(message, context = null) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      const debugEnabled = await isDebugEnabled();
      if (debugEnabled) {
        const formattedMessage = formatLogMessage('INFO', message, context);
        // Output to console for immediate visibility during development
        console.info(formattedMessage);
        try { 
          electronAPI?.logs?.write('INFO', message, context, { source: 'app' }); 
        } catch (_) {
          // Intentional fallback to prevent infinite recursion in debug logger
          // This catch block prevents the debug logger from crashing when logging fails
        }
      }
    }
  }
  
  /**
   * Log a debug message
   * Only logged if debug logging is enabled
   * @param {string} message - Debug message
   * @param {Object} context - Additional context (optional)
   */
  async function debug(message, context = null) {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      const debugEnabled = await isDebugEnabled();
      if (debugEnabled) {
        const formattedMessage = formatLogMessage('DEBUG', message, context);
        // Note: This is the fallback for when debug logging fails - avoid infinite recursion
        // In production, this should rarely be reached
        try { 
          electronAPI?.logs?.write('DEBUG', message, context, { source: 'app' }); 
        } catch (_) {
          // Intentional fallback to prevent infinite recursion in debug logger
          // This catch block prevents the debug logger from crashing when logging fails
        }
      }
    }
  }
  
  /**
   * Log a general message
   * Uses info level by default
   * @param {string} message - Log message
   * @param {Object} context - Additional context (optional)
   */
  function log(message, context = null) {
    info(message, context);
  }
  
  return {
    log,
    warn,
    error,
    info,
    debug,
    isDebugEnabled,
    setDebugEnabled,
    getLogLevel,
    setLogLevel
  };
}

export {
  initializeDebugLogger
};

// Default export for module loading
export default initializeDebugLogger; 