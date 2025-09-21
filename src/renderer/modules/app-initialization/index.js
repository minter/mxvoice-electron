// App Initialization Module - Main Coordinator
// Orchestrates the complete application initialization process

import DebugLoggerSetup from './debug-logger-setup.js';
import SharedStateSetup from './shared-state-setup.js';
import DataPreloader from './data-preloader.js';
import EnvironmentSetup from './environment-setup.js';

/**
 * AppInitialization class - Main coordinator for application initialization
 * Orchestrates debug logging, shared state, data preloading, and environment setup
 */
export class AppInitialization {
  constructor() {
    this.debugLoggerSetup = null;
    this.sharedStateSetup = null;
    this.dataPreloader = null;
    this.environmentSetup = null;
    this.initialized = false;
    this.initializationSteps = [];
  }

  /**
   * Initialize the complete application initialization process
   * @param {Object} config - Initialization configuration
   * @returns {Promise<boolean>} Success status
   */
  async initialize(config = {}) {
    try {
      // Step 1: Initialize debug logger
      await this.initializeDebugLogger(config.debug || {});
      
      this.logInfo('🚀 Starting application initialization...');
      
      // Step 2: Initialize environment
      await this.initializeEnvironment(config.environment || {});
      
      // Step 3: Initialize shared state  
      await this.initializeSharedState(config.sharedState || {});
      
      // Step 4: Preload initial data
      await this.preloadInitialData(config.dataLoader || {});
      
      // Step 5: Handle profile selection if needed
      await this.handleProfileSelection(config.profileManagement || {});
      
      // Step 6: Initialize profile indicator
      await this.initializeProfileIndicator(config.profileManagement || {});
      
      this.initialized = true;
      this.logInfo('✅ Application initialization completed successfully');
      
      // Mark performance milestone
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('app-init-complete');
        if (performance.measure) {
          performance.measure('app-init-duration', 'app-init-start', 'app-init-complete');
        }
      }
      
      return true;
    } catch (error) {
      this.logError('❌ Application initialization failed:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Initialize debug logger setup
   * @param {Object} config - Debug logger configuration
   * @returns {Promise<boolean>} Success status
   */
  async initializeDebugLogger(config = {}) {
    try {
      this.debugLoggerSetup = new DebugLoggerSetup();
      
      const context = {
        electronAPI: config.electronAPI || window.electronAPI
      };
      
      await this.debugLoggerSetup.initializeDebugLoggerInstance(context);
      
      // Create global logging functions for backward compatibility
      this.debugLoggerSetup.createGlobalLoggers();
      
      this.addInitializationStep('Debug Logger', true);
      this.logInfo('🔧 Initializing debug logger...');
      this.logInfo('Debug logger initialization completed');
      return true;
    } catch (error) {
      // At this point debugLoggerSetup exists but may have fallback logger
      this.logError('Failed to initialize debug logger:', error);
      this.addInitializationStep('Debug Logger', false, error.message);
      return false;
    }
  }

  /**
   * Initialize environment setup
   * @param {Object} config - Environment configuration
   * @returns {Promise<boolean>} Success status
   */
  async initializeEnvironment(config = {}) {
    try {
      this.logInfo('🌍 Initializing environment...');
      
      this.environmentSetup = new EnvironmentSetup(this.debugLoggerSetup);
      const success = await this.environmentSetup.initializeEnvironment(config);
      
      if (success) {
        // Check system capabilities
        const capabilities = this.environmentSetup.checkSystemCapabilities();
        this.logInfo('System capabilities assessed', capabilities);
        
        this.addInitializationStep('Environment Setup', true);
        this.logInfo('Environment initialization completed');
        return true;
      } else {
        throw new Error('Environment setup failed');
      }
    } catch (error) {
      this.logError('Failed to initialize environment:', error);
      this.addInitializationStep('Environment Setup', false, error.message);
      return false;
    }
  }

  /**
   * Initialize shared state
   * @param {Object} config - Shared state configuration
   * @returns {Promise<boolean>} Success status
   */
  async initializeSharedState(config = {}) {
    try {
      this.logInfo('🔗 Initializing shared state...');
      
      this.sharedStateSetup = new SharedStateSetup(this.debugLoggerSetup);
      const success = await this.sharedStateSetup.initializeSharedState();
      
      if (success) {
        this.addInitializationStep('Shared State', true);
        this.logInfo('Shared state initialization completed');
        return true;
      } else {
        throw new Error('Shared state initialization failed');
      }
    } catch (error) {
      this.logError('Failed to initialize shared state:', error);
      this.addInitializationStep('Shared State', false, error.message);
      return false;
    }
  }

  /**
   * Preload initial data
   * @param {Object} config - Data preloader configuration
   * @returns {Promise<boolean>} Success status
   */
  async preloadInitialData(config = {}) {
    try {
      this.logInfo('📁 Preloading initial data...');
      
      this.dataPreloader = new DataPreloader(this.debugLoggerSetup);
      const success = await this.dataPreloader.loadInitialData();
      
      if (success) {
        this.addInitializationStep('Data Preloader', true);
        this.logInfo('Data preloading completed');
        return true;
      } else {
        throw new Error('Data preloading failed');
      }
    } catch (error) {
      this.logError('Failed to preload initial data:', error);
      this.addInitializationStep('Data Preloader', false, error.message);
      return false;
    }
  }

  /**
   * Initialize DOM-dependent functionality when DOM is ready
   * This should be called after DOM is fully loaded
   * @returns {Promise<boolean>} Success status
   */
  async initializeDOMDependentFeatures() {
    try {
      this.logInfo('🎨 Initializing DOM-dependent features...');
      
      if (this.dataPreloader) {
        this.logInfo('📁 Data preloader found, calling initializeDOMDependentData...');
        await this.dataPreloader.initializeDOMDependentData();
        this.logInfo('📁 Data preloader initialization completed');
      } else {
        this.logWarn('⚠️ Data preloader not found!');
      }
      
      this.addInitializationStep('DOM Features', true);
      this.logInfo('✅ DOM-dependent features initialized');
      return true;
    } catch (error) {
      this.logError('❌ Failed to initialize DOM-dependent features:', error);
      this.addInitializationStep('DOM Features', false, error.message);
      return false;
    }
  }

  /**
   * Handle profile selection if needed
   * @param {Object} config - Profile management configuration
   * @returns {Promise<boolean>} Success status
   */
  async handleProfileSelection(config = {}) {
    try {
      this.logInfo('👤 Checking profile selection requirements...');
      
      // Check if profile management is available
      if (!window.profileManagement) {
        this.logInfo('⚠️ Profile management not available, skipping profile selection');
        this.addInitializationStep('Profile Selection', true, 'Profile management not available');
        return true;
      }
      
      // Check if profile selection should be shown
      const shouldShow = await window.profileManagement.shouldShowProfileSelection();
      
      if (!shouldShow) {
        this.logInfo('✅ Profile selection not needed, continuing with app startup');
        this.addInitializationStep('Profile Selection', true, 'Not needed');
        return true;
      }
      
      this.logInfo('🎭 Showing profile selection modal...');
      
      // Show profile selection modal
      const selectedProfile = await window.profileManagement.showProfileSelectionModal({
        showCreateOption: true,
        showCancelOption: false,
        title: 'Select Your Profile'
      });
      
      if (selectedProfile) {
        this.logInfo(`✅ Profile selected: ${selectedProfile}`);
        
        // Update profile indicator
        window.profileManagement.updateProfileIndicator(selectedProfile);
        
        // Mark profile selection as shown
        await window.profileManagement.markProfileSelectionShown();
        
        this.addInitializationStep('Profile Selection', true);
        return true;
      } else {
        this.logInfo('⚠️ No profile selected, using default');
        this.addInitializationStep('Profile Selection', true, 'No selection made');
        return true;
      }
    } catch (error) {
      this.logError('Failed to handle profile selection', error);
      this.addInitializationStep('Profile Selection', false, error.message);
      return false;
    }
  }

  /**
   * Initialize profile indicator with current active profile
   * @param {Object} config - Profile management configuration
   * @returns {Promise<boolean>} Success status
   */
  async initializeProfileIndicator(config = {}) {
    try {
      this.logInfo('👤 Initializing profile indicator...');
      
      // Check if profile management is available
      if (!window.profileManagement) {
        this.logInfo('⚠️ Profile management not available, skipping profile indicator initialization');
        this.addInitializationStep('Profile Indicator', true, 'Profile management not available');
        return true;
      }
      
      // Get the current active profile
      const activeProfile = await window.profileManagement.getActiveProfile();
      
      if (activeProfile) {
        this.logInfo(`✅ Active profile: ${activeProfile.name}`);
        
        // Update profile indicator
        window.profileManagement.updateProfileIndicator(activeProfile.name);
        
        this.addInitializationStep('Profile Indicator', true);
        return true;
      } else {
        this.logInfo('⚠️ No active profile found, using default');
        window.profileManagement.updateProfileIndicator('Default User');
        this.addInitializationStep('Profile Indicator', true, 'Using default profile');
        return true;
      }
    } catch (error) {
      this.logError('Failed to initialize profile indicator', error);
      // Fallback to default profile
      if (window.profileManagement) {
        window.profileManagement.updateProfileIndicator('Default User');
      }
      this.addInitializationStep('Profile Indicator', true, 'Using fallback profile');
      return true; // Don't fail initialization for this
    }
  }

  /**
   * Get initialization status and diagnostics
   * @returns {Object} Initialization status information
   */
  getInitializationStatus() {
    return {
      initialized: this.initialized,
      steps: this.initializationSteps,
      debugLogger: !!this.debugLoggerSetup,
      sharedState: !!this.sharedStateSetup,
      dataPreloader: !!this.dataPreloader,
      environment: !!this.environmentSetup,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Add an initialization step to the tracking list
   * @param {string} stepName - Name of the initialization step
   * @param {boolean} success - Whether the step succeeded
   * @param {string} error - Error message if step failed
   */
  addInitializationStep(stepName, success, error = null) {
    this.initializationSteps.push({
      name: stepName,
      success,
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get shared state instance
   * @returns {Object} Shared state instance
   */
  getSharedState() {
    return this.sharedStateSetup ? this.sharedStateSetup.getSharedStateInstance() : null;
  }

  /**
   * Get debug logger instance
   * @returns {Object} Debug logger instance
   */
  getDebugLogger() {
    return this.debugLoggerSetup ? this.debugLoggerSetup.getDebugLogger() : null;
  }

  /**
   * Get environment configuration
   * @returns {Object} Environment configuration
   */
  getEnvironmentConfig() {
    return this.environmentSetup ? this.environmentSetup.getEnvironmentConfig() : {};
  }

  /**
   * Check if initialization is complete
   * @returns {boolean} Initialization status
   */
  isInitialized() {
    return this.initialized;
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

// Create and export default instance
const appInitialization = new AppInitialization();

// Export the instance as default
export default appInitialization;
