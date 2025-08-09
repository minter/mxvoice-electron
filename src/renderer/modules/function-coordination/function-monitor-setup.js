/**
 * Function Monitor Setup Module
 * 
 * This module handles the initialization and setup of the function monitor system.
 * It provides real-time health checking and monitoring of function availability.
 * 
 * Extracted from renderer.js as part of Phase 4 modularization.
 */

import FunctionMonitor from '../../function-monitor.js';

/**
 * FunctionMonitorSetup class handles function monitor initialization and management
 */
export class FunctionMonitorSetup {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.functionMonitor = null;
    this.logger = dependencies.debugLog || console;
  }

  /**
   * Initialize the function monitor with function registry
   * @param {FunctionRegistry} functionRegistry - Function registry instance
   * @param {Object} debugLogger - Debug logger instance
   * @returns {FunctionMonitor} - Initialized function monitor
   */
  initialize(functionRegistry, debugLogger) {
    try {
      if (!functionRegistry) {
        throw new Error('Function registry is required for function monitor initialization');
      }

      if (!this.functionMonitor) {
        this.functionMonitor = new FunctionMonitor(functionRegistry, debugLogger || this.logger);
        this.logInfo('Function monitor initialized successfully');
        return this.functionMonitor;
      }
      return this.functionMonitor;
    } catch (error) {
      this.logError('Failed to initialize function monitor:', error);
      throw error;
    }
  }

  /**
   * Start monitoring functions for real-time health checking
   * @returns {boolean} - Success status
   */
  startMonitoring() {
    try {
      if (!this.functionMonitor) {
        throw new Error('Function monitor not initialized');
      }

      this.logInfo('Starting function monitor...');
      this.functionMonitor.startMonitoring();
      this.logInfo('Function monitor started successfully');
      return true;
    } catch (error) {
      this.logError('Failed to start function monitor:', error);
      return false;
    }
  }

  /**
   * Stop monitoring functions
   * @returns {boolean} - Success status
   */
  stopMonitoring() {
    try {
      if (!this.functionMonitor) {
        this.logWarn('Function monitor not initialized for stopping');
        return false;
      }

      if (typeof this.functionMonitor.stopMonitoring === 'function') {
        this.functionMonitor.stopMonitoring();
        this.logInfo('Function monitor stopped successfully');
      }
      return true;
    } catch (error) {
      this.logError('Error stopping function monitor:', error);
      return false;
    }
  }

  /**
   * Get function monitor statistics
   * @returns {Object} - Monitor statistics
   */
  getStats() {
    try {
      if (!this.functionMonitor) {
        return { error: 'Function monitor not initialized' };
      }

      const stats = this.functionMonitor.getStats();
      this.logInfo('Function Monitor Statistics', stats);
      return stats;
    } catch (error) {
      this.logError('Error getting function monitor stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Get the function monitor instance
   * @returns {FunctionMonitor|null} - Function monitor instance
   */
  getFunctionMonitor() {
    return this.functionMonitor;
  }

  /**
   * Cleanup function monitor resources
   * @returns {boolean} - Success status
   */
  cleanup() {
    try {
      if (this.functionMonitor) {
        this.stopMonitoring();
        this.logInfo('Function monitor cleaned up successfully');
      }
      return true;
    } catch (error) {
      this.logError('Error cleaning up function monitor:', error);
      return false;
    }
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logInfo(message, context) {
    if (typeof this.logger?.info === 'function') {
      try {
        const result = this.logger.info(message, context);
        if (result && typeof result.catch === 'function') {
          result.catch(() => console.log(`ℹ️ ${message}`, context));
        }
      } catch (error) {
        console.log(`ℹ️ ${message}`, context);
      }
    } else if (typeof window?.logInfo === 'function') {
      window.logInfo(message, context);
    } else {
      console.log(`ℹ️ ${message}`, context || '');
    }
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logError(message, context) {
    if (typeof this.logger?.error === 'function') {
      try {
        const result = this.logger.error(message, context);
        if (result && typeof result.catch === 'function') {
          result.catch(() => console.error(`❌ ${message}`, context));
        }
      } catch (error) {
        console.error(`❌ ${message}`, context);
      }
    } else if (typeof window?.logError === 'function') {
      window.logError(message, context);
    } else {
      console.error(`❌ ${message}`, context || '');
    }
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logWarn(message, context) {
    if (typeof this.logger?.warn === 'function') {
      try {
        const result = this.logger.warn(message, context);
        if (result && typeof result.catch === 'function') {
          result.catch(() => console.warn(`⚠️ ${message}`, context));
        }
      } catch (error) {
        console.warn(`⚠️ ${message}`, context);
      }
    } else if (typeof window?.logWarn === 'function') {
      window.logWarn(message, context);
    } else {
      console.warn(`⚠️ ${message}`, context || '');
    }
  }
}

// Export default instance
export default FunctionMonitorSetup;
