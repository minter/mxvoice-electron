/**
 * Advanced Search Module
 * 
 * Handles advanced search functionality including the toggle for
 * showing/hiding advanced search options and managing the UI state.
 */

/**
 * Initialize the advanced search state
 * Ensures the advanced search starts in the correct hidden state
 */
function initializeAdvancedSearch() {
  // Ensure advanced search starts hidden
  const advancedSearchElement = document.getElementById('advanced-search');
  if (advancedSearchElement) {
    advancedSearchElement.style.display = 'none';
    console.log("Advanced search initialized as hidden");
  }
  
  // Ensure icon starts in plus state
  const icon = document.getElementById('advanced-search-icon');
  if (icon) {
    icon.classList.remove('fa-minus');
    icon.classList.add('fa-plus');
    console.log("Advanced search icon initialized as plus");
  }
}

/**
 * Toggle the advanced search interface
 * Shows or hides the advanced search form and manages focus
 */
function toggleAdvancedSearch() {
  try {
    console.log("toggleAdvancedSearch called");

    // Clear any pending live search - use global searchTimeout if available
    if (typeof searchTimeout !== 'undefined') {
      clearTimeout(searchTimeout);
      console.log("Cleared timeout");
    }

    $("#search_form").trigger("reset");
    console.log("Triggered form reset");

    // Clear search results when toggling advanced search
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    console.log("Cleared search results");

    console.log(
      "Advanced search element exists:",
      $("#advanced-search").length > 0
    );
    console.log(
      "Advanced search visible:",
      $("#advanced-search").is(":visible")
    );
    console.log(
      "Advanced search display:",
      $("#advanced-search").css("display")
    );

    // Check current state by looking at the icon and visibility
    const icon = document.getElementById('advanced-search-icon');
    const isIconMinus = icon && icon.classList.contains('fa-minus');
    const isVisible = $("#advanced-search").is(":visible");
    const isCurrentlyOpen = isIconMinus || isVisible;
    
    console.log("Icon indicates advanced search is open:", isIconMinus);
    console.log("Advanced search is visible:", isVisible);
    console.log("Determined advanced search is currently open:", isCurrentlyOpen);

    if (isCurrentlyOpen) {
      console.log("Hiding advanced search");
      $("#advanced-search-icon").removeClass("fa-minus").addClass("fa-plus");
      $("#title-search").hide();
      $("#omni_search").show();
      $("#omni_search").focus();
      
      // Get the DOM element from jQuery object
      const advancedSearchElement = document.getElementById('advanced-search');
      if (advancedSearchElement && typeof animateCSS === 'function') {
        animateCSS(advancedSearchElement, "fadeOutUp").then(() => {
          $("#advanced-search").hide();
          if (typeof scaleScrollable === 'function') {
            scaleScrollable();
          }
          console.log("Advanced search hidden successfully");
        }).catch(error => {
          console.warn("Animation failed, hiding without animation:", error);
          $("#advanced-search").hide();
          if (typeof scaleScrollable === 'function') {
            scaleScrollable();
          }
          console.log("Advanced search hidden successfully (fallback)");
        });
      } else {
        // Fallback if animateCSS is not available
        $("#advanced-search").hide();
        if (typeof scaleScrollable === 'function') {
          scaleScrollable();
        }
        console.log("Advanced search hidden successfully (no animation)");
      }
    } else {
      console.log("Showing advanced search");
      $("#advanced-search-icon").removeClass("fa-plus").addClass("fa-minus");
      $("#advanced-search").show();
      $("#title-search").show();
      $("#title-search").focus();
      $("#omni_search").hide();
      if (typeof scaleScrollable === 'function') {
        scaleScrollable();
      }
      
      // Get the DOM element from jQuery object
      const advancedSearchElement = document.getElementById('advanced-search');
      if (advancedSearchElement && typeof animateCSS === 'function') {
        animateCSS(advancedSearchElement, "fadeInDown").then(() => {
          console.log("Advanced search shown successfully");
        }).catch(error => {
          console.warn("Animation failed, but search is shown:", error);
          console.log("Advanced search shown successfully (fallback)");
        });
      } else {
        console.log("Advanced search shown successfully (no animation)");
      }
    }
  } catch (error) {
    console.error("Error in toggleAdvancedSearch:", error);
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