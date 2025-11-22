/**
 * Main Process DebugLog Module
 * 
 * Handles centralized logging functionality for the main process
 * with respect to debug preferences.
 * 
 * @module debug-log
 */

import log from 'electron-log';
import Store from 'electron-store';

/**
 * Initialize the main process debug logger
 * @param {Object} options - Configuration options
 * @param {Object} options.store - Store reference (optional, for main process use)
 * @param {Function} options.getDebugPreference - Optional function to get debug preference (breaks circular dependency)
 * @returns {Object} Debug logger interface
 */
function initializeMainDebugLog(options = {}) {
  const { store, getDebugPreference } = options;
  
  // Log levels
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };
  
  // Default log level
  let currentLogLevel = LOG_LEVELS.INFO;
  
  // Cache for debug enabled state
  let debugEnabledCache = false;
  let debugEnabledCacheTime = 0;
  const CACHE_DURATION = 5000; // 5 seconds
  
  /**
   * Check if debug logging is enabled
   * Uses caching to avoid repeated preference checks
   * @returns {boolean} Whether debug logging is enabled
   */
  async function isDebugEnabled() {
    const now = Date.now();

    // Return cached value if still valid
    if (now - debugEnabledCacheTime < CACHE_DURATION) {
      return debugEnabledCache;
    }

    try {
      // Use injected preference getter if available (breaks circular dependency)
      if (getDebugPreference && typeof getDebugPreference === 'function') {
        debugEnabledCache = await getDebugPreference();
      } else if (store) {
        // Fallback to global store - debug logging is now enabled by default
        const value = store.get("debug_log_enabled");
        debugEnabledCache = value !== undefined ? value : true;
      } else {
        // Default to enabled when no store available
        debugEnabledCache = true;
      }
    } catch (error) {
      log.warn('Failed to get debug log preference:', error);
      debugEnabledCache = true; // Default to enabled on error
    }

    debugEnabledCacheTime = now;
    return debugEnabledCache;
  }
  
  /**
   * Set debug logging enabled state
   * @param {boolean} enabled - Whether debug logging should be enabled
   * @returns {boolean} Success status
   */
  function setDebugEnabled(enabled) {
    try {
      if (store) {
        store.set("debug_log_enabled", enabled);
      }
      debugEnabledCache = enabled;
      debugEnabledCacheTime = Date.now();
      return true;
    } catch (error) {
      log.warn('Failed to set debug log preference:', error);
      return false;
    }
  }
  
  /**
   * Get current log level
   * @returns {string} Current log level
   */
  function getLogLevel() {
    const levels = Object.keys(LOG_LEVELS);
    return levels[currentLogLevel] || 'INFO';
  }
  
  /**
   * Set log level
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
   */
  function setLogLevel(level) {
    if (LOG_LEVELS.hasOwnProperty(level)) {
      currentLogLevel = LOG_LEVELS[level];
    }
  }
  
  /**
   * Format log message with timestamp and context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Additional context (optional)
   * @returns {string} Formatted log message
   */
  function formatLogMessage(level, message, context = null) {
    const timestamp = new Date().toISOString();
    const levelIcons = {
      'ERROR': '❌',
      'WARN': '⚠️',
      'INFO': 'ℹ️',
      'DEBUG': '🐛'
    };
    
    const levelIcon = levelIcons[level] || '📝';
    let formattedMessage = `${levelIcon} [${timestamp}] [${level}] ${message}`;
    
    if (context) {
      if (typeof context === 'object') {
        try {
          // Handle circular references safely
          const seen = new WeakSet();
          const contextString = JSON.stringify(context, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              // Handle circular references
              if (seen.has(value)) {
                return '[Circular Reference]';
              }
              seen.add(value);
              
              // Replace complex objects with their constructor name
              if (value.constructor && value.constructor.name !== 'Object') {
                return `[${value.constructor.name}]`;
              }
            }
            return value;
          });
          formattedMessage += ` | Context: ${contextString}`;
        } catch (error) {
          formattedMessage += ` | Context: [Object - unable to serialize: ${error.message}]`;
        }
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
      log.error(formattedMessage);
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
      log.warn(formattedMessage);
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
        log.info(formattedMessage);
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
        log.debug(formattedMessage);
      }
    }
  }
  
  /**
   * Log a general message
   * Uses info level by default
   * @param {string} message - Log message
   * @param {Object} context - Additional context (optional)
   */
  async function logMessage(message, context = null) {
    await info(message, context);
  }
  
  return {
    log: logMessage,
    warn,
    error,
    info,
    debug,
    isDebugEnabled,
    setDebugEnabled,
    getLogLevel,
    setLogLevel,
    formatLogMessage
  };
}

export {
  initializeMainDebugLog
};

// Default export for module loading
export default initializeMainDebugLog; 