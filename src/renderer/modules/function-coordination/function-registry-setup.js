/**
 * Function Registry Setup Module
 * 
 * This module handles the initialization and setup of the function registry system.
 * It provides centralized management of function registration and validation.
 * 
 * Extracted from renderer.js as part of Phase 4 modularization.
 */

import FunctionRegistry from '../../function-registry.js';

/**
 * FunctionRegistrySetup class handles function registry initialization and management
 */
export class FunctionRegistrySetup {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.functionRegistry = null;
    this.logger = dependencies.debugLog || console;
  }

  /**
   * Initialize the function registry with debug logger
   * @param {Object} debugLogger - Debug logger instance
   * @returns {FunctionRegistry} - Initialized function registry
   */
  initialize(debugLogger) {
    try {
      if (!this.functionRegistry) {
        this.functionRegistry = new FunctionRegistry(debugLogger || this.logger);
        this.logInfo('Function registry initialized successfully');
        return this.functionRegistry;
      }
      return this.functionRegistry;
    } catch (error) {
      this.logError('Failed to initialize function registry:', error);
      throw error;
    }
  }

  /**
   * Set up function registry with module registry
   * @param {Object} moduleRegistry - Registry of loaded modules
   * @returns {Promise<boolean>} - Success status
   */
  async setupWithModules(moduleRegistry) {
    try {
      if (!this.functionRegistry) {
        throw new Error('Function registry not initialized');
      }

      this.logInfo('Setting up function registry with modules...');
      
      // Set module registry
      this.functionRegistry.setModuleRegistry(moduleRegistry);
      
      // Register all functions from modules
      await this.functionRegistry.registerAllFunctions();
      
      this.logInfo('Function registry setup completed');
      return true;
    } catch (error) {
      this.logError('Failed to setup function registry with modules:', error);
      return false;
    }
  }

  /**
   * Validate that critical functions are available
   * @returns {boolean} - Validation status
   */
  validateFunctions() {
    try {
      if (!this.functionRegistry) {
        this.logWarn('Function registry not initialized for validation');
        return false;
      }

      const isValid = this.functionRegistry.validateFunctions();
      
      if (!isValid) {
        this.logWarn('Some critical functions are missing, but continuing...');
      } else {
        this.logInfo('All critical functions validated successfully');
      }
      
      return isValid;
    } catch (error) {
      this.logError('Error validating functions:', error);
      return false;
    }
  }

  /**
   * Get function registry statistics
   * @returns {Object} - Registry statistics
   */
  getStats() {
    try {
      if (!this.functionRegistry) {
        return { error: 'Function registry not initialized' };
      }

      const stats = this.functionRegistry.getStats();
      this.logInfo('Function Registry Statistics', stats);
      return stats;
    } catch (error) {
      this.logError('Error getting function registry stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Get the function registry instance
   * @returns {FunctionRegistry|null} - Function registry instance
   */
  getFunctionRegistry() {
    return this.functionRegistry;
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logInfo(message, context) {
    if (typeof this.logger?.info === 'function') {
      this.logger.info(message, context);
    } else if (typeof window?.logInfo === 'function') {
      window.logInfo(message, context);
    }
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logError(message, context) {
    if (typeof this.logger?.error === 'function') {
      this.logger.error(message, context);
    } else if (typeof window?.logError === 'function') {
      window.logError(message, context);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logWarn(message, context) {
    if (typeof this.logger?.warn === 'function') {
      this.logger.warn(message, context);
    } else if (typeof window?.logWarn === 'function') {
      window.logWarn(message, context);
    }
  }
}

// Export default instance
export default FunctionRegistrySetup;
