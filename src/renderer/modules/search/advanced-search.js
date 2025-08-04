/**
 * Advanced Search Module
 * 
 * Handles advanced search functionality including the toggle for
 * showing/hiding advanced search options and managing the UI state.
 */

/**
 * Toggle the advanced search interface
 * Shows or hides the advanced search form and manages focus
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

module.exports = {
  toggleAdvancedSearch
}; 