/**
 * Hotkeys Events Module
 * 
 * Handles all hotkey-related event handlers including:
 * - Double-click to play songs from hotkeys
 * - Drag and drop for hotkey assignment
 * - Hotkey tab management
 * 
 * This module integrates with the HotkeysModule to provide event handling
 * while maintaining separation of concerns.
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

export default class HotkeysEvents {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = dependencies.db || window.db;
    this.store = dependencies.store || window.store;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || window.moduleRegistry;
    
    // Event handling state
    this.eventsAttached = false;
    this.hotkeyHandlers = new Map();
  }

  /**
   * Attach all hotkey event handlers
   */
  async attachHotkeysEvents() {
    try {
      if (this.eventsAttached) {
        this.debugLog?.warn('Hotkeys events already attached');
        return;
      }

      this.debugLog?.info('Attaching hotkeys event handlers...');

      // Double-click to play events
      this.attachPlaybackEvents();

      // Drag and drop events
      this.attachDragDropEvents();

      // Tab management events
      this.attachTabEvents();

      this.eventsAttached = true;
      this.debugLog?.info('Hotkeys event handlers attached successfully');

    } catch (error) {
      this.debugLog?.error('Failed to attach hotkeys events:', error);
    }
  }

  /**
   * Attach double-click playback events
   */
  attachPlaybackEvents() {
    try {
      const hotkeysRoot = document.querySelector('.hotkeys');
      if (!hotkeysRoot) {
        this.debugLog?.warn('No hotkeys element found for playback events');
        return;
      }

      // Double-click to play song from hotkey
      const doubleClickHandler = (event) => {
        const li = event.target && event.target.closest('li');
        if (!li || !hotkeysRoot.contains(li)) return;

        // Clear any existing selection
        document.querySelector('.now_playing')?.classList.remove('now_playing');
        document.getElementById('selected_row')?.removeAttribute('id');

        // Get song ID and play
        const span = li.querySelector('span');
        if (span && (span.textContent || '').length) {
          const song_id = li.getAttribute('songid');
          if (song_id && window.playSongFromId) {
            this.debugLog?.info('🎵 Playing song from hotkey double-click', {
              module: 'hotkeys-events',
              function: 'attachPlaybackEvents',
              song_id: song_id
            });
            window.playSongFromId(song_id);
          } else {
            this.debugLog?.warn('Cannot play song - missing song_id or playSongFromId function', {
              module: 'hotkeys-events',
              function: 'attachPlaybackEvents',
              song_id: song_id,
              hasPlayFunction: !!window.playSongFromId
            });
          }
        }
      };

      hotkeysRoot.addEventListener('dblclick', doubleClickHandler);
      
      // Store handler for cleanup
      this.hotkeyHandlers.set('doubleClick', {
        element: hotkeysRoot,
        event: 'dblclick',
        handler: doubleClickHandler
      });

      this.debugLog?.debug('Hotkey playback events attached');

    } catch (error) {
      this.debugLog?.error('Failed to attach hotkey playback events:', error);
    }
  }

  /**
   * Attach drag and drop events for hotkey assignment
   */
  attachDragDropEvents() {
    try {
      const hotkeyItems = document.querySelectorAll('.hotkeys li');
      if (!hotkeyItems.length) {
        this.debugLog?.warn('No hotkey items found for drag and drop events');
        return;
      }

      hotkeyItems.forEach((li) => {
        // Drop event
        const dropHandler = (event) => {
          li.classList.remove('drop_target');
          const data = (event.originalEvent || event).dataTransfer?.getData('text') || '';
          if (!data.length) return;

          // Use the hotkeys module's drop functionality if available
          if (this.moduleRegistry?.hotkeys?.hotkeyDrop) {
            this.moduleRegistry.hotkeys.hotkeyDrop(event.originalEvent || event, {
              setLabelFromSongId: this.moduleRegistry.hotkeys.setLabelFromSongId?.bind(this.moduleRegistry.hotkeys)
            });
          } else {
            this.debugLog?.warn('Hotkeys module drop functionality not available');
          }
        };

        // Drag over event
        const dragOverHandler = (event) => {
          li.classList.add('drop_target');
          if (this.moduleRegistry?.hotkeys?.allowHotkeyDrop) {
            this.moduleRegistry.hotkeys.allowHotkeyDrop(event.originalEvent || event);
          }
        };

        // Drag leave event
        const dragLeaveHandler = (event) => {
          event.currentTarget.classList.remove('drop_target');
        };

        // Attach events
        li.addEventListener('drop', dropHandler);
        li.addEventListener('dragover', dragOverHandler);
        li.addEventListener('dragleave', dragLeaveHandler);

        // Store handlers for cleanup
        this.hotkeyHandlers.set(`drop_${li.id}`, {
          element: li,
          event: 'drop',
          handler: dropHandler
        });
        this.hotkeyHandlers.set(`dragover_${li.id}`, {
          element: li,
          event: 'dragover',
          handler: dragOverHandler
        });
        this.hotkeyHandlers.set(`dragleave_${li.id}`, {
          element: li,
          event: 'dragleave',
          handler: dragLeaveHandler
        });
      });

      this.debugLog?.debug('Hotkey drag and drop events attached');

    } catch (error) {
      this.debugLog?.error('Failed to attach hotkey drag and drop events:', error);
    }
  }

  /**
   * Attach tab management events
   */
  attachTabEvents() {
    try {
      const hotkeyTabs = document.getElementById('hotkey_tabs');
      if (!hotkeyTabs) {
        this.debugLog?.debug('No hotkey tabs found for tab events');
        return;
      }

      // Double-click to rename tab
      const tabDoubleClickHandler = (event) => {
        if (event.target && event.target.closest('.nav-link')) {
          if (this.moduleRegistry?.hotkeys?.renameHotkeyTab) {
            this.moduleRegistry.hotkeys.renameHotkeyTab();
          } else {
            this.debugLog?.warn('Hotkeys module rename functionality not available');
          }
        }
      };

      hotkeyTabs.addEventListener('dblclick', tabDoubleClickHandler);

      // Store handler for cleanup
      this.hotkeyHandlers.set('tabDoubleClick', {
        element: hotkeyTabs,
        event: 'dblclick',
        handler: tabDoubleClickHandler
      });

      this.debugLog?.debug('Hotkey tab events attached');

    } catch (error) {
      this.debugLog?.error('Failed to attach hotkey tab events:', error);
    }
  }

  /**
   * Detach all hotkey event handlers
   */
  detachEvents() {
    try {
      this.debugLog?.info('Detaching hotkey event handlers...');

      // Remove all stored handlers
      for (const [key, handlerInfo] of this.hotkeyHandlers) {
        try {
          handlerInfo.element.removeEventListener(handlerInfo.event, handlerInfo.handler);
          this.debugLog?.debug(`Removed ${handlerInfo.event} handler from ${handlerInfo.element.tagName}`);
        } catch (error) {
          this.debugLog?.warn(`Failed to remove ${key} handler:`, error);
        }
      }

      // Clear handlers map
      this.hotkeyHandlers.clear();
      this.eventsAttached = false;

      this.debugLog?.info('All hotkey event handlers detached');

    } catch (error) {
      this.debugLog?.error('Failed to detach hotkey event handlers:', error);
    }
  }

  /**
   * Get module status for debugging
   */
  getStatus() {
    return {
      eventsAttached: this.eventsAttached,
      handlerCount: this.hotkeyHandlers.size,
      hasModuleRegistry: !!this.moduleRegistry,
      hasHotkeysModule: !!this.moduleRegistry?.hotkeys
    };
  }
}
