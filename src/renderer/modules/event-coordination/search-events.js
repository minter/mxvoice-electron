/**
 * Search Events Module
 * 
 * Handles all search-related event handlers that were previously in renderer.js.
 * Includes search form submission, live search, category filters, and advanced search.
 */

export default class SearchEvents {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = null;
    this.store = null;
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
        const select = document.getElementById('category_select');
        const category = select ? select.selectedIndex : 0;
        this.debugLog?.debug('Category select changed, calling searchData...');
        
        if (window.searchData) {
          window.searchData();
          this.debugLog?.info('searchData called successfully from category change');
        } else {
          this.debugLog?.warn('searchData function not available');
        }
        
        document.getElementById('omni_search')?.focus();
        if (select) select.selectedIndex = category;
      } catch (error) {
        this.debugLog?.error('Error in category select handler:', error);
      }
    };
    const el = document.getElementById('category_select');
    el?.addEventListener('change', categorySelectHandler);
    this.searchHandlers.set('categorySelect', { element: '#category_select', el, event: 'change', handler: categorySelectHandler });
    
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

    const el = document.getElementById('date-search');
    el?.addEventListener('change', dateSearchHandler);
    this.searchHandlers.set('dateSearch', { element: '#date-search', el, event: 'change', handler: dateSearchHandler });
    
    this.debugLog?.debug('Date search events attached');
  }

  /**
   * Search form submission events (lines 799-829 from renderer.js)
   */
  attachSearchFormEvents() {
    // Search form input keydown handler
    const searchFormKeydownHandler = (event) => {
      try {
        // Esc should stop playback even when focus is inside a search field
        if (event.key === 'Escape' || event.code === 'Escape') {
          this.debugLog?.debug('Escape pressed in search input; attempting to stop playback');
          if (window.stopPlaying && typeof window.stopPlaying === 'function') {
            // Support Shift+Esc for fade-out, mirroring global behavior
            window.stopPlaying(Boolean(event.shiftKey));
          } else {
            this.debugLog?.warn('stopPlaying function not available');
          }
          // Cancel any pending live-search debounce to avoid unintended result clearing
          try {
            if (window.searchTimeout) {
              clearTimeout(window.searchTimeout);
              window.searchTimeout = null;
            }
          } catch {}
          event.preventDefault();
          event.stopPropagation();
          return false;
        }

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
        
        document.getElementById('omni_search')?.focus();
        return false;
      } catch (error) {
        this.debugLog?.error('Error in search form submit handler:', error);
      }
    };

    const form = document.getElementById('search_form');
    if (form) {
      form.querySelectorAll(':is(input,select,textarea)').forEach(input => {
        input.addEventListener('keydown', searchFormKeydownHandler);
        this.searchHandlers.set(`searchFormKeydown:${input.name || input.id}`, { element: '#search_form :input', el: input, event: 'keydown', handler: searchFormKeydownHandler });
      });
      form.addEventListener('submit', searchFormSubmitHandler);
      this.searchHandlers.set('searchFormSubmit', { element: '#search_form', el: form, event: 'submit', handler: searchFormSubmitHandler });
    }
    
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
        const searchTerm = (document.getElementById('omni_search')?.value || '').trim();
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
        const adv = document.getElementById('advanced-search');
        if (adv && adv.offsetParent !== null) {
          if (window.triggerLiveSearch) {
            window.triggerLiveSearch();
            this.debugLog?.info('triggerLiveSearch called successfully from advanced search');
          } else {
            this.debugLog?.warn('triggerLiveSearch function not available');
          }
        } else {
          const searchTerm = (document.getElementById('omni_search')?.value || '').trim();
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
    const omni = document.getElementById('omni_search');
    const cat = document.getElementById('category_select');
    const title = document.getElementById('title-search');
    const artist = document.getElementById('artist-search');
    const info = document.getElementById('info-search');
    const date = document.getElementById('date-search');
    omni?.addEventListener('input', omniSearchInputHandler);
    cat?.addEventListener('change', categoryLiveSearchHandler);
    [title, artist, info, date].forEach(el => el?.addEventListener('input', advancedLiveSearchHandler));
    date?.addEventListener('change', advancedLiveSearchHandler);
    this.searchHandlers.set('omniSearchInput', { element: '#omni_search', el: omni, event: 'input', handler: omniSearchInputHandler });
    this.searchHandlers.set('categoryLiveSearch', { element: '#category_select', el: cat, event: 'change', handler: categoryLiveSearchHandler });
    this.searchHandlers.set('advancedLiveSearch:title', { element: '#title-search', el: title, event: 'input', handler: advancedLiveSearchHandler });
    this.searchHandlers.set('advancedLiveSearch:artist', { element: '#artist-search', el: artist, event: 'input', handler: advancedLiveSearchHandler });
    this.searchHandlers.set('advancedLiveSearch:info', { element: '#info-search', el: info, event: 'input', handler: advancedLiveSearchHandler });
    this.searchHandlers.set('advancedLiveSearch:date', { element: '#date-search', el: date, event: 'change', handler: advancedLiveSearchHandler });
    
    this.debugLog?.debug('Live search events attached');
  }

  /**
   * Search field navigation events (lines 887-896 from renderer.js)
   */
  attachSearchNavigationEvents() {
    const omniSearchKeydownHandler = (event) => {
      try {
        if (event.code == "Tab") {
          const firstRow = document.querySelector('#search_results tbody tr');
          if (firstRow) {
            document.getElementById('selected_row')?.removeAttribute('id');
            firstRow.id = 'selected_row';
            document.getElementById('omni_search')?.blur();
            return false;
          }
        }
      } catch (error) {
        this.debugLog?.error('Error in omni search keydown handler:', error);
      }
    };
    const omni = document.getElementById('omni_search');
    omni?.addEventListener('keydown', omniSearchKeydownHandler);
    this.searchHandlers.set('omniSearchKeydown', { element: '#omni_search', el: omni, event: 'keydown', handler: omniSearchKeydownHandler });
    
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
        
        const form = document.getElementById('search_form');
        form?.reset();
        document.getElementById('omni_search')?.focus();
        const tbody = document.querySelector('#search_results tbody');
        tbody?.querySelectorAll('tr').forEach(tr => tr.remove());
        const thead = document.querySelector('#search_results thead');
        if (thead) thead.style.display = 'none';
        
        this.debugLog?.info('Search results cleared');
        return false;
      } catch (error) {
        this.debugLog?.error('Error in reset button handler:', error);
      }
    };
    const resetBtn = document.getElementById('reset_button');
    resetBtn?.addEventListener('click', resetButtonHandler);
    this.searchHandlers.set('resetButton', { element: '#reset_button', el: resetBtn, event: 'click', handler: resetButtonHandler });
    
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

    const advBtn = document.getElementById('advanced_search_button');
    advBtn?.addEventListener('click', advancedSearchButtonHandler);
    this.searchHandlers.set('advancedSearchButton', { element: '#advanced_search_button', el: advBtn, event: 'click', handler: advancedSearchButtonHandler });
    
    this.debugLog?.debug('Advanced search events attached');
  }

  /**
   * Detach all search events
   */
  detachEvents() {
    try {
      this.debugLog?.info('Detaching search events...');

      for (const [name, handler] of this.searchHandlers) {
        handler.el?.removeEventListener(handler.event, handler.handler);
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
