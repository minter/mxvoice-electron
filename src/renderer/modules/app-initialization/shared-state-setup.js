// Shared State Setup Module
// Extracted from renderer.js lines 117-180 for app-initialization module

/**
 * Shared State Setup class for initializing application shared state
 * Handles shared state module loading, default value setup, and global availability
 */
export class SharedStateSetup {
  constructor(debugLoggerSetup = null) {
    this.sharedStateInstance = null;
    this.sharedStateInitialized = false;
    this.debugLoggerSetup = debugLoggerSetup;
  }

  /**
   * Helper function to get shared state with fallback
   * @returns {Object} Shared state instance or fallback
   */
  getSharedState() {
    if (this.sharedStateInstance && this.sharedStateInitialized) {
      return this.sharedStateInstance;
    }
    
    // Fallback: create a minimal shared state if not initialized
    this.logWarn('Shared state not initialized, using fallback');
    return {
      get: (key) => {
        this.logWarn(`Shared state fallback get(${key})`);
        return null;
      },
      set: (key, value) => {
        this.logWarn(`Shared state fallback set(${key}, ${value})`);
      },
      subscribe: (key, callback) => {
        this.logWarn(`Shared state fallback subscribe(${key})`);
        return () => {};
      }
    };
  }

  /**
   * Function to check shared state health
   * @returns {Object} Health status object
   */
  checkSharedStateHealth() {
    const health = {
      initialized: this.sharedStateInitialized,
      instance: !!this.sharedStateInstance,
      windowSharedState: !!window.sharedState,
      windowGetSharedState: !!window.getSharedState
    };
    
    this.logDebug('Shared State Health Check', health);
    return health;
  }

  /**
   * Initialize shared state with proper error handling and state management
   * @returns {Promise<boolean>} Success status
   */
  async initializeSharedState() {
    try {
      if (this.debugLoggerSetup && this.debugLoggerSetup.getDebugLogger()) {
        this.debugLoggerSetup.getDebugLogger().info('Initializing shared state...');
      } else {
        console.log('🔧 Initializing shared state...');
      }
      
      const sharedStateModule = await import('../shared-state.js');
      this.sharedStateInstance = sharedStateModule.default;
      
      // Initialize shared state with default values
      this.sharedStateInstance.set('sound', null);
      this.sharedStateInstance.set('globalAnimation', null);
      
      // Don't create WaveSurfer immediately since the element is hidden
      // It will be created when the waveform is first shown
      this.sharedStateInstance.set('wavesurfer', null);
      
      // Add a method to create WaveSurfer when needed
      this.sharedStateInstance.set('createWaveSurfer', () => {
        const waveformElement = document.getElementById('waveform');
        if (waveformElement && typeof WaveSurfer !== 'undefined' && !this.sharedStateInstance.get('wavesurfer')) {
          this.logInfo('Creating WaveSurfer instance...');
          const wavesurfer = WaveSurfer.create({
            container: "#waveform",
            waveColor: "#e9ecef",
            backgroundColor: "#343a40",
            progressColor: "#007bff",
            cursorColor: "white",
            cursorWidth: 0,
            responsive: true,
            height: 100,
          });
          this.sharedStateInstance.set('wavesurfer', wavesurfer);
          return wavesurfer;
        }
        return this.sharedStateInstance.get('wavesurfer');
      });
      
      this.sharedStateInstance.set('autoplay', false);
      this.sharedStateInstance.set('loop', false);
      this.sharedStateInstance.set('holdingTankMode', "storage"); // 'storage' or 'playlist'
      this.sharedStateInstance.set('fontSize', 11);
      this.sharedStateInstance.set('categories', {}); // Changed from [] to {} for proper category lookup
      this.sharedStateInstance.set('searchTimeout', null);
      
      // Make searchTimeout available globally for backward compatibility
      window.searchTimeout = null;
      
      // Make shared state available globally for modules
      window.sharedState = this.sharedStateInstance;
      window.getSharedState = this.getSharedState.bind(this);
      window.checkSharedStateHealth = this.checkSharedStateHealth.bind(this);
      
      this.sharedStateInitialized = true;
      this.logInfo('Shared state initialized with default values');
      return true;
    } catch (error) {
      this.logError('Failed to initialize shared state', error);
      this.sharedStateInitialized = false;
      return false;
    }
  }

  /**
   * Get the current shared state instance
   * @returns {Object} Shared state instance
   */
  getSharedStateInstance() {
    return this.sharedStateInstance;
  }

  /**
   * Check if shared state is initialized
   * @returns {boolean} Initialization status
   */
  isInitialized() {
    return this.sharedStateInitialized;
  }

  // Logging helper methods that use debug logger setup if available
  logInfo(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logInfo(message, context);
    } else {
      console.log(`ℹ️ ${message}`, context);
    }
  }

  logDebug(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logDebug(message, context);
    } else {
      console.log(`🐛 ${message}`, context);
    }
  }

  logWarn(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logWarn(message, context);
    } else {
      console.warn(`⚠️ ${message}`, context);
    }
  }

  logError(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logError(message, context);
    } else {
      console.error(`❌ ${message}`, context);
    }
  }
}

// Export default instance for immediate use
export { SharedStateSetup as default };
