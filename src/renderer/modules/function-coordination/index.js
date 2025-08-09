/**
 * Function Coordination Module
 * 
 * This module provides centralized coordination of function registry, event manager,
 * function monitor, and module verification systems. It extracts and consolidates
 * the coordination logic that was previously scattered in renderer.js.
 * 
 * Extracted from renderer.js as part of Phase 4 modularization.
 * 
 * @module FunctionCoordination
 */

import { FunctionRegistrySetup } from './function-registry-setup.js';
import { EventManagerSetup } from './event-manager-setup.js';
import { FunctionMonitorSetup } from './function-monitor-setup.js';
import { ModuleVerification } from './module-verification.js';

/**
 * FunctionCoordination class coordinates all function-related systems
 */
export class FunctionCoordination {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.logger = dependencies.debugLog || console;
    
    // Initialize component setups
    this.functionRegistrySetup = new FunctionRegistrySetup(dependencies);
    this.eventManagerSetup = new EventManagerSetup(dependencies);
    this.functionMonitorSetup = new FunctionMonitorSetup(dependencies);
    this.moduleVerification = new ModuleVerification(dependencies);
    
    // Component instances
    this.functionRegistry = null;
    this.eventManager = null;
    this.functionMonitor = null;
    
    // Initialization state
    this.isInitialized = false;
  }

  /**
   * Initialize all function coordination components
   * @param {Object} debugLogger - Debug logger instance
   * @param {Object} moduleRegistry - Registry of loaded modules
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(debugLogger, moduleRegistry) {
    try {
      this.logInfo('Starting function coordination initialization...');

      // Step 1: Initialize function registry
      this.logInfo('Initializing function registry...');
      this.functionRegistry = this.functionRegistrySetup.initialize(debugLogger);
      
      if (!this.functionRegistry) {
        throw new Error('Failed to initialize function registry');
      }

      // Step 2: Set up function registry with modules
      this.logInfo('Setting up function registry with modules...');
      const registrySetupSuccess = await this.functionRegistrySetup.setupWithModules(moduleRegistry);
      
      if (!registrySetupSuccess) {
        throw new Error('Failed to setup function registry with modules');
      }

      // Step 3: Validate functions
      this.logInfo('Validating functions...');
      const functionsValid = this.functionRegistrySetup.validateFunctions();
      
      if (!functionsValid) {
        this.logWarn('Some functions failed validation, but continuing...');
      }

      // Step 4: Initialize event manager
      this.logInfo('Initializing event manager...');
      this.eventManager = this.eventManagerSetup.initialize(this.functionRegistry, debugLogger);
      
      if (!this.eventManager) {
        throw new Error('Failed to initialize event manager');
      }

      // Step 5: Set up event manager
      this.logInfo('Setting up event manager...');
      const eventSetupSuccess = await this.eventManagerSetup.setup();
      
      if (!eventSetupSuccess) {
        throw new Error('Failed to setup event manager');
      }

      // Step 6: Initialize function monitor
      this.logInfo('Initializing function monitor...');
      this.functionMonitor = this.functionMonitorSetup.initialize(this.functionRegistry, debugLogger);
      
      if (!this.functionMonitor) {
        throw new Error('Failed to initialize function monitor');
      }

      // Step 7: Start monitoring
      this.logInfo('Starting function monitor...');
      const monitorStarted = this.functionMonitorSetup.startMonitoring();
      
      if (!monitorStarted) {
        this.logWarn('Failed to start function monitor, but continuing...');
      }

      // Step 8: Perform comprehensive verification
      this.logInfo('Performing comprehensive verification...');
      const verificationResults = this.moduleVerification.performComprehensiveVerification(
        moduleRegistry, 
        this.functionRegistry
      );

      this.logInfo('Function coordination initialization completed', {
        verificationPassed: verificationResults.overall,
        functionsValid,
        eventSetupSuccess,
        monitorStarted
      });

      this.isInitialized = true;
      return true;

    } catch (error) {
      this.logError('Failed to initialize function coordination:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Get comprehensive statistics from all components
   * @returns {Object} - Combined statistics
   */
  getComprehensiveStats() {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        initialized: this.isInitialized,
        functionRegistry: this.functionRegistrySetup.getStats(),
        eventManager: this.eventManagerSetup.getStats(),
        functionMonitor: this.functionMonitorSetup.getStats()
      };

      this.logInfo('Function Coordination Comprehensive Statistics', stats);
      return stats;
    } catch (error) {
      this.logError('Error getting comprehensive stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Perform health check on all coordination components
   * @param {Object} moduleRegistry - Registry of loaded modules
   * @returns {Object} - Health check results
   */
  performHealthCheck(moduleRegistry) {
    try {
      const healthCheck = {
        timestamp: new Date().toISOString(),
        overall: true,
        components: {
          functionRegistry: !!this.functionRegistry,
          eventManager: !!this.eventManager,
          functionMonitor: !!this.functionMonitor
        },
        verification: null
      };

      // Perform module verification
      if (moduleRegistry) {
        healthCheck.verification = this.moduleVerification.performComprehensiveVerification(
          moduleRegistry, 
          this.functionRegistry
        );
        healthCheck.overall = healthCheck.overall && healthCheck.verification.overall;
      }

      // Check component health
      Object.values(healthCheck.components).forEach(status => {
        healthCheck.overall = healthCheck.overall && status;
      });

      this.logInfo('Function Coordination Health Check', healthCheck);
      return healthCheck;
    } catch (error) {
      this.logError('Error performing health check:', error);
      return { error: error.message, overall: false };
    }
  }

  /**
   * Get individual component instances
   * @returns {Object} - Component instances
   */
  getComponents() {
    return {
      functionRegistry: this.functionRegistry,
      eventManager: this.eventManager,
      functionMonitor: this.functionMonitor,
      moduleVerification: this.moduleVerification
    };
  }

  /**
   * Cleanup all coordination components
   * @returns {boolean} - Success status
   */
  cleanup() {
    try {
      this.logInfo('Cleaning up function coordination components...');
      
      // Cleanup function monitor
      if (this.functionMonitorSetup) {
        this.functionMonitorSetup.cleanup();
      }
      
      // Cleanup event manager
      if (this.eventManagerSetup) {
        this.eventManagerSetup.cleanup();
      }
      
      this.isInitialized = false;
      this.logInfo('Function coordination cleanup completed');
      return true;
    } catch (error) {
      this.logError('Error cleaning up function coordination:', error);
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

// Export both named and default exports for compatibility
export { FunctionRegistrySetup, EventManagerSetup, FunctionMonitorSetup, ModuleVerification };
export default FunctionCoordination;
