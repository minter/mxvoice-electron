/**
 * Controls Module
 * 
 * Handles UI control functions including font size adjustments, waveform display,
 * and advanced search toggles.
 * 
 * @module controls
 */

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
          console.warn('❌ Failed to save font size:', error);
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
          console.warn('❌ Failed to save font size:', error);
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
      animateCSS($("#waveform"), "fadeInUp").then(() => {});
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
      console.log("toggleAdvancedSearch called");

      // Clear any pending live search
      clearTimeout(searchTimeout);
      console.log("Cleared timeout");

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

      if ($("#advanced-search").is(":visible")) {
        console.log("Hiding advanced search");
        $("#advanced-search-icon").toggleClass("fa-plus fa-minus");
        $("#title-search").hide();
        $("#omni_search").show();
        $("#omni_search").focus();
        animateCSS($("#advanced-search"), "fadeOutUp").then(() => {
          $("#advanced-search").hide();
          scale_scrollable();
        });
      } else {
        console.log("Showing advanced search");
        $("#advanced-search-icon").toggleClass("fa-plus fa-minus");
        $("#advanced-search").show();
        $("#title-search").show();
        $("#title-search").focus();
        $("#omni_search").hide();
        scale_scrollable();
        animateCSS($("#advanced-search"), "fadeInDown").then(() => {});
      }
    } catch (error) {
      console.error("Error in toggleAdvancedSearch:", error);
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
export default {
  initializeControls
}; 