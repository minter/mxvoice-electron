/**
 * Module Verification Module
 * 
 * This module handles verification of critical functions and module health checking.
 * It provides validation and monitoring capabilities for the modular system.
 * 
 * Extracted from renderer.js as part of Phase 4 modularization.
 */

/**
 * ModuleVerification class handles module and function verification
 */
export class ModuleVerification {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.logger = dependencies.debugLog || console;
    this.criticalFunctions = [
      'playSongFromId',
      'stopPlaying', 
      'pausePlaying',
      'searchData',
      'populateCategorySelect'
    ];
  }

  /**
   * Verify that critical functions are available in the global scope
   * @returns {boolean} - Verification status
   */
  verifyCriticalFunctions() {
    try {
      const missingFunctions = this.criticalFunctions.filter(func => !window[func]);
      
      if (missingFunctions.length > 0) {
        this.logWarn('Missing critical functions', missingFunctions);
        this.logWarn('This may cause runtime errors');
        return false;
      } else {
        this.logInfo('All critical functions are available');
        return true;
      }
    } catch (error) {
      this.logError('Error verifying critical functions:', error);
      return false;
    }
  }

  /**
   * Verify module health by checking module registry
   * @param {Object} moduleRegistry - Registry of loaded modules
   * @returns {Object} - Verification results
   */
  verifyModuleHealth(moduleRegistry) {
    try {
      const results = {
        totalModules: 0,
        healthyModules: 0,
        unhealthyModules: [],
        criticalModules: [],
        moduleStatus: {}
      };

      if (!moduleRegistry || typeof moduleRegistry !== 'object') {
        this.logError('Invalid module registry provided for verification');
        return { ...results, error: 'Invalid module registry' };
      }

      const expectedModules = [
        'fileOperations',
        'songManagement', 
        'holdingTank',
        'hotkeys',
        'categories',
        'bulkOperations',
        'dragDrop',
        'navigation',
        'modeManagement',
        'testUtils',
        'search',
        'audio',
        'ui',
        'preferences',
        'database',
        'utils'
      ];

      results.totalModules = expectedModules.length;

      expectedModules.forEach(moduleName => {
        const moduleExists = !!moduleRegistry[moduleName];
        results.moduleStatus[moduleName] = moduleExists;
        
        if (moduleExists) {
          results.healthyModules++;
        } else {
          results.unhealthyModules.push(moduleName);
        }

        // Check critical modules
        const criticalModules = ['audio', 'database', 'search', 'ui'];
        if (criticalModules.includes(moduleName) && !moduleExists) {
          results.criticalModules.push(moduleName);
        }
      });

      // Log results
      this.logInfo('Module Health Verification Results:', {
        healthy: results.healthyModules,
        total: results.totalModules,
        unhealthy: results.unhealthyModules.length,
        critical: results.criticalModules.length
      });

      if (results.unhealthyModules.length > 0) {
        this.logWarn('Unhealthy modules detected:', results.unhealthyModules);
      }

      if (results.criticalModules.length > 0) {
        this.logError('Critical modules missing:', results.criticalModules);
      }

      return results;
    } catch (error) {
      this.logError('Error verifying module health:', error);
      return { error: error.message };
    }
  }

  /**
   * Perform comprehensive verification of the modular system
   * @param {Object} moduleRegistry - Registry of loaded modules
   * @param {FunctionRegistry} functionRegistry - Function registry instance
   * @returns {Object} - Comprehensive verification results
   */
  performComprehensiveVerification(moduleRegistry, functionRegistry) {
    try {
      this.logInfo('Starting comprehensive verification...');

      const results = {
        timestamp: new Date().toISOString(),
        criticalFunctions: this.verifyCriticalFunctions(),
        moduleHealth: this.verifyModuleHealth(moduleRegistry),
        functionRegistry: null,
        overall: false
      };

      // Verify function registry if provided
      if (functionRegistry && typeof functionRegistry.validateFunctions === 'function') {
        results.functionRegistry = functionRegistry.validateFunctions();
      }

      // Determine overall health
      results.overall = results.criticalFunctions && 
                       results.moduleHealth.unhealthyModules.length === 0 &&
                       results.moduleHealth.criticalModules.length === 0 &&
                       (results.functionRegistry !== false);

      this.logInfo('Comprehensive verification completed:', {
        overall: results.overall,
        criticalFunctions: results.criticalFunctions,
        healthyModules: results.moduleHealth.healthyModules,
        totalModules: results.moduleHealth.totalModules
      });

      return results;
    } catch (error) {
      this.logError('Error performing comprehensive verification:', error);
      return { error: error.message, overall: false };
    }
  }

  /**
   * Get list of critical functions that should be verified
   * @returns {Array} - Array of critical function names
   */
  getCriticalFunctions() {
    return [...this.criticalFunctions];
  }

  /**
   * Add additional critical functions to monitor
   * @param {Array|string} functions - Function name(s) to add
   */
  addCriticalFunctions(functions) {
    try {
      const functionsToAdd = Array.isArray(functions) ? functions : [functions];
      functionsToAdd.forEach(func => {
        if (typeof func === 'string' && !this.criticalFunctions.includes(func)) {
          this.criticalFunctions.push(func);
        }
      });
      this.logInfo('Added critical functions:', functionsToAdd);
    } catch (error) {
      this.logError('Error adding critical functions:', error);
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
export default ModuleVerification;
