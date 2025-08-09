/**
 * Controls Module
 * 
 * Handles UI control functions including font size adjustments, waveform display,
 * and advanced search toggles.
 * 
 * @module controls
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
 * Initialize the Controls module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Controls interface
 */
function initializeControls(options = {}) {
  const { electronAPI, db, store } = options;
  let fontSize = 11; // Default font size
  
  /**
   * Increase font size
   */
  function increaseFontSize() {
    if (fontSize < 25) {
      fontSize++;
      $(".song").css("font-size", fontSize + "px");
      if (electronAPI && electronAPI.store) {
        electronAPI.store.set("font-size", fontSize).catch(error => {
          debugLog?.warn('Failed to save font size', { 
            module: 'ui-controls',
            function: 'increaseFontSize',
            error: error
          });
        });
      } else if (store) {
        store.set("font-size", fontSize);
      }
    }
  }
  
  /**
   * Decrease font size
   */
  function decreaseFontSize() {
    if (fontSize > 5) {
      fontSize--;
      $(".song").css("font-size", fontSize + "px");
      if (electronAPI && electronAPI.store) {
        electronAPI.store.set("font-size", fontSize).catch(error => {
          debugLog?.warn('Failed to save font size', { 
            module: 'ui-controls',
            function: 'decreaseFontSize',
            error: error
          });
        });
      } else if (store) {
        store.set("font-size", fontSize);
      }
    }
  }
  
  /**
   * Toggle waveform display
   */
  function toggleWaveform() {
    if ($("#waveform").hasClass("hidden")) {
      $("#waveform").removeClass("hidden");
      $("#waveform_button").addClass("active");
      animateCSS($("#waveform"), "fadeInUp").then(() => {
        // Create WaveSurfer when waveform becomes visible
        if (window.sharedState && window.sharedState.get('createWaveSurfer')) {
          window.sharedState.get('createWaveSurfer')();
        }
      });
    } else {
      $("#waveform_button").removeClass("active");
      animateCSS($("#waveform"), "fadeOutDown").then(() => {
        $("#waveform").addClass("hidden");
      });
    }
  }
  
  /**
   * Toggle advanced search display
   */
  function toggleAdvancedSearch() {
    try {
      debugLog?.info("toggleAdvancedSearch called", { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch'
      });

      // Clear any pending live search using global searchTimeout
      if (window.searchTimeout) {
        clearTimeout(window.searchTimeout);
      }
      debugLog?.info("Cleared timeout", { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch'
      });

      $("#search_form").trigger("reset");
      debugLog?.info("Triggered form reset", { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch'
      });

      // Clear search results when toggling advanced search
      $("#search_results tbody").find("tr").remove();
      $("#search_results thead").hide();
      debugLog?.info("Cleared search results", { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch'
      });

      debugLog?.info("Advanced search element exists: " + $("#advanced-search").length > 0, { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch'
      });
      debugLog?.info("Advanced search visible: " + $("#advanced-search").is(":visible"), { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch'
      });
      debugLog?.info("Advanced search display: " + $("#advanced-search").css("display"), { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch'
      });

      if ($("#advanced-search").is(":visible")) {
        debugLog?.info("Hiding advanced search", { 
          module: 'ui-controls',
          function: 'toggleAdvancedSearch'
        });
        $("#advanced-search-icon").toggleClass("fa-plus fa-minus");
        $("#title-search").hide();
        $("#omni_search").show();
        $("#omni_search").focus();
        animateCSS($("#advanced-search"), "fadeOutUp").then(() => {
          $("#advanced-search").hide();
          scale_scrollable();
        });
      } else {
        debugLog?.info("Showing advanced search", { 
          module: 'ui-controls',
          function: 'toggleAdvancedSearch'
        });
        $("#advanced-search-icon").toggleClass("fa-plus fa-minus");
        $("#advanced-search").show();
        $("#title-search").show();
        $("#title-search").focus();
        $("#omni_search").hide();
        scale_scrollable();
        animateCSS($("#advanced-search"), "fadeInDown").then(() => {});
      }
    } catch (error) {
      debugLog?.error("Error in toggleAdvancedSearch", { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch',
        error: error
      });
    }
  }
  
  /**
   * Scale scrollable elements (helper function for advanced search)
   */
  function scale_scrollable() {
    const advancedSearchHeight = $("#advanced-search").is(":visible") ? 38 : 0;
    const height = $(window).height() - 240 - advancedSearchHeight + "px";
    $(".table-wrapper-scroll-y").height(height);
  }
  
  /**
   * Animate CSS helper function
   * @param {jQuery} element - Element to animate
   * @param {string} animation - Animation name
   * @param {string} speed - Animation speed
   * @param {string} prefix - CSS prefix
   * @returns {Promise} Animation promise
   */
  function animateCSS(element, animation, speed = "", prefix = "animate__") {
    return new Promise((resolve, reject) => {
      const animationName = `${prefix}${animation} ${speed}`;
      const node = element;

      node.addClass(`${prefix}animated ${animationName}`);

      function handleAnimationEnd() {
        node.removeClass(`${prefix}animated ${animationName}`);
        node.off("animationend", handleAnimationEnd);
        resolve("Animation ended");
      }

      node.on("animationend", handleAnimationEnd);
    });
  }
  
  return {
    increaseFontSize,
    decreaseFontSize,
    toggleWaveform,
    toggleAdvancedSearch
  };
}

export {
  initializeControls
};

// Default export for module loading
export default initializeControls; 