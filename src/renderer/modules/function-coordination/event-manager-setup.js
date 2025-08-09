/**
 * Event Manager Setup Module
 * 
 * This module handles the initialization and setup of the event manager system.
 * It provides centralized management of event handling and coordination.
 * 
 * Extracted from renderer.js as part of Phase 4 modularization.
 */

import EventManager from '../../event-manager.js';

/**
 * EventManagerSetup class handles event manager initialization and management
 */
export class EventManagerSetup {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.eventManager = null;
    this.logger = dependencies.debugLog || console;
  }

  /**
   * Initialize the event manager with function registry
   * @param {FunctionRegistry} functionRegistry - Function registry instance
   * @param {Object} debugLogger - Debug logger instance
   * @returns {EventManager} - Initialized event manager
   */
  initialize(functionRegistry, debugLogger) {
    try {
      if (!functionRegistry) {
        throw new Error('Function registry is required for event manager initialization');
      }

      if (!this.eventManager) {
        this.eventManager = new EventManager(functionRegistry, debugLogger || this.logger);
        this.logInfo('Event manager initialized successfully');
        return this.eventManager;
      }
      return this.eventManager;
    } catch (error) {
      this.logError('Failed to initialize event manager:', error);
      throw error;
    }
  }

  /**
   * Set up event manager and initialize event handling
   * @returns {Promise<boolean>} - Success status
   */
  async setup() {
    try {
      if (!this.eventManager) {
        throw new Error('Event manager not initialized');
      }

      this.logInfo('Setting up event manager...');
      
      // Initialize the event manager to replace onclick attributes
      this.eventManager.initialize();
      
      this.logInfo('Event manager setup completed');
      return true;
    } catch (error) {
      this.logError('Failed to setup event manager:', error);
      return false;
    }
  }

  /**
   * Get event manager statistics
   * @returns {Object} - Event manager statistics
   */
  getStats() {
    try {
      if (!this.eventManager) {
        return { error: 'Event manager not initialized' };
      }

      const stats = this.eventManager.getStats();
      this.logInfo('Event Manager Statistics', stats);
      return stats;
    } catch (error) {
      this.logError('Error getting event manager stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Get the event manager instance
   * @returns {EventManager|null} - Event manager instance
   */
  getEventManager() {
    return this.eventManager;
  }

  /**
   * Cleanup event manager resources
   * @returns {boolean} - Success status
   */
  cleanup() {
    try {
      if (this.eventManager && typeof this.eventManager.cleanup === 'function') {
        this.eventManager.cleanup();
        this.logInfo('Event manager cleaned up successfully');
      }
      return true;
    } catch (error) {
      this.logError('Error cleaning up event manager:', error);
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
export default EventManagerSetup;
