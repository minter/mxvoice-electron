/**
 * Log Formatter
 * 
 * Handles formatting of log messages, timestamps, and context information.
 * 
 * @module log-formatter
 */

/**
 * Initialize the log formatter
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Log formatter interface
 */
function initializeLogFormatter(options = {}) {
  const { electronAPI, db, store } = options;
  
  /**
   * Format a log message with optional context
   * @param {string} message - The log message
   * @param {Object} context - Additional context (optional)
   * @returns {string} Formatted message
   */
  function formatMessage(message, context = null) {
    let formattedMessage = message;
    
    if (context) {
      if (typeof context === 'object') {
        // Handle different types of context objects
        if (context.error) {
          formattedMessage += ` | Error: ${context.error.message || context.error}`;
        }
        if (context.data) {
          formattedMessage += ` | Data: ${JSON.stringify(context.data)}`;
        }
        if (context.function) {
          formattedMessage += ` | Function: ${context.function}`;
        }
        if (context.module) {
          formattedMessage += ` | Module: ${context.module}`;
        }
        if (context.userId) {
          formattedMessage += ` | User: ${context.userId}`;
        }
        if (context.sessionId) {
          formattedMessage += ` | Session: ${context.sessionId}`;
        }
        if (context.timestamp) {
          formattedMessage += ` | Time: ${formatTimestamp(context.timestamp)}`;
        }
        
        // Handle any other context properties
        const otherProps = Object.keys(context).filter(key => 
          !['error', 'data', 'function', 'module', 'userId', 'sessionId', 'timestamp'].includes(key)
        );
        
        if (otherProps.length > 0) {
          const otherContext = {};
          otherProps.forEach(key => {
            otherContext[key] = context[key];
          });
          formattedMessage += ` | Context: ${JSON.stringify(otherContext)}`;
        }
      } else {
        // Simple string or primitive context
        formattedMessage += ` | Context: ${context}`;
      }
    }
    
    return formattedMessage;
  }
  
  /**
   * Format a timestamp
   * @param {Date|string|number} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  function formatTimestamp(timestamp) {
    if (!timestamp) {
      return new Date().toISOString();
    }
    
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = new Date();
    }
    
    return date.toISOString();
  }
  
  /**
   * Format context information
   * @param {Object} context - Context object to format
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
        ? JSON.stringify(context.data) 
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
      contextParts.push(`Other: ${JSON.stringify(otherContext)}`);
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