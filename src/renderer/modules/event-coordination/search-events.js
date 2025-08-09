/**
 * Search Events Module
 * 
 * Handles all search-related event handlers that were previously in renderer.js.
 * Includes search form submission, live search, category filters, and advanced search.
 */

export default class SearchEvents {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = dependencies.db || window.db;
    this.store = dependencies.store || window.store;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || window.moduleRegistry;
    
    this.eventsAttached = false;
    this.searchHandlers = new Map();
  }

  /**
   * Attach all search-related event handlers
   */
  async attachSearchEvents() {
    try {
      if (this.eventsAttached) {
        this.debugLog?.warn('Search events already attached');
        return;
      }

      this.debugLog?.info('Attaching search event handlers...');

      // Category select change events
      this.attachCategorySelectEvents();

      // Date search change events
      this.attachDateSearchEvents();

      // Search form events
      this.attachSearchFormEvents();

      // Live search events
      this.attachLiveSearchEvents();

      // Advanced search events
      this.attachAdvancedSearchEvents();

      // Search field navigation events
      this.attachSearchNavigationEvents();

      // Reset button events
      this.attachResetButtonEvents();

      this.eventsAttached = true;
      this.debugLog?.info('Search event handlers attached successfully');

    } catch (error) {
      this.debugLog?.error('Failed to attach search events:', error);
    }
  }

  /**
   * Category select change events (lines 774-785 from renderer.js)
   */
  attachCategorySelectEvents() {
    const categorySelectHandler = (event) => {
      try {
        var category = $("#category_select").prop("selectedIndex");
        this.debugLog?.debug('Category select changed, calling searchData...');
        
        if (window.searchData) {
          window.searchData();
          this.debugLog?.info('searchData called successfully from category change');
        } else {
          this.debugLog?.warn('searchData function not available');
        }
        
        $("#omni_search").focus();
        $("#category_select").prop("selectedIndex", category);
      } catch (error) {
        this.debugLog?.error('Error in category select handler:', error);
      }
    };

    $("#category_select").on("change", categorySelectHandler);
    this.searchHandlers.set('categorySelect', { element: '#category_select', event: 'change', handler: categorySelectHandler });
    
    this.debugLog?.debug('Category select events attached');
  }

  /**
   * Date search change events (lines 787-795 from renderer.js)
   */
  attachDateSearchEvents() {
    const dateSearchHandler = (event) => {
      try {
        this.debugLog?.debug('Date search changed, calling searchData...');
        
        if (window.searchData) {
          window.searchData();
          this.debugLog?.info('searchData called successfully from date search change');
        } else {
          this.debugLog?.warn('searchData function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in date search handler:', error);
      }
    };

    $("#date-search").on("change", dateSearchHandler);
    this.searchHandlers.set('dateSearch', { element: '#date-search', event: 'change', handler: dateSearchHandler });
    
    this.debugLog?.debug('Date search events attached');
  }

  /**
   * Search form submission events (lines 799-829 from renderer.js)
   */
  attachSearchFormEvents() {
    // Search form input keydown handler
    const searchFormKeydownHandler = (event) => {
      try {
        if (event.code == "Enter") {
          // Clear any pending live search using shared state
          const searchTimeout = window.searchTimeout;
          if (searchTimeout) {
            clearTimeout(searchTimeout);
          }
          
          this.debugLog?.debug('Search form submitted via Enter key, calling searchData...');
          
          if (window.searchData) {
            window.searchData();
            this.debugLog?.info('searchData called successfully');
          } else {
            this.debugLog?.warn('searchData function not available');
          }
          
          return false;
        }
      } catch (error) {
        this.debugLog?.error('Error in search form keydown handler:', error);
      }
    };

    // Search form submit handler
    const searchFormSubmitHandler = (event) => {
      try {
        event.preventDefault();
        this.debugLog?.debug('Search form submitted, calling searchData...');
        
        if (window.searchData) {
          window.searchData();
          this.debugLog?.info('searchData called successfully');
        } else {
          this.debugLog?.warn('searchData function not available');
        }
        
        $("#omni_search").focus();
        return false;
      } catch (error) {
        this.debugLog?.error('Error in search form submit handler:', error);
      }
    };

    $("#search_form :input").on("keydown", searchFormKeydownHandler);
    $("#search_form").on("submit", searchFormSubmitHandler);
    
    this.searchHandlers.set('searchFormKeydown', { element: '#search_form :input', event: 'keydown', handler: searchFormKeydownHandler });
    this.searchHandlers.set('searchFormSubmit', { element: '#search_form', event: 'submit', handler: searchFormSubmitHandler });
    
    this.debugLog?.debug('Search form events attached');
  }

  /**
   * Live search events (lines 836-885 from renderer.js)
   */
  attachLiveSearchEvents() {
    // Omni search input handler
    const omniSearchInputHandler = (event) => {
      try {
        this.debugLog?.debug('Omni search input changed, triggering live search...');
        
        if (window.triggerLiveSearch) {
          window.triggerLiveSearch();
          this.debugLog?.info('triggerLiveSearch called successfully');
        } else {
          this.debugLog?.warn('triggerLiveSearch function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in omni search input handler:', error);
      }
    };

    // Category select change for live search
    const categoryLiveSearchHandler = (event) => {
      try {
        var searchTerm = $("#omni_search").val().trim();
        this.debugLog?.debug('Category select changed, search term', searchTerm);
        
        if (searchTerm.length >= 2) {
          if (window.triggerLiveSearch) {
            window.triggerLiveSearch();
            this.debugLog?.info('triggerLiveSearch called successfully from category change');
          } else {
            this.debugLog?.warn('triggerLiveSearch function not available');
          }
        }
      } catch (error) {
        this.debugLog?.error('Error in category live search handler:', error);
      }
    };

    // Advanced search fields live search
    const advancedLiveSearchHandler = (event) => {
      try {
        this.debugLog?.debug('Advanced search field changed');
        
        // When advanced search is active, trigger live search even if omni_search is empty
        if ($("#advanced-search").is(":visible")) {
          if (window.triggerLiveSearch) {
            window.triggerLiveSearch();
            this.debugLog?.info('triggerLiveSearch called successfully from advanced search');
          } else {
            this.debugLog?.warn('triggerLiveSearch function not available');
          }
        } else {
          var searchTerm = $("#omni_search").val().trim();
          if (searchTerm.length >= 2) {
            if (window.triggerLiveSearch) {
              window.triggerLiveSearch();
              this.debugLog?.info('triggerLiveSearch called successfully from advanced search (with term)');
            } else {
              this.debugLog?.warn('triggerLiveSearch function not available');
            }
          }
        }
      } catch (error) {
        this.debugLog?.error('Error in advanced live search handler:', error);
      }
    };

    $("#omni_search").on("input", omniSearchInputHandler);
    $("#category_select").on("change", categoryLiveSearchHandler);
    $("#title-search, #artist-search, #info-search, #date-search").on("input change", advancedLiveSearchHandler);

    this.searchHandlers.set('omniSearchInput', { element: '#omni_search', event: 'input', handler: omniSearchInputHandler });
    this.searchHandlers.set('categoryLiveSearch', { element: '#category_select', event: 'change', handler: categoryLiveSearchHandler });
    this.searchHandlers.set('advancedLiveSearch', { element: '#title-search, #artist-search, #info-search, #date-search', event: 'input change', handler: advancedLiveSearchHandler });
    
    this.debugLog?.debug('Live search events attached');
  }

  /**
   * Search field navigation events (lines 887-896 from renderer.js)
   */
  attachSearchNavigationEvents() {
    const omniSearchKeydownHandler = (event) => {
      try {
        if (event.code == "Tab") {
          const first_row = $("#search_results tbody tr").first();
          if (first_row.length) {
            $("#selected_row").removeAttr("id");
            first_row.attr("id", "selected_row");
            $("#omni_search").blur();
            return false;
          }
        }
      } catch (error) {
        this.debugLog?.error('Error in omni search keydown handler:', error);
      }
    };

    $("#omni_search").on("keydown", omniSearchKeydownHandler);
    this.searchHandlers.set('omniSearchKeydown', { element: '#omni_search', event: 'keydown', handler: omniSearchKeydownHandler });
    
    this.debugLog?.debug('Search navigation events attached');
  }

  /**
   * Reset button events (lines 898-911 from renderer.js)
   */
  attachResetButtonEvents() {
    const resetButtonHandler = (event) => {
      try {
        this.debugLog?.debug('Reset button clicked');
        
        // Clear any pending live search
        const searchTimeout = window.searchTimeout;
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        
        $("#search_form").trigger("reset");
        $("#omni_search").focus();
        $("#search_results tbody").find("tr").remove();
        $("#search_results thead").hide();
        
        this.debugLog?.info('Search results cleared');
        return false;
      } catch (error) {
        this.debugLog?.error('Error in reset button handler:', error);
      }
    };

    $("#reset_button").on("click", resetButtonHandler);
    this.searchHandlers.set('resetButton', { element: '#reset_button', event: 'click', handler: resetButtonHandler });
    
    this.debugLog?.debug('Reset button events attached');
  }

  /**
   * Advanced search toggle events (lines 913-922 from renderer.js)
   */
  attachAdvancedSearchEvents() {
    const advancedSearchButtonHandler = (event) => {
      try {
        this.debugLog?.debug("Advanced search button clicked");
        
        if (window.toggleAdvancedSearch) {
          window.toggleAdvancedSearch();
          this.debugLog?.info('toggleAdvancedSearch called successfully');
        } else {
          this.debugLog?.warn('toggleAdvancedSearch function not available');
        }
        
        return false;
      } catch (error) {
        this.debugLog?.error('Error in advanced search button handler:', error);
      }
    };

    $("#advanced_search_button").on("click", advancedSearchButtonHandler);
    this.searchHandlers.set('advancedSearchButton', { element: '#advanced_search_button', event: 'click', handler: advancedSearchButtonHandler });
    
    this.debugLog?.debug('Advanced search events attached');
  }

  /**
   * Detach all search events
   */
  detachEvents() {
    try {
      this.debugLog?.info('Detaching search events...');

      for (const [name, handler] of this.searchHandlers) {
        $(handler.element).off(handler.event, handler.handler);
        this.debugLog?.debug(`Removed search handler: ${name}`);
      }

      this.searchHandlers.clear();
      this.eventsAttached = false;
      
      this.debugLog?.info('Search events detached successfully');

    } catch (error) {
      this.debugLog?.error('Failed to detach search events:', error);
    }
  }

  /**
   * Get search events status
   */
  getStatus() {
    return {
      eventsAttached: this.eventsAttached,
      handlerCount: this.searchHandlers.size,
      handlers: Array.from(this.searchHandlers.keys())
    };
  }
}
