/**
 * Event Delegator Module
 *
 * Handles event delegation patterns for efficient event management.
 * Provides optimized event delegation for dynamic content.
 */

export default class EventDelegator {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = null;
    this.store = null;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || window.moduleRegistry;

    this.delegatedHandlers = new Map();
    this.isSetup = false;
  }

  /**
   * Set up event delegation patterns
   */
  async setupEventDelegation() {
    try {
      if (this.isSetup) {
        this.debugLog?.warn('Event delegation already set up');
        return;
      }

      this.debugLog?.info('Setting up event delegation...');

      // Search results delegation
      this.setupSearchResultsDelegation();

      // Holding tank delegation
      this.setupHoldingTankDelegation();

      // Hotkeys delegation
      this.setupHotkeysDelegation();

      this.isSetup = true;
      this.debugLog?.info('Event delegation set up successfully');
    } catch (error) {
      this.debugLog?.error('Failed to setup event delegation:', error);
    }
  }

  /**
   * Set up search results event delegation
   */
  setupSearchResultsDelegation() {
    const table = document.getElementById('search_results');
    if (!table) return;
    const clickHandler = (event) => {
      const row = event.target && event.target.closest('tbody tr');
      if (row && table.contains(row) && window.toggleSelectedRow)
        window.toggleSelectedRow(row);
    };
    const contextHandler = (event) => {
      const row = event.target && event.target.closest('tbody tr');
      if (row && table.contains(row) && window.toggleSelectedRow)
        window.toggleSelectedRow(row);
    };
    const dblHandler = (event) => {
      const row = event.target && event.target.closest('tbody tr.song');
      if (row && table.contains(row) && window.playSelected)
        window.playSelected();
    };
    table.addEventListener('click', clickHandler);
    table.addEventListener('contextmenu', contextHandler);
    table.addEventListener('dblclick', dblHandler);
    this.delegatedHandlers.set('searchResultsClick', {
      element: table,
      event: 'click',
      handler: clickHandler,
    });
    this.delegatedHandlers.set('searchResultsContext', {
      element: table,
      event: 'contextmenu',
      handler: contextHandler,
    });
    this.delegatedHandlers.set('searchResultsDoubleClick', {
      element: table,
      event: 'dblclick',
      handler: dblHandler,
    });

    // Search result row selection
    this.addEvent('click', '#search_results tbody tr', (event) => {
      this.debugLog.debug('Search result row clicked', {
        target: event.target,
        currentTarget: event.currentTarget
      });
      const prev = document.getElementById('selected_row');
      if (prev) {
        prev.removeAttribute('id');
      }
      event.currentTarget.id = 'selected_row';
    });

    this.debugLog?.debug('Search results delegation set up');
  }

  /**
   * Set up holding tank event delegation
   */
  setupHoldingTankDelegation() {
    // Single click selection
    const containers = document.querySelectorAll('.holding_tank');
    if (!containers.length) return;
    
    // Create handlers that will be attached to each container
    const holdingTankClickHandler = (event) => {
      const li = event.target && event.target.closest('.list-group-item');
      if (li && event.currentTarget.contains(li) && window.toggleSelectedRow)
        window.toggleSelectedRow(li);
    };

    // Double click to play
    const holdingTankDoubleClickHandler = (event) => {
      const li = event.target && event.target.closest('.list-group-item');
      if (!li || !event.currentTarget.contains(li)) return;
      const firstNow = document.querySelector('.now_playing');
      firstNow?.classList.remove('now_playing');
      document.getElementById('selected_row')?.removeAttribute('id');
      li.id = 'selected_row';
      if (
        window.getHoldingTankMode &&
        window.getHoldingTankMode() === 'playlist'
      ) {
        li.classList.add('now_playing');
        if (window.sharedState) window.sharedState.set('autoplay', true);
      }
      if (window.playSelected) window.playSelected();
    };

    // Attach delegated events to ALL holding tank containers (all tabs)
    containers.forEach((container, index) => {
      container.addEventListener('click', holdingTankClickHandler);
      container.addEventListener('dblclick', holdingTankDoubleClickHandler);

      // Store handlers for cleanup
      this.delegatedHandlers.set(`holdingTankClick_${index}`, {
        element: container,
        event: 'click',
        handler: holdingTankClickHandler,
      });
      this.delegatedHandlers.set(`holdingTankDoubleClick_${index}`, {
        element: container,
        event: 'dblclick',
        handler: holdingTankDoubleClickHandler,
      });
    });

    this.debugLog?.debug(`Holding tank delegation set up for ${containers.length} tab containers`);
  }

  /**
   * Set up hotkeys event delegation
   * NOTE: Hotkey event handling moved to Hotkeys module to avoid conflicts
   * This method is now a no-op to maintain API compatibility
   */
  setupHotkeysDelegation() {
    // Hotkey event handling has been moved to the Hotkeys module
    // to avoid duplicate event handlers and race conditions
    this.debugLog?.debug('Hotkeys delegation skipped - handled by Hotkeys module');
  }

  /**
   * Clean up event delegation
   */
  cleanup() {
    try {
      this.debugLog?.info('Cleaning up event delegation...');

      // Remove all delegated handlers
      for (const [name, h] of this.delegatedHandlers) {
        const el = h.element;
        if (el && typeof el.removeEventListener === 'function') {
          el.removeEventListener(h.event, h.handler);
          this.debugLog?.debug(`Removed delegated handler: ${name}`);
        }
      }

      this.delegatedHandlers.clear();
      this.isSetup = false;

      this.debugLog?.info('Event delegation cleanup completed');
    } catch (error) {
      this.debugLog?.error('Failed to cleanup event delegation:', error);
    }
  }

  /**
   * Get delegation status
   */
  getStatus() {
    return {
      isSetup: this.isSetup,
      handlerCount: this.delegatedHandlers.size,
      handlers: Array.from(this.delegatedHandlers.keys()),
    };
  }
}
