/**
 * Modal Utilities Module
 * 
 * This module contains utility functions for handling modal dialogs
 * in the MxVoice Electron application.
 */

/**
 * Custom confirmation function to replace native confirm() dialogs
 * 
 * @param {string} message - The confirmation message to display
 * @param {Function} callback - The callback function to execute when confirmed
 */
function customConfirm(message, callback) {
  $("#confirmationMessage").text(message);
  $("#confirmationModal").modal("show");

  // Store the callback to execute when confirmed
  $("#confirmationConfirmBtn")
    .off("click")
    .on("click", function () {
      $("#confirmationModal").modal("hide");
      if (callback) {
        callback();
      }
    });
}

/**
 * Custom prompt function to replace native prompt() dialogs
 * 
 * @param {string} title - The modal title
 * @param {string} message - The prompt message
 * @param {string} defaultValue - The default value for the input field
 * @param {Function} callback - The callback function to execute with the input value
 */
function customPrompt(title, message, defaultValue, callback) {
  $("#inputModalTitle").text(title);
  $("#inputModalMessage").text(message);
  $("#inputModalField").val(defaultValue);
  $("#inputModal").modal("show");
  
  // Focus on the input field
  $("#inputModalField").focus();
  
  // Handle Enter key
  $("#inputModalField").off("keypress").on("keypress", function(e) {
    if (e.which === 13) { // Enter key
      $("#inputModalConfirmBtn").click();
    }
  });
  
  $("#inputModalConfirmBtn").off("click").on("click", function () {
    const value = $("#inputModalField").val();
    $("#inputModal").modal("hide");
    if (callback) {
      callback(value);
    }
  });
}

/**
 * Focus restoration after modal dismissal
 * Restores focus to the appropriate search field after a modal is closed
 */
function restoreFocusToSearch() {
  // Small delay to ensure modal is fully closed
  setTimeout(function () {
    if ($("#omni_search").is(":visible")) {
      $("#omni_search").focus();
    } else if ($("#title-search").is(":visible")) {
      $("#title-search").focus();
    }
  }, 100);
}

// Export the modal utilities
module.exports = {
  customConfirm,
  customPrompt,
  restoreFocusToSearch
}; 