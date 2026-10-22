import { customConfirm } from '../utils/index.js';
import playedCounts from '../shows/played-counts.js';
import { clearContextTarget, getSongActionTarget, markContextTarget } from '../ui/song-action-target.js';

/**
 * DOM Initialization Module
 *
 * Handles DOM structure initialization that was previously in renderer.js.
 * Sets up tab structure, context menus, and other DOM elements.
 */

export default class DOMInitialization {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.secureElectronAPI;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || {};

    this.initialized = false;
  }

  /**
   * Initialize DOM structure
   * This replaces the DOM setup code from renderer.js $(document).ready()
   */
  async initializeDOMStructure() {
    try {
      if (this.initialized) {
        this.debugLog?.warn('DOM structure already initialized');
        return;
      }

      this.debugLog?.info('Initializing DOM structure...');

      // Initialize progress bar
      this.initializeProgressBar();

      // Initialize Bootstrap tooltips across the document
      try {
        const { initTooltip, disposeAllTooltips, hideAllTooltips } = await import('../ui/bootstrap-adapter.js');
        // Dispose any existing tooltips first to prevent duplicates
        disposeAllTooltips();
        // Initialize fresh tooltip instances
        initTooltip('[data-bs-toggle="tooltip"]');
        // Make hideAllTooltips available globally for debugging and manual control
        window.hideAllTooltips = hideAllTooltips;
        
        // Add tooltip testing function for debugging
        window.testTooltips = async function() {
          const { initTooltip, disposeAllTooltips } = await import('../ui/bootstrap-adapter.js');
          const log = window.debugLog || { info: () => {} };
          log.info('Testing tooltip behavior...', { module: 'dom-initialization', function: 'testTooltips' });
          log.info('1. Disposing all tooltips...', { module: 'dom-initialization', function: 'testTooltips' });
          disposeAllTooltips();
          log.info('2. Re-initializing tooltips...', { module: 'dom-initialization', function: 'testTooltips' });
          initTooltip('[data-bs-toggle="tooltip"]');
          log.info('3. Tooltips re-initialized. Try hovering over buttons to test.', { module: 'dom-initialization', function: 'testTooltips' });
          log.info('4. Call window.hideAllTooltips() to force hide all tooltips.', { module: 'dom-initialization', function: 'testTooltips' });
        };
        
        this.debugLog?.debug('Bootstrap tooltips initialized');
      } catch (err) { this.debugLog?.warn('Failed to initialize Bootstrap tooltips', { module: 'dom-initialization', function: 'initializeDOMStructure', error: err?.message }); }

      // Set up hotkey and holding tank tabs (lines 684-694 from renderer.js)
      this.setupTabStructure();

      // Set up context menu (lines 696-730 from renderer.js)
      this.setupContextMenu();

      // Hide search results header initially (line 1122 from renderer.js)
      this.initializeSearchResults();

      // Set up first run modal logic (lines 1174-1214 from renderer.js)
      await this.setupFirstRunModal();

      this.initialized = true;
      this.debugLog?.info('DOM structure initialized successfully');
    } catch (error) {
      this.debugLog?.error('Failed to initialize DOM structure:', error);
    }
  }

  /**
   * Initialize progress bar to 0% width
   */
  initializeProgressBar() {
    const progress = document.getElementById('audio_progress');
    if (progress) progress.style.width = '0%';
    this.debugLog?.debug('Progress bar initialized to 0%');
  }

  /**
   * Set up hotkey and holding tank tabs (cloning tabs 2-5)
   */
  setupTabStructure() {
    try {
      // Set up hotkey and holding tank tabs for tabs 2-5
      for (let i = 2; i <= 5; i++) {
        // Clone hotkey tab
        const baseHotkeys = document.getElementById('hotkeys_list_1');
        const hotkeysContainer = document.getElementById('hotkey-tab-content');
        if (baseHotkeys && hotkeysContainer) {
          const clone = baseHotkeys.cloneNode(true);
          clone.id = `hotkeys_list_${i}`;
          clone.classList.remove('show', 'active');
          // Fix duplicate IDs: suffix cloned hotkey elements with _t{tabNum}
          clone.querySelectorAll('[id$="_hotkey"]').forEach(el => {
            el.id = el.id.replace('_hotkey', `_hotkey_t${i}`);
          });
          hotkeysContainer.appendChild(clone);
        }

        // Clone holding tank tab
        const baseHolding = document.getElementById('holding_tank_1');
        const holdingContainer = document.getElementById(
          'holding-tank-tab-content'
        );
        if (baseHolding && holdingContainer) {
          const clone2 = baseHolding.cloneNode(true);
          clone2.id = `holding_tank_${i}`;
          clone2.classList.remove('show', 'active');
          holdingContainer.appendChild(clone2);
        }
      }

      this.debugLog?.debug('Tab structure set up for tabs 2-5');
    } catch (error) {
      this.debugLog?.error('Failed to setup tab structure:', error);
    }
  }

  /**
   * Set up context menu for song operations
   */
  setupContextMenu() {
    try {
      // Native context menu implemented in place of jQuery plugin
      const menu = document.createElement('div');
      menu.id = 'mxv-context-menu';
      menu.className = 'mxv-context-menu';
      Object.assign(menu.style, {
        position: 'fixed',
        zIndex: '9999',
        display: 'none',
        minWidth: '200px',
      });
      const mkItem = (label, onClick) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.textContent = label;
        item.className = 'mxv-context-item';
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          hide();
          // The action reads the target, so the mark goes once it has run
          try {
            onClick?.();
          } finally {
            clearContextTarget();
          }
        });
        return item;
      };
      let playItem = mkItem('Play', () => {
        if (this.moduleRegistry.audio?.playSelected) {
          this.moduleRegistry.audio.playSelected();
        }
      });
      let editItem = mkItem('Edit', () => {
        if (this.moduleRegistry.songManagement?.editSelectedSong) {
          this.moduleRegistry.songManagement.editSelectedSong();
        }
      });
      let deleteItem = mkItem('Delete', () => {
        // This default handler is now managed dynamically in the show function
        // to prevent duplicate listeners.
      });
      // Shown only for a song played tonight; the song is the row the menu opened on
      let unplayedSongId = null;
      const unplayedItem = mkItem('Mark as Unplayed', () => {
        playedCounts.clear(unplayedSongId);
      });
      menu.append(playItem, editItem, unplayedItem, deleteItem);
      document.body.appendChild(menu);

      const hide = () => {
        menu.style.display = 'none';
      };

      // Helper to remove all previous click listeners from deleteItem
      function clearDeleteItemListeners() {
        if (deleteItem._mxvHandler) {
          deleteItem.removeEventListener('click', deleteItem._mxvHandler);
          deleteItem._mxvHandler = null;
        }
      }

      const show = (x, y, dynamicDeleteLabel, onRemoveHotkey) => {
        deleteItem.textContent = dynamicDeleteLabel || 'Delete';
        // Every caller marks or selects the row it opened on first
        unplayedSongId = getSongActionTarget()?.getAttribute('songid') || null;
        unplayedItem.style.display = playedCounts.count(unplayedSongId) > 0 ? '' : 'none';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';

        clearDeleteItemListeners();

        // Define a single, reusable handler function to be attached.
        const newHandler = (e) => {
          e.stopPropagation();
          hide(); // Hide menu immediately.

          try {
            // Check which action to perform based on the label.
            if (dynamicDeleteLabel === 'Remove from Hotkey') {
              window.debugLog?.info('Context menu: Remove from Hotkey callback triggered');
              onRemoveHotkey?.();
            } else {
              // This covers 'Delete' and 'Remove from Holding Tank'
              window.debugLog?.info('Context menu: Default Delete callback triggered');
              this.moduleRegistry.songManagement?.deleteSelectedSong?.();
            }
          } finally {
            clearContextTarget();
          }
        };

        // Attach the new handler and store a reference for removal.
        deleteItem.addEventListener('click', newHandler);
        deleteItem._mxvHandler = newHandler;
      };

      // Dismissal (clicking away, Esc, blur, resize) drops the hotkey mark
      const dismiss = () => {
        hide();
        clearContextTarget();
      };

      document.addEventListener('click', dismiss);
      // Esc closes it too. Not stopped here: the Esc shortcut still stops
      // playback, since this menu never takes the focus.
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && menu.style.display !== 'none') dismiss();
      });
      window.addEventListener('blur', dismiss);
      window.addEventListener('resize', dismiss);

      document.addEventListener('contextmenu', (event) => {
        const row = event.target?.closest('.context-menu');
        if (!row) return;
        event.preventDefault();
        // A menu opened on an earlier hotkey no longer targets it
        clearContextTarget();

        // Check if this is a hotkey element
        const hotkeyLi = event.target.closest('li[id*="_hotkey"]');
        if (hotkeyLi) {
          // Handle hotkey context menu
          window.debugLog?.info('Context menu triggered on hotkey element', { 
            hotkeyId: hotkeyLi.id,
            hasSongId: hotkeyLi.hasAttribute('songid'),
            songId: hotkeyLi.getAttribute('songid'),
            spanText: hotkeyLi.querySelector('span')?.textContent?.trim()
          });

          // Check if this hotkey has a song assigned
          const hasSong = hotkeyLi.hasAttribute('songid') && hotkeyLi.querySelector('span')?.textContent?.trim();
          
          if (hasSong) {
            // Store original hotkey ID and song info for direct removal
            const originalHotkeyId = hotkeyLi.id;
            const songid = hotkeyLi.getAttribute('songid');
            
            // Clear all previous hotkey highlighting FIRST (like left-click does)
            document.querySelectorAll('[id*="_hotkey"]').forEach((item) => {
              item.classList.remove('active-hotkey', 'selected-row');
            });
            window.currentSelectedHotkey = null;
            
            // Deselect the search or holding-tank row, as a hotkey click does,
            // and mark the slot as the menu's target. Its id stays: the F-keys
            // and a show switch find the slot by it.
            document.getElementById('selected_row')?.removeAttribute('id');
            markContextTarget(hotkeyLi);
            hotkeyLi.classList.add('active-hotkey', 'selected-row');
            window.currentSelectedHotkey = originalHotkeyId;
            window.debugLog?.info('Context menu: marked hotkey as the menu target', {
              originalHotkeyId: originalHotkeyId,
              songid: songid
            });

            show(event.clientX, event.clientY, 'Remove from Hotkey', async () => {
              window.debugLog?.info('Context menu: Remove from Hotkey pressed', { originalHotkeyId: originalHotkeyId });

              try {
                // Get song title for confirmation (same as the complex function)
                let songTitle = 'this song';
                if (this.electronAPI?.database?.getSongById) {
                  try {
                    const result = await this.electronAPI.database.getSongById(songid);
                    if (result?.success && result.data?.[0]?.title) {
                      songTitle = result.data[0].title;
                    }
                  } catch (error) {
                    window.debugLog?.warn('Could not fetch song title:', error);
                  }
                }
                
                // Show confirmation (using the simple modal approach)
                const confirmed = await customConfirm(`Are you sure you want to remove ${songTitle} from this hotkey?`);
                
                if (confirmed) {
                  window.debugLog?.info('User confirmed hotkey removal');
                  
                  // Use the same direct approach as delete keypress
                  const element = hotkeyLi;
                  if (element.isConnected) {
                    this.moduleRegistry.hotkeys?.clearHotkeyElement?.(element);
                    element.classList.remove('active-hotkey', 'selected-row');
                    window.currentSelectedHotkey = null;
                    
                    // Save hotkeys state
                    if (this.moduleRegistry.hotkeys?.requestProfileStateSave) {
                      this.moduleRegistry.hotkeys.requestProfileStateSave();
                      window.debugLog?.info('Hotkeys state saved after context menu removal');
                    }
                    
                    window.debugLog?.info('Hotkey assignment removed via context menu', { hotkeyId: originalHotkeyId });
                  }
                } else {
                  window.debugLog?.info('User cancelled hotkey removal');
                }
              } catch (error) {
                window.debugLog?.error('Error in context menu hotkey removal:', error);
              }
            });
          }
          return; // Don't process as regular context menu
        }

        // Handle regular context menu for non-hotkey elements
        // Always set the right-clicked row as selected_row
        const prev = document.getElementById('selected_row');
        window.debugLog?.info('Context menu: about to set selected_row', {
          prevId: prev?.id,
          prevSongid: prev?.getAttribute('songid'),
          rowId: row.id,
          rowSongid: row.getAttribute('songid'),
          rowClassList: [...row.classList]
        });
        if (prev) prev.removeAttribute('id');
        // Preserve songid when setting selected_row
        const songid = row.getAttribute('songid');
        row.id = 'selected_row';
        if (songid) {
          row.setAttribute('songid', songid);
          window.debugLog?.info('Context menu: preserved songid on selected_row', { songid });
        } else {
          window.debugLog?.info('Context menu: no songid to preserve on selected_row');
        }
        window.debugLog?.info('Context menu: set selected_row', {
          rowId: row.id,
          classList: [...row.classList],
          songid: row.getAttribute('songid')
        });

        let label = 'Delete';
        const holdingCol = document.getElementById('holding-tank-column');

        if (holdingCol && holdingCol.contains(row)) {
          label = 'Remove from Holding Tank';
        }
        const x = Math.min(event.clientX, window.innerWidth - 220);
        const y = Math.min(event.clientY, window.innerHeight - 150);
        show(x, y, label);
      });

      // Note: Context menu handling is now consolidated in the main document.addEventListener('contextmenu') handler above

      this.debugLog?.debug('Context menu set up (native)');
    } catch (error) {
      this.debugLog?.error('Failed to setup context menu:', error);
    }
  }

  /**
   * Initialize search results display
   */
  initializeSearchResults() {
    const thead = document.querySelector('#search_results thead');
    if (thead) thead.style.display = 'none';
    this.debugLog?.debug('Search results header hidden');
  }

  /**
   * Set up first run modal logic
   */
  async setupFirstRunModal() {
    try {
      // Check if we're in a seeded test environment (has multiple songs)
      if (window.electronTest?.isE2E) {
        try {
          // In seeded test environment, check if we have multiple songs
          if (this.electronAPI && this.electronAPI.database) {
            const result = await this.electronAPI.database.countSongs();
            if (result.success && result.data.length > 0 && result.data[0].count > 1) {
              this.debugLog?.info('Seeded test environment detected with multiple songs - skipping first run modal');
              return;
            }
          }
        } catch (_error) {
          this.debugLog?.info('Could not check song count in test environment, proceeding with modal check');
        }
      }

      // Use new database API for song count
      if (this.electronAPI && this.electronAPI.database) {
        const result = await this.electronAPI.database.countSongs();
        if (
          result.success &&
          result.data.length > 0
        ) {
          const songCount = result.data[0].count;
          this.debugLog?.info(`Database song count: ${songCount}`);

          // Only show first run modal if database has <= 1 songs
          if (songCount <= 1) {
            const { safeShowModal } = await import('../ui/bootstrap-helpers.js');
            safeShowModal('#firstRunModal', { module: 'dom-initialization' });
            this.debugLog?.info(
              'First run modal shown - database has <= 1 songs'
            );
          } else {
            this.debugLog?.info(
              'First run modal skipped - database has > 1 songs'
            );
          }
        } else {
          this.debugLog?.warn('Failed to get song count from database');
        }
      }
    } catch (error) {
      this.debugLog?.error('Database API error', error);
    }
  }

  /**
   * Legacy fallback removed
   */
  async setupFirstRunModalFallback() {}

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      components: {
        progressBar: !!document.getElementById('audio_progress'),
        tabs: !!document.getElementById('hotkeys_list_2'),
        contextMenu: document.querySelectorAll('.context-menu').length > 0,
        searchResults: !!document.getElementById('search_results'),
      },
    };
  }
}

// GLOBAL DEBUG LOG for all contextmenu events
if (window.debugLog) {
  document.addEventListener('contextmenu', (e) => {
    window.debugLog.info('GLOBAL contextmenu event', {
      targetId: e.target?.id,
      classList: [...e.target?.classList || []],
      x: e.clientX,
      y: e.clientY
    });
  }, true);
}
