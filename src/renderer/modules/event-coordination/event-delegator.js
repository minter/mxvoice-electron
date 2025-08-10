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
    // Single click selection
    const searchResultsClickHandler = (event) => {
      const target = $(event.target).closest('tbody tr');
      if (target.length && window.toggleSelectedRow) {
        window.toggleSelectedRow(target[0]);
      }
    };

    // Context menu selection
    const searchResultsContextHandler = (event) => {
      const target = $(event.target).closest('tbody tr');
      if (target.length && window.toggleSelectedRow) {
        window.toggleSelectedRow(target[0]);
      }
    };

    // Double click to play
    const searchResultsDoubleClickHandler = (event) => {
      const target = $(event.target).closest('tbody tr.song');
      if (target.length && window.playSelected) {
        window.playSelected();
      }
    };

    // Attach delegated events
    $("#search_results").on("click", "tbody tr", searchResultsClickHandler);
    $("#search_results").on("contextmenu", "tbody tr", searchResultsContextHandler);
    $("#search_results").on("dblclick", "tbody tr.song", searchResultsDoubleClickHandler);

    // Store handlers for cleanup
    this.delegatedHandlers.set('searchResultsClick', { element: '#search_results', event: 'click', selector: 'tbody tr', handler: searchResultsClickHandler });
    this.delegatedHandlers.set('searchResultsContext', { element: '#search_results', event: 'contextmenu', selector: 'tbody tr', handler: searchResultsContextHandler });
    this.delegatedHandlers.set('searchResultsDoubleClick', { element: '#search_results', event: 'dblclick', selector: 'tbody tr.song', handler: searchResultsDoubleClickHandler });

    this.debugLog?.debug('Search results delegation set up');
  }

  /**
   * Set up holding tank event delegation
   */
  setupHoldingTankDelegation() {
    // Single click selection
    const holdingTankClickHandler = (event) => {
      const target = $(event.target).closest('.list-group-item');
      if (target.length && window.toggleSelectedRow) {
        window.toggleSelectedRow(target[0]);
      }
    };

    // Double click to play
    const holdingTankDoubleClickHandler = (event) => {
      const target = $(event.target).closest('.list-group-item');
      if (target.length) {
        $(".now_playing").first().removeClass("now_playing");

        // Set the clicked item as selected
        $("#selected_row").removeAttr("id");
        target.attr("id", "selected_row");

        if (window.getHoldingTankMode && window.getHoldingTankMode() === "playlist") {
          // In playlist mode, mark this song as now playing and start autoplay
          target.addClass("now_playing");
          if (window.sharedState) {
            window.sharedState.set('autoplay', true);
          }
        }

        if (window.playSelected) {
          window.playSelected();
        }
      }
    };

    // Attach delegated events
    $(".holding_tank").on("click", ".list-group-item", holdingTankClickHandler);
    $(".holding_tank").on("dblclick", ".list-group-item", holdingTankDoubleClickHandler);

    // Store handlers for cleanup
    this.delegatedHandlers.set('holdingTankClick', { element: '.holding_tank', event: 'click', selector: '.list-group-item', handler: holdingTankClickHandler });
    this.delegatedHandlers.set('holdingTankDoubleClick', { element: '.holding_tank', event: 'dblclick', selector: '.list-group-item', handler: holdingTankDoubleClickHandler });

    this.debugLog?.debug('Holding tank delegation set up');
  }

  /**
   * Set up hotkeys event delegation
   */
  setupHotkeysDelegation() {
    // Single click selection
    const hotkeysClickHandler = (event) => {
      const target = $(event.target).closest('li');
      // Only select if the hotkey has a song assigned
      if (target.length && target.attr("songid")) {
        $("#selected_row").removeAttr("id");
        target.attr("id", "selected_row");
      }
    };

    // Double click to play
    const hotkeysDoubleClickHandler = (event) => {
      const target = $(event.target).closest('li');
      if (target.length) {
        $(".now_playing").first().removeClass("now_playing");
        $("#selected_row").removeAttr("id");
        
        if (target.find("span").text().length) {
          const song_id = target.attr("songid");
          if (song_id && window.playSongFromId) {
            window.playSongFromId(song_id);
          }
        }
      }
    };

    // Attach delegated events
    $(".hotkeys").on("click", "li", hotkeysClickHandler);
    $(".hotkeys").on("dblclick", "li", hotkeysDoubleClickHandler);

    // Store handlers for cleanup
    this.delegatedHandlers.set('hotkeysClick', { element: '.hotkeys', event: 'click', selector: 'li', handler: hotkeysClickHandler });
    this.delegatedHandlers.set('hotkeysDoubleClick', { element: '.hotkeys', event: 'dblclick', selector: 'li', handler: hotkeysDoubleClickHandler });

    this.debugLog?.debug('Hotkeys delegation set up');
  }

  /**
   * Clean up event delegation
   */
  cleanup() {
    try {
      this.debugLog?.info('Cleaning up event delegation...');

      // Remove all delegated handlers
      for (const [name, handler] of this.delegatedHandlers) {
        $(handler.element).off(handler.event, handler.selector, handler.handler);
        this.debugLog?.debug(`Removed delegated handler: ${name}`);
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
      handlers: Array.from(this.delegatedHandlers.keys())
    };
  }
}
