/**
 * Log Formatter
 * 
 * Handles formatting of log messages with consistent structure and styling.
 * 
 * @module log-formatter
 */

import { safeStringify } from './utils.js';

/**
 * Initialize the log formatter
 * @param {Object} options - Configuration options
 * @returns {Object} Log formatter interface
 */
function initializeLogFormatter(options = {}) {
  const { 
    showTimestamp = true, 
    showLevel = true, 
    timestampFormat = 'ISO',
    maxContextLength = 200
  } = options;

  /**
   * Format a log message with consistent structure
   * @param {string} message - Main log message
   * @param {Object} context - Additional context information
   * @returns {string} Formatted log message
   */
  function formatMessage(message, context = null) {
    let formattedMessage = message;
    
    if (context && typeof context === 'object') {
      const contextStr = formatContext(context);
      if (contextStr) {
        formattedMessage += ` | ${contextStr}`;
      }
    }
    
    return formattedMessage;
  }

  /**
   * Format a timestamp according to specified format
   * @param {Date} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  function formatTimestamp(timestamp) {
    if (!timestamp) {
      timestamp = new Date();
    }
    
    switch (timestampFormat) {
      case 'ISO':
        return timestamp.toISOString();
      case 'local':
        return timestamp.toLocaleString();
      case 'time':
        return timestamp.toLocaleTimeString();
      default:
        return timestamp.toISOString();
    }
  }



  /**
   * Format context information for logging
   * @param {Object} context - Context object
   * @returns {string} Formatted context string
   */
  function formatContext(context) {
    if (!context || typeof context !== 'object') {
      return '';
    }
    
    const contextParts = [];
    
    // Add function name if available
    if (context.function) {
      contextParts.push(`Function: ${context.function}`);
    }
    
    // Add module name if available
    if (context.module) {
      contextParts.push(`Module: ${context.module}`);
    }
    
    // Add error information if available
    if (context.error) {
      const errorMessage = context.error.message || context.error;
      contextParts.push(`Error: ${errorMessage}`);
    }
    
    // Add data if available
    if (context.data) {
      const dataStr = typeof context.data === 'object' 
        ? safeStringify(context.data)
        : String(context.data);
      contextParts.push(`Data: ${dataStr}`);
    }
    
    // Add user information if available
    if (context.userId) {
      contextParts.push(`User: ${context.userId}`);
    }
    
    // Add session information if available
    if (context.sessionId) {
      contextParts.push(`Session: ${context.sessionId}`);
    }
    
    // Add any other properties
    const otherProps = Object.keys(context).filter(key => 
      !['function', 'module', 'error', 'data', 'userId', 'sessionId'].includes(key)
    );
    
    if (otherProps.length > 0) {
      const otherContext = {};
      otherProps.forEach(key => {
        otherContext[key] = context[key];
      });
      contextParts.push(`Other: ${safeStringify(otherContext)}`);
    }
    
    return contextParts.join(' | ');
  }
  
  /**
   * Create a context object with common properties
   * @param {Object} options - Context options
   * @param {string} options.function - Function name
   * @param {string} options.module - Module name
   * @param {Object} options.data - Additional data
   * @param {Error} options.error - Error object
   * @returns {Object} Context object
   */
  function createContext(options = {}) {
    const context = {
      timestamp: new Date()
    };
    
    if (options.function) {
      context.function = options.function;
    }
    
    if (options.module) {
      context.module = options.module;
    }
    
    if (options.data) {
      context.data = options.data;
    }
    
    if (options.error) {
      context.error = options.error;
    }
    
    return context;
  }
  
  /**
   * Format a stack trace
   * @param {Error} error - Error object with stack trace
   * @returns {string} Formatted stack trace
   */
  function formatStackTrace(error) {
    if (!error || !error.stack) {
      return '';
    }
    
    // Clean up the stack trace for better readability
    return error.stack
      .split('\n')
      .filter(line => line.trim() && !line.includes('node_modules'))
      .slice(0, 5) // Limit to first 5 lines
      .join('\n');
  }
  
  return {
    formatMessage,
    formatTimestamp,
    formatContext,
    createContext,
    formatStackTrace
  };
}

export {
  initializeLogFormatter
};

// Default export for module loading
export default initializeLogFormatter; 