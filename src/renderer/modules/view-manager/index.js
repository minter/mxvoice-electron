/**
 * View Manager Module
 * 
 * Manages switching between Traditional View and Soundboard View.
 * Preserves state when switching views and persists view preference per profile.
 */

let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

let electronAPI = null;
let profileStateModule = null;

/**
 * View Manager Class
 */
class ViewManager {
  constructor(options = {}) {
    this.electronAPI = options.electronAPI || null;
    this.currentView = 'traditional'; // 'traditional' | 'soundboard'
    this.traditionalViewState = null;
    this.soundboardViewState = null;
    
    // Get electronAPI from window if not provided
    if (!this.electronAPI && typeof window !== 'undefined' && window.secureElectronAPI) {
      this.electronAPI = window.secureElectronAPI;
    }
  }

  /**
   * Initialize the view manager
   */
  async init() {
    debugLog?.info('Initializing view manager', {
      module: 'view-manager',
      function: 'init'
    });

    // Get electronAPI from window if not provided
    if (!this.electronAPI && window.secureElectronAPI) {
      this.electronAPI = window.secureElectronAPI;
    }

    // Load saved view preference from profile state
    await this.loadViewPreference();

    // Set up IPC listener for view toggle using secure API events
    if (window.secureElectronAPI?.events?.onViewToggleSoundboardMode) {
      debugLog?.info('Setting up view toggle listener via secure API', {
        module: 'view-manager',
        function: 'init'
      });
      window.secureElectronAPI.events.onViewToggleSoundboardMode(() => {
        debugLog?.info('View toggle event received', {
          module: 'view-manager',
          function: 'init',
          currentView: this.currentView
        });
        this.toggleView();
      });
    } else if (this.electronAPI?.ipcRenderer) {
      debugLog?.info('Setting up view toggle listener via ipcRenderer fallback', {
        module: 'view-manager',
        function: 'init'
      });
      // Fallback to direct ipcRenderer if secure API not available
      this.electronAPI.ipcRenderer.on('view:toggle-soundboard-mode', () => {
        debugLog?.info('View toggle event received (fallback)', {
          module: 'view-manager',
          function: 'init',
          currentView: this.currentView
        });
        this.toggleView();
      });
    } else {
      debugLog?.warn('No IPC API available for view toggle listener', {
        module: 'view-manager',
        function: 'init',
        hasSecureAPI: !!window.secureElectronAPI?.events,
        hasElectronAPI: !!this.electronAPI
      });
    }
  }

  /**
   * Reinitialize with dependencies
   */
  async reinitializeViewManager(deps) {
    if (deps.electronAPI) {
      this.electronAPI = deps.electronAPI;
    }
    if (deps.profileState) {
      profileStateModule = deps.profileState;
    }
    if (deps.debugLog) {
      debugLog = deps.debugLog;
    }
  }

  /**
   * Get current view mode
   * @returns {string} 'traditional' | 'soundboard'
   */
  getCurrentView() {
    return this.currentView;
  }

  /**
   * Switch to traditional view
   */
  async switchToTraditionalView() {
    debugLog?.info('Switching to traditional view', {
      module: 'view-manager',
      function: 'switchToTraditionalView'
    });

    // Save current soundboard state if we're switching from soundboard
    if (this.currentView === 'soundboard') {
      await this.saveSoundboardViewState();
    }

    // Hide soundboard view, show traditional view
    const soundboardView = document.getElementById('soundboard-view');
    const traditionalView = document.getElementById('traditional-view');

    if (soundboardView) {
      soundboardView.style.display = 'none';
    }
    if (traditionalView) {
      traditionalView.style.display = 'flex';
    }

    this.currentView = 'traditional';

    // Restore traditional view state if available
    if (this.traditionalViewState) {
      await this.restoreTraditionalViewState();
    }

    // Save view preference
    await this.saveViewPreference();

    // Update menu state
    this.updateMenuState();
    
    debugLog?.info('Switched to traditional view', {
      module: 'view-manager',
      function: 'switchToTraditionalView'
    });
  }

  /**
   * Switch to soundboard view
   */
  async switchToSoundboardView() {
    debugLog?.info('Switching to soundboard view', {
      module: 'view-manager',
      function: 'switchToSoundboardView'
    });

    // Save current traditional view state if we're switching from traditional
    if (this.currentView === 'traditional') {
      await this.saveTraditionalViewState();
    }

    // Hide traditional view, show soundboard view
    const soundboardView = document.getElementById('soundboard-view');
    const traditionalView = document.getElementById('traditional-view');

    if (traditionalView) {
      traditionalView.style.display = 'none';
    }
    if (soundboardView) {
      soundboardView.style.display = 'flex';
    }

    this.currentView = 'soundboard';

    // Restore soundboard view state if available
    if (this.soundboardViewState) {
      await this.restoreSoundboardViewState();
    }

    // Save view preference
    await this.saveViewPreference();

    // Update menu state
    this.updateMenuState();

    // Initialize soundboard if needed
    if (window.moduleRegistry?.soundboard) {
      const soundboard = window.moduleRegistry.soundboard;
      if (typeof soundboard.initializeView === 'function') {
        await soundboard.initializeView();
      }
      // Also ensure grid is set up
      if (typeof soundboard.setupGrid === 'function') {
        soundboard.setupGrid();
      }
    }
    
    debugLog?.info('Switched to soundboard view', {
      module: 'view-manager',
      function: 'switchToSoundboardView'
    });
  }

  /**
   * Save traditional view state
   */
  async saveTraditionalViewState() {
    // Traditional view state is managed by profile-state module
    // We just need to ensure it's saved
    debugLog?.info('Saving traditional view state', {
      module: 'view-manager',
      function: 'saveTraditionalViewState'
    });
  }

  /**
   * Restore traditional view state
   */
  async restoreTraditionalViewState() {
    debugLog?.info('Restoring traditional view state', {
      module: 'view-manager',
      function: 'restoreTraditionalViewState'
    });
    // Traditional view state is restored by profile-state module
  }

  /**
   * Save soundboard view state
   */
  async saveSoundboardViewState() {
    debugLog?.info('Saving soundboard view state', {
      module: 'view-manager',
      function: 'saveSoundboardViewState'
    });
    
    if (window.moduleRegistry?.soundboard) {
      const soundboard = window.moduleRegistry.soundboard;
      if (typeof soundboard.saveState === 'function') {
        await soundboard.saveState();
      }
    }
  }

  /**
   * Restore soundboard view state
   */
  async restoreSoundboardViewState() {
    debugLog?.info('Restoring soundboard view state', {
      module: 'view-manager',
      function: 'restoreSoundboardViewState'
    });
    
    if (window.moduleRegistry?.soundboard) {
      const soundboard = window.moduleRegistry.soundboard;
      if (typeof soundboard.restoreState === 'function') {
        await soundboard.restoreState();
      }
    }
  }

  /**
   * Save view preference to profile state
   */
  async saveViewPreference() {
    if (!this.electronAPI?.store) {
      debugLog?.warn('Cannot save view preference: store not available', {
        module: 'view-manager',
        function: 'saveViewPreference'
      });
      return;
    }

    try {
      // View preference is saved as part of profile state
      // The profile-state module will handle persistence
      debugLog?.info('View preference saved', {
        module: 'view-manager',
        function: 'saveViewPreference',
        currentView: this.currentView
      });
    } catch (error) {
      debugLog?.error('Error saving view preference', {
        module: 'view-manager',
        function: 'saveViewPreference',
        error: error.message
      });
    }
  }

  /**
   * Load view preference from profile state
   */
  async loadViewPreference() {
    if (!this.electronAPI?.store) {
      debugLog?.warn('Cannot load view preference: store not available', {
        module: 'view-manager',
        function: 'loadViewPreference'
      });
      return;
    }

    try {
      // Default to traditional view
      this.currentView = 'traditional';
      
      // View preference will be loaded from profile state when profile is loaded
      debugLog?.info('View preference loaded', {
        module: 'view-manager',
        function: 'loadViewPreference',
        currentView: this.currentView
      });
    } catch (error) {
      debugLog?.error('Error loading view preference', {
        module: 'view-manager',
        function: 'loadViewPreference',
        error: error.message
      });
    }
  }

  /**
   * Update menu state to reflect current view
   */
  updateMenuState() {
    // Send IPC message to main process to update menu
    if (this.electronAPI?.ipcRenderer) {
      this.electronAPI.ipcRenderer.send('view:update-menu-state', this.currentView);
    }
  }

  /**
   * Toggle between views
   */
  async toggleView() {
    if (this.currentView === 'traditional') {
      await this.switchToSoundboardView();
    } else {
      await this.switchToTraditionalView();
    }
  }
}

// Create singleton instance
const viewManager = new ViewManager();

// Export singleton as default and named export
export default viewManager;
export { viewManager };

