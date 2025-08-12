// Environment Setup Module
// Part of app-initialization module for general environment configuration

/**
 * Environment Setup class for configuring the application environment
 * Handles environment variables, configuration, and system setup
 */
export class EnvironmentSetup {
  constructor(debugLoggerSetup = null) {
    this.debugLoggerSetup = debugLoggerSetup;
    this.environmentConfig = {};
  }

  /**
   * Initialize the application environment
   * @param {Object} config - Environment configuration options
   * @returns {Promise<boolean>} Success status
   */
  async initializeEnvironment(config = {}) {
    try {
      this.logInfo('Initializing application environment...');
      
      // Set up default configuration
      this.environmentConfig = {
        // Default configuration values
        logLevel: config.logLevel || 'info',
        debugMode: config.debugMode || false,
        performanceMonitoring: config.performanceMonitoring || true,
        errorReporting: config.errorReporting || true,
        ...config
      };
      
      // Set up global error handlers
      this.setupErrorHandlers();
      
      // Set up performance monitoring if enabled
      if (this.environmentConfig.performanceMonitoring) {
        this.setupPerformanceMonitoring();
      }
      
      // Set up console enhancements
      this.setupConsoleEnhancements();
      
      this.logInfo('Application environment initialized successfully');
      return true;
    } catch (error) {
      this.logError('Error initializing environment', error);
      return false;
    }
  }

  /**
   * Set up global error handlers for better error reporting
   * @returns {void}
   */
  setupErrorHandlers() {
    // Global error handler for unhandled errors
    window.addEventListener('error', (event) => {
      this.logError('Global error caught', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    // Global handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled promise rejection', {
        reason: event.reason,
        promise: event.promise
      });
    });

    this.logInfo('Global error handlers set up');
  }

  /**
   * Set up performance monitoring
   * @returns {void}
   */
  setupPerformanceMonitoring() {
    if (typeof performance !== 'undefined' && performance.mark) {
      // Mark the start of application initialization
      performance.mark('app-init-start');
      
      // Set up a performance observer if available
      if (typeof PerformanceObserver !== 'undefined') {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name.startsWith('app-')) {
                this.logDebug('Performance metric', {
                  name: entry.name,
                  duration: entry.duration,
                  startTime: entry.startTime
                });
              }
            }
          });
          observer.observe({ entryTypes: ['measure', 'mark'] });
          this.logInfo('Performance monitoring set up');
        } catch (error) {
          this.logWarn('Failed to set up performance observer', error);
        }
      }
    }
  }

  /**
   * Set up console enhancements for better debugging
   * @returns {void}
   */
  setupConsoleEnhancements() {
    // Store original console methods
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    // Only enhance if debug mode is enabled AND global debug logger shim is not present
    // This prevents double-prefixing logs (debug logger already formats console output)
    const hasGlobalDebugShim = typeof window !== 'undefined' && !!window.logInfo;
    if (this.environmentConfig.debugMode && !hasGlobalDebugShim) {
      // Add timestamps to console output
      const addTimestamp = (originalMethod, prefix) => {
        return function(...args) {
          const timestamp = new Date().toISOString();
          originalMethod.call(console, `[${timestamp}] ${prefix}`, ...args);
        };
      };

      console.log = addTimestamp(originalConsole.log, '🔧');
      console.info = addTimestamp(originalConsole.info, 'ℹ️');
      console.warn = addTimestamp(originalConsole.warn, '⚠️');
      console.error = addTimestamp(originalConsole.error, '❌');

      this.logInfo('Console enhancements enabled');
    }

    // Store original methods for restoration if needed
    window._originalConsole = originalConsole;
  }

  /**
   * Check system capabilities and requirements
   * @returns {Object} System capability information
   */
  checkSystemCapabilities() {
    const capabilities = {
      // Basic feature detection
      localStorage: typeof localStorage !== 'undefined',
      sessionStorage: typeof sessionStorage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      webWorkers: typeof Worker !== 'undefined',
      serviceWorkers: 'serviceWorker' in navigator,
      webGL: this.checkWebGLSupport(),
      webAudio: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
      
      // Performance API
      performance: typeof performance !== 'undefined',
      performanceObserver: typeof PerformanceObserver !== 'undefined',
      
      // Modern JavaScript features
      asyncAwait: this.checkAsyncAwaitSupport(),
      modules: this.checkModuleSupport(),
      
      // Electron specific
      electronAPI: typeof window.electronAPI !== 'undefined'
    };

    this.logInfo('System capabilities checked', capabilities);
    return capabilities;
  }

  /**
   * Check WebGL support
   * @returns {boolean} WebGL support status
   */
  checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Check async/await support
   * @returns {boolean} Async/await support status
   */
  checkAsyncAwaitSupport() {
    try {
      return (async () => {})().constructor.name === 'AsyncFunction';
    } catch (e) {
      return false;
    }
  }

  /**
   * Check ES6 module support
   * @returns {boolean} Module support status
   */
  checkModuleSupport() {
    try {
      // Check if we're in a module context by trying to use import.meta
      return typeof import.meta !== 'undefined';
    } catch (e) {
      return false;
    }
  }

  /**
   * Get current environment configuration
   * @returns {Object} Environment configuration
   */
  getEnvironmentConfig() {
    return { ...this.environmentConfig };
  }

  /**
   * Update environment configuration
   * @param {Object} newConfig - New configuration values
   * @returns {void}
   */
  updateEnvironmentConfig(newConfig) {
    this.environmentConfig = { ...this.environmentConfig, ...newConfig };
    this.logInfo('Environment configuration updated', newConfig);
  }

  // Logging helper methods that use debug logger setup if available
  logInfo(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logInfo(message, context);
    } else if (typeof window?.logInfo === 'function') {
      window.logInfo(message, context);
    }
  }

  logDebug(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logDebug(message, context);
    } else if (typeof window?.logDebug === 'function') {
      window.logDebug(message, context);
    }
  }

  logWarn(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logWarn(message, context);
    } else if (typeof window?.logWarn === 'function') {
      window.logWarn(message, context);
    }
  }

  logError(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logError(message, context);
    } else if (typeof window?.logError === 'function') {
      window.logError(message, context);
    }
  }
}

// Export default instance for immediate use
export { EnvironmentSetup as default };
