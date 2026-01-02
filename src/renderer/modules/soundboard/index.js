/**
 * Soundboard Module Index
 *
 * This module serves as the main entry point for all soundboard-related functionality
 * in the MxVoice Electron application.
 */

// Import debug logger
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

// Import soundboard sub-modules
import * as soundboardGrid from './soundboard-grid.js';
import * as soundboardData from './soundboard-data.js';
import * as soundboardUI from './soundboard-ui.js';
import * as soundboardEvents from './soundboard-events.js';
import * as soundboardSearchPanel from './soundboard-search-panel.js';

/**
 * Soundboard Module Class
 *
 * Provides comprehensive soundboard management functionality including:
 * - Grid layout and button management
 * - Drag & drop button assignment
 * - File import/export for soundboard configurations
 * - Tab management for multiple soundboard pages
 * - State persistence for soundboard state
 */
class SoundboardModule {
  constructor(options = {}) {
    this.electronAPI = options.electronAPI;
    this.db = null;
    this.store = null;

    // Initialize sub-modules
    this.grid = soundboardGrid;
    this.data = soundboardData;
    this.ui = soundboardUI;
    this.events = soundboardEvents;
    this.searchPanel = soundboardSearchPanel;

    // Check if sub-modules are properly loaded
    if (!soundboardGrid || !soundboardData || !soundboardUI || !soundboardEvents || !soundboardSearchPanel) {
      debugLog?.error('Soundboard sub-modules not properly loaded', {
        module: 'soundboard',
        function: 'constructor'
      });
      throw new Error('Soundboard sub-modules not properly loaded');
    }

    // Bind methods from sub-modules
    try {
      this.saveSoundboardToStore = soundboardData.saveSoundboardToStore.bind(this);
      this.loadSoundboardFromStore = soundboardData.loadSoundboardFromStore.bind(this);
      this.openSoundboardFile = soundboardData.openSoundboardFile.bind(this);
      this.saveSoundboardFile = soundboardData.saveSoundboardFile.bind(this);
      this.extractSoundboardTabs = soundboardData.extractSoundboardTabs.bind(this);
      this.restoreSoundboardTabs = soundboardData.restoreSoundboardTabs.bind(this);
      this.setLabelFromSongId = soundboardData.setLabelFromSongId.bind(this);
      this.clearSoundboard = soundboardData.clearSoundboard.bind(this);
      this.soundboardButtonDrop = soundboardUI.soundboardButtonDrop.bind(this);
      this.allowSoundboardButtonDrop = soundboardUI.allowSoundboardButtonDrop.bind(this);
      this.switchToSoundboardTab = soundboardUI.switchToSoundboardTab.bind(this);
      this.renameSoundboardTab = soundboardUI.renameSoundboardTab.bind(this);
      this.playSongFromButton = soundboardEvents.playSongFromButton.bind(this);
      // Note: setupEventListeners and handleKeyboardNavigation are now class methods, not bound
      this.initializeGrid = soundboardGrid.initializeGrid.bind(this);
      this.setupGrid = soundboardGrid.setupGrid.bind(this);
      this.updateGridLayout = soundboardGrid.updateGridLayout.bind(this);
      this.initializeSearchPanel = soundboardSearchPanel.initializeSearchPanel.bind(this);
      this.toggleSearchPanel = soundboardSearchPanel.toggleSearchPanel.bind(this);
    } catch (error) {
      debugLog?.error('Error binding soundboard functions', {
        module: 'soundboard',
        function: 'constructor',
        error: error.message
      });
      throw error;
    }

    // Initialize the module
    this.initSoundboard();
  }

  /**
   * Initialize soundboard module
   * Sets up initial state and loads saved soundboard
   */
  initSoundboard() {
    debugLog?.info('Initializing Soundboard Module', {
      module: 'soundboard',
      function: 'initSoundboard'
    });

    // Wait for DOM to be ready before setting up
    const setup = () => {
      this.setupSoundboard();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      // DOM already ready, but wait a bit for all elements to be available
      setTimeout(setup, 100);
    }
  }

  /**
   * Setup soundboard after DOM is ready
   */
  setupSoundboard() {
    // Check if soundboard view elements exist before initializing
    const soundboardView = document.getElementById('soundboard-view');
    if (!soundboardView) {
      debugLog?.warn('Soundboard view not found in DOM, deferring initialization', {
        module: 'soundboard',
        function: 'setupSoundboard'
      });
      // Retry after a short delay
      setTimeout(() => this.setupSoundboard(), 200);
      return;
    }

    // Initialize grid layout
    if (typeof this.initializeGrid === 'function') {
      this.initializeGrid();
    }

    // Initialize search panel
    if (typeof this.initializeSearchPanel === 'function') {
      this.initializeSearchPanel();
    }

    // Setup event listeners (using class method, not external function)
    this.setupEventListeners();

    // Load saved soundboard from store
    if (typeof this.loadSoundboardFromStore === 'function') {
      this.loadSoundboardFromStore();
    }

    debugLog?.info('Soundboard Module initialized', {
      module: 'soundboard',
      function: 'setupSoundboard'
    });
  }

  /**
   * Setup all event listeners for soundboard
   * Following the same pattern as HotkeysModule.setupEventListeners()
   */
  setupEventListeners() {
    debugLog?.info('Setting up soundboard event listeners', {
      module: 'soundboard',
      function: 'setupEventListeners'
    });

    // Event delegation for soundboard buttons (click, double-click, drag)
    const soundboardTabContent = document.getElementById('soundboard-tab-content');
    if (soundboardTabContent) {
      // Click to play
      soundboardTabContent.addEventListener('click', (event) => {
        const button = event.target.closest('.soundboard-button');
        if (button) {
          const songId = button.getAttribute('songid');
          if (songId) {
            debugLog?.info(`Soundboard button clicked: Playing song ID ${songId}`, {
              module: 'soundboard',
              function: 'setupEventListeners',
              songId
            });
            if (window.moduleRegistry?.audio?.playSongFromId) {
              window.moduleRegistry.audio.playSongFromId(songId);
            } else {
              debugLog?.warn('Audio module not available to play song', {
                module: 'soundboard',
                function: 'setupEventListeners',
                songId
              });
            }
          }
        }
      });

      // Double-click to edit assignment (TBD)
      soundboardTabContent.addEventListener('dblclick', (event) => {
        const button = event.target.closest('.soundboard-button');
        if (button) {
          debugLog?.info('Soundboard button double-clicked (edit TBD)', {
            module: 'soundboard',
            function: 'setupEventListeners',
            buttonId: button.id
          });
        }
      });

      // Right-click context menu (TBD)
      soundboardTabContent.addEventListener('contextmenu', (event) => {
        const button = event.target.closest('.soundboard-button');
        if (button) {
          event.preventDefault();
          debugLog?.info('Soundboard button right-clicked (context menu TBD)', {
            module: 'soundboard',
            function: 'setupEventListeners',
            buttonId: button.id
          });
        }
      });

      // Drag start - allow dragging filled buttons
      soundboardTabContent.addEventListener('dragstart', (event) => {
        const button = event.target.closest('.soundboard-button.filled-button');
        if (button && button.hasAttribute('songid')) {
          event.dataTransfer.setData('text/plain', button.getAttribute('songid'));
          event.dataTransfer.effectAllowed = 'move';
          debugLog?.info('Soundboard button dragstart', {
            module: 'soundboard',
            function: 'setupEventListeners',
            songId: button.getAttribute('songid')
          });
        } else {
          event.preventDefault(); // Prevent dragging empty buttons
        }
      });

      // Keyboard navigation
      soundboardTabContent.addEventListener('keydown', (event) => {
        this.handleKeyboardNavigation(event);
      });

      // Drag and drop events
      soundboardTabContent.addEventListener('drop', (event) => {
        const button = event.target.closest('.soundboard-button');
        if (button) {
          button.classList.remove('drop-target');
          this.soundboardButtonDrop(event);
        }
      });

      soundboardTabContent.addEventListener('dragover', (event) => {
        const button = event.target.closest('.soundboard-button');
        if (button) {
          this.allowSoundboardButtonDrop(event);
        }
      });

      soundboardTabContent.addEventListener('dragleave', (event) => {
        const button = event.target.closest('.soundboard-button');
        if (button) {
          button.classList.remove('drop-target');
        }
      });
    }

    // Tab click events
    const soundboardTabs = document.getElementById('soundboard_tabs');
    if (soundboardTabs) {
      soundboardTabs.addEventListener('click', (event) => {
        const tabLink = event.target.closest('.nav-link');
        if (tabLink) {
          const tabNum = parseInt(tabLink.textContent, 10);
          if (!isNaN(tabNum) && typeof this.switchToSoundboardTab === 'function') {
            this.switchToSoundboardTab(tabNum);
            this.updateGridLayout(); // Update layout when tab changes
          }
        }
      });

      // Double-click to rename tab
      soundboardTabs.addEventListener('dblclick', (event) => {
        const tabLink = event.target.closest('.nav-link');
        if (tabLink && typeof this.renameSoundboardTab === 'function') {
          this.renameSoundboardTab();
        }
      });
    }

    // Search panel toggle button
    const searchPanelToggleButton = document.getElementById('soundboard-search-panel-toggle');
    if (searchPanelToggleButton) {
      searchPanelToggleButton.addEventListener('click', () => {
        if (typeof this.toggleSearchPanel === 'function') {
          this.toggleSearchPanel();
        }
      });
    }

    debugLog?.info('✅ Soundboard event listeners set up', {
      module: 'soundboard',
      function: 'setupEventListeners'
    });
  }

  /**
   * Handle keyboard navigation within the soundboard grid
   * @param {KeyboardEvent} event - The keyboard event
   */
  handleKeyboardNavigation(event) {
    const activeTabContent = document.querySelector('#soundboard-tab-content .tab-pane.active');
    if (!activeTabContent) return;

    const focusableButtons = Array.from(activeTabContent.querySelectorAll('.soundboard-button'));
    if (focusableButtons.length === 0) return;

    let focusedIndex = focusableButtons.findIndex(btn => btn === document.activeElement);
    let newIndex = focusedIndex;

    const gridContainer = activeTabContent.querySelector('.soundboard-grid-container');
    const columns = parseInt(gridContainer?.style.getPropertyValue('--grid-columns')) || 6;

    switch (event.key) {
      case 'ArrowUp':
        newIndex = focusedIndex - columns;
        break;
      case 'ArrowDown':
        newIndex = focusedIndex + columns;
        break;
      case 'ArrowLeft':
        newIndex = focusedIndex - 1;
        break;
      case 'ArrowRight':
        newIndex = focusedIndex + 1;
        break;
      case 'Enter':
      case ' ': // Space key
        if (focusedIndex !== -1) {
          const songId = focusableButtons[focusedIndex].getAttribute('songid');
          if (songId && window.moduleRegistry?.audio?.playSongFromId) {
            window.moduleRegistry.audio.playSongFromId(songId);
          }
        }
        event.preventDefault();
        return;
      case 'Tab':
        // Allow default tab behavior
        return;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        if (focusedIndex !== -1) {
          const currentButton = focusableButtons[focusedIndex];
          if (currentButton && currentButton.getAttribute('songid')) {
            // Clear button
            currentButton.removeAttribute('songid');
            const placeholder = currentButton.querySelector('.soundboard-button-placeholder');
            const songInfo = currentButton.querySelector('.soundboard-button-info');
            if (placeholder) placeholder.style.display = 'block';
            if (songInfo) {
              songInfo.style.display = 'none';
              songInfo.innerHTML = '';
            }
            this.saveSoundboardToStore();
          }
        }
        return;
      default:
        return;
    }

    if (newIndex >= 0 && newIndex < focusableButtons.length) {
      focusableButtons[newIndex].focus();
      event.preventDefault();
    } else if (newIndex < 0) {
      // Wrap around to the last row
      newIndex = focusableButtons.length + newIndex;
      if (newIndex >= 0 && newIndex < focusableButtons.length) {
        focusableButtons[newIndex].focus();
        event.preventDefault();
      }
    } else if (newIndex >= focusableButtons.length) {
      // Wrap around to the first row
      newIndex = newIndex - focusableButtons.length;
      if (newIndex >= 0 && newIndex < focusableButtons.length) {
        focusableButtons[newIndex].focus();
        event.preventDefault();
      }
    }
  }

  /**
   * Initialize the module (standardized method)
   * @param {Object} dependencies - Module dependencies
   * @returns {Promise<boolean>} Success status
   */
  async init(dependencies = {}) {
    try {
      debugLog?.info('Initializing Soundboard Module via standardized init()', {
        module: 'soundboard',
        function: 'init'
      });

      // Call the existing initialization logic
      this.initSoundboard();

      debugLog?.info('Soundboard Module initialized successfully via init()', {
        module: 'soundboard',
        function: 'init'
      });
      return true;
    } catch (error) {
      debugLog?.error('Failed to initialize Soundboard Module via init()', {
        module: 'soundboard',
        function: 'init',
        error: error.message
      });
      return false;
    }
  }

  /**
   * Reinitialize with dependencies
   */
  async reinitializeSoundboard(deps) {
    if (deps.electronAPI) {
      this.electronAPI = deps.electronAPI;
    }
    if (deps.db) {
      this.db = deps.db;
    }
    if (deps.store) {
      this.store = deps.store;
    }
    if (deps.debugLog) {
      debugLog = deps.debugLog;
    }

    // Reinitialize sub-modules with dependencies
    if (soundboardData.reinitializeSoundboardData) {
      await soundboardData.reinitializeSoundboardData(deps);
    }
    if (soundboardGrid.reinitializeSoundboardGrid) {
      await soundboardGrid.reinitializeSoundboardGrid(deps);
    }
    if (soundboardUI.reinitializeSoundboardUI) {
      await soundboardUI.reinitializeSoundboardUI(deps);
    }
    if (soundboardEvents.reinitializeSoundboardEvents) {
      await soundboardEvents.reinitializeSoundboardEvents(deps);
    }
    if (soundboardSearchPanel.reinitializeSoundboardSearchPanel) {
      await soundboardSearchPanel.reinitializeSoundboardSearchPanel(deps);
    }
  }

  /**
   * Initialize view when switching to soundboard mode
   */
  async initializeView() {
    debugLog?.info('Initializing soundboard view', {
      module: 'soundboard',
      function: 'initializeView'
    });

    // Update grid layout for current window size
    if (typeof this.updateGridLayout === 'function') {
      this.updateGridLayout();
    }

    // Restore search panel state
    if (typeof this.initializeSearchPanel === 'function') {
      this.initializeSearchPanel();
    }
  }

  /**
   * Save soundboard state
   */
  async saveState() {
    debugLog?.info('Saving soundboard state', {
      module: 'soundboard',
      function: 'saveState'
    });

    if (typeof this.saveSoundboardToStore === 'function') {
      await this.saveSoundboardToStore();
    }
  }

  /**
   * Restore soundboard state
   */
  async restoreState() {
    debugLog?.info('Restoring soundboard state', {
      module: 'soundboard',
      function: 'restoreState'
    });

    if (typeof this.loadSoundboardFromStore === 'function') {
      await this.loadSoundboardFromStore();
    }

    // Update grid layout after restoring
    if (typeof this.updateGridLayout === 'function') {
      this.updateGridLayout();
    }
  }
}

// Create singleton instance
const soundboard = new SoundboardModule();

// Export singleton as default and named export
export default soundboard;
export { soundboard };

