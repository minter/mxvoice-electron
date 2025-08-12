/**
 * Advanced Search Module
 * 
 * Handles advanced search functionality including the toggle for
 * showing/hiding advanced search options and managing the UI state.
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

/**
 * Initialize the advanced search state
 * Ensures the advanced search starts in the correct hidden state
 */
function initializeAdvancedSearch() {
  // Ensure advanced search starts hidden
  const advancedSearchElement = document.getElementById('advanced-search');
  if (advancedSearchElement) {
    advancedSearchElement.style.display = 'none';
    debugLog?.info("Advanced search initialized as hidden", { 
      module: 'advanced-search',
      function: 'initializeAdvancedSearch'
    });
  }
  
  // Ensure icon starts in plus state
  const icon = document.getElementById('advanced-search-icon');
  if (icon) {
    icon.classList.remove('fa-minus');
    icon.classList.add('fa-plus');
    debugLog?.info("Advanced search icon initialized as plus", { 
      module: 'advanced-search',
      function: 'initializeAdvancedSearch'
    });
  }
}

/**
 * Toggle the advanced search interface
 * Shows or hides the advanced search form and manages focus
 */
function toggleAdvancedSearch() {
  try {
    debugLog?.info("toggleAdvancedSearch called", { 
      module: 'advanced-search',
      function: 'toggleAdvancedSearch'
    });

    // Clear any pending live search - use global searchTimeout if available
    if (window.searchTimeout) {
      clearTimeout(window.searchTimeout);
      debugLog?.info("Cleared timeout", { 
        module: 'advanced-search',
        function: 'toggleAdvancedSearch'
      });
    }

    const form = document.getElementById('search_form');
    if (form) form.reset();
    debugLog?.info("Triggered form reset", { 
      module: 'advanced-search',
      function: 'toggleAdvancedSearch'
    });

    // Clear search results when toggling advanced search
    const tbody = document.querySelector('#search_results tbody');
    const thead = document.querySelector('#search_results thead');
    if (tbody) tbody.querySelectorAll('tr').forEach(tr => tr.remove());
    if (thead) thead.style.display = 'none';
    debugLog?.info("Cleared search results", { 
      module: 'advanced-search',
      function: 'toggleAdvancedSearch'
    });

    debugLog?.info(
      "Advanced search element exists:",
      { 
        module: 'advanced-search',
        function: 'toggleAdvancedSearch',
        exists: document.getElementById('advanced-search') ? 1 : 0
      }
    );
    debugLog?.info(
      "Advanced search visible:",
      { 
        module: 'advanced-search',
        function: 'toggleAdvancedSearch',
        visible: !!(document.getElementById('advanced-search') && document.getElementById('advanced-search').offsetParent !== null)
      }
    );
    debugLog?.info(
      "Advanced search display:",
      { 
        module: 'advanced-search',
        function: 'toggleAdvancedSearch',
        display: document.getElementById('advanced-search')?.style.display || ''
      }
    );

    // Check current state by looking at the icon and visibility
    const icon = document.getElementById('advanced-search-icon');
    const isIconMinus = icon && icon.classList.contains('fa-minus');
    const isVisible = !!(document.getElementById('advanced-search') && document.getElementById('advanced-search').offsetParent !== null);
    const isCurrentlyOpen = isIconMinus || isVisible;
    
    debugLog?.info("Icon indicates advanced search is open:", { 
      module: 'advanced-search',
      function: 'toggleAdvancedSearch',
      isIconMinus: isIconMinus
    });
    debugLog?.info("Advanced search is visible:", { 
      module: 'advanced-search',
      function: 'toggleAdvancedSearch',
      isVisible: isVisible
    });
    debugLog?.info("Determined advanced search is currently open:", { 
      module: 'advanced-search',
      function: 'toggleAdvancedSearch',
      isCurrentlyOpen: isCurrentlyOpen
    });

    if (isCurrentlyOpen) {
      debugLog?.info("Hiding advanced search", { 
        module: 'advanced-search',
        function: 'toggleAdvancedSearch'
      });
      const iconEl = document.getElementById('advanced-search-icon');
      iconEl?.classList.remove('fa-minus');
      iconEl?.classList.add('fa-plus');
      const titleEl = document.getElementById('title-search');
      const omniEl = document.getElementById('omni_search');
      if (titleEl) titleEl.style.display = 'none';
      if (omniEl) { omniEl.style.display = ''; omniEl.focus(); }
      
      // Get the DOM element from jQuery object
      const advancedSearchElement = document.getElementById('advanced-search');
      if (advancedSearchElement && typeof animateCSS === 'function') {
        animateCSS(advancedSearchElement, "fadeOutUp").then(() => {
          const advEl = document.getElementById('advanced-search');
          if (advEl) advEl.style.display = 'none';
          if (typeof scaleScrollable === 'function') {
            scaleScrollable();
          }
          debugLog?.info("Advanced search hidden successfully", { 
            module: 'advanced-search',
            function: 'toggleAdvancedSearch'
          });
        }).catch(error => {
          debugLog?.warn("Animation failed, hiding without animation:", { 
            module: 'advanced-search',
            function: 'toggleAdvancedSearch',
            error: error.message
          });
          const advEl2 = document.getElementById('advanced-search');
          if (advEl2) advEl2.style.display = 'none';
          if (typeof scaleScrollable === 'function') {
            scaleScrollable();
          }
          debugLog?.info("Advanced search hidden successfully (fallback)", { 
            module: 'advanced-search',
            function: 'toggleAdvancedSearch'
          });
        });
      } else {
        // Fallback if animateCSS is not available
        const advEl3 = document.getElementById('advanced-search');
        if (advEl3) advEl3.style.display = 'none';
        if (typeof scaleScrollable === 'function') {
          scaleScrollable();
        }
        debugLog?.info("Advanced search hidden successfully (no animation)", { 
          module: 'advanced-search',
          function: 'toggleAdvancedSearch'
        });
      }
    } else {
      debugLog?.info("Showing advanced search", { 
        module: 'advanced-search',
        function: 'toggleAdvancedSearch'
      });
      const iconEl2 = document.getElementById('advanced-search-icon');
      iconEl2?.classList.remove('fa-plus');
      iconEl2?.classList.add('fa-minus');
      const advEl = document.getElementById('advanced-search');
      const titleEl2 = document.getElementById('title-search');
      const omniEl2 = document.getElementById('omni_search');
      if (advEl) advEl.style.display = '';
      if (titleEl2) { titleEl2.style.display = ''; titleEl2.focus(); }
      if (omniEl2) omniEl2.style.display = 'none';
      if (typeof scaleScrollable === 'function') {
        scaleScrollable();
      }
      
      // Get the DOM element from jQuery object
      const advancedSearchElement = document.getElementById('advanced-search');
      if (advancedSearchElement && typeof animateCSS === 'function') {
        animateCSS(advancedSearchElement, "fadeInDown").then(() => {
          debugLog?.info("Advanced search shown successfully", { 
            module: 'advanced-search',
            function: 'toggleAdvancedSearch'
          });
        }).catch(error => {
          debugLog?.warn("Animation failed, but search is shown:", { 
            module: 'advanced-search',
            function: 'toggleAdvancedSearch',
            error: error.message
          });
          debugLog?.info("Advanced search shown successfully (fallback)", { 
            module: 'advanced-search',
            function: 'toggleAdvancedSearch'
          });
        });
      } else {
        debugLog?.info("Advanced search shown successfully (no animation)", { 
          module: 'advanced-search',
          function: 'toggleAdvancedSearch'
        });
      }
    }
  } catch (error) {
    debugLog?.error("Error in toggleAdvancedSearch:", { 
      module: 'advanced-search',
      function: 'toggleAdvancedSearch',
      error: error.message
    });
  }
}

// Export individual functions for direct access
export {
  toggleAdvancedSearch,
  initializeAdvancedSearch
};

// Default export for module loading
export default {
  toggleAdvancedSearch,
  initializeAdvancedSearch
}; 