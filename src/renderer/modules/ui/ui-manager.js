/**
 * UI Manager Module
 * 
 * Handles core UI management functions including scaling, editing, deletion,
 * and tab management operations.
 * 
 * @module ui-manager
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

// Import secure adapters
import { secureFileSystem, secureStore, securePath } from '../adapters/secure-adapter.js';

/**
 * Initialize the UI Manager module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} UI Manager interface
 */
function initializeUIManager(options = {}) {
  const { electronAPI, db, store } = options;
  let fontSize = 11; // Default font size
  
  /**
   * Scale scrollable elements based on window size and advanced search visibility
   */
  function scaleScrollable() {
    const advancedSearchHeight = $("#advanced-search").is(":visible") ? 38 : 0;
    const height = $(window).height() - 240 - advancedSearchHeight + "px";
    $(".table-wrapper-scroll-y").height(height);
  }
  
  /**
   * Get current font size
   * @returns {number} Current font size
   */
  function getFontSize() {
    return fontSize;
  }
  
  /**
   * Set font size
   * @param {number} size - New font size
   */
  function setFontSize(size) {
    fontSize = size;
    $(".song").css("font-size", fontSize + "px");
    if (electronAPI && electronAPI.store) {
      secureStore.set("font-size", fontSize).catch(error => {
        debugLog?.warn('Failed to save font size', { 
          module: 'ui-manager',
          function: 'setFontSize',
          error: error
        });
      });
    }
  }
  
  /**
   * Edit the currently selected song
   */
  function editSelectedSong() {
    const songId = $("#selected_row").attr("songid");
    if (!songId) return;
    
    const stmt = db.prepare("SELECT * FROM mrvoice WHERE id = ?");
    const songInfo = stmt.get(songId);
    
    if (!songInfo) {
      debugLog?.warn('Song not found for ID', { 
        module: 'ui-manager',
        function: 'editSelectedSong',
        songId: songId
      });
      return;
    }
    
    // Populate form fields
    $("#song-form-songid").val(songId);
    $("#song-form-category").empty();
    
    // Populate categories
    const categoryStmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
    for (const row of categoryStmt.iterate()) {
      const selected = row.code === songInfo.category ? 'selected="selected"' : '';
      $("#song-form-category").append(
        `<option ${selected} value="${row.code}">${row.description}</option>`
      );
    }
    
    $("#song-form-title").val(songInfo.title);
    $("#song-form-artist").val(songInfo.artist);
    $("#song-form-info").val(songInfo.info);
    $("#song-form-duration").val(songInfo.time);
    
    // Set up form for editing
    $("#songFormModal form").attr("onsubmit", "saveEditedSong(event)");
    $("#songFormModalTitle").html("Edit This Song");
    $("#songFormSubmitButton").html("Save");
    $("#songFormModal").modal();
  }
  
  /**
   * Delete the currently selected song
   */
  function deleteSelectedSong() {
    debugLog?.info("deleteSelectedSong called", { 
      module: 'ui-manager',
      function: 'deleteSelectedSong'
    });
    
    // Check if the selected row is in the holding tank
    if ($("#holding-tank-column").has($("#selected_row")).length) {
      debugLog?.info("Selected row is in holding tank", { 
        module: 'ui-manager',
        function: 'deleteSelectedSong'
      });
      // If in holding tank, remove from holding tank
      removeFromHoldingTank();
    } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
      debugLog?.info("Selected row is in hotkey tab", { 
        module: 'ui-manager',
        function: 'deleteSelectedSong'
      });
      // If in hotkey tab, remove from hotkey
      removeFromHotkey();
    } else {
      debugLog?.info("Selected row is in search results", { 
        module: 'ui-manager',
        function: 'deleteSelectedSong'
      });
      // If not in holding tank or hotkey, delete from database
      deleteSong();
    }
  }
  
  /**
   * Remove song from holding tank
   */
  function removeFromHoldingTank() {
    const songId = $("#selected_row").attr("songid");
    if (!songId) return;
    
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    const songRow = songStmt.get(songId);
    
    if (!songRow) {
      debugLog?.warn('Song not found for ID', { 
        module: 'ui-manager',
        function: 'removeFromHoldingTank',
        songId: songId
      });
      return;
    }
    
    return customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`).then(confirmed => {
      if (confirmed) {
        debugLog?.info("Proceeding with removal from holding tank", { 
          module: 'ui-manager',
          function: 'removeFromHoldingTank',
          songId: songId,
          title: songRow.title
        });
        $("#selected_row").remove();
        $("#selected_row").removeAttr("id");
        saveHoldingTankToStore();
        return { success: true, songId: songId, title: songRow.title };
      } else {
        return { success: false, error: 'User cancelled' };
      }
    });
  }
  
  /**
   * Remove song from hotkey
   */
  function removeFromHotkey() {
    const songId = $("#selected_row").attr("songid");
    debugLog?.info("removeFromHotkey called", { 
      module: 'ui-manager',
      function: 'removeFromHotkey',
      songId: songId
    });
    
    if (!songId) {
      debugLog?.info("No songId found on selected row", { 
        module: 'ui-manager',
        function: 'removeFromHotkey'
      });
      return;
    }
    
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    const songRow = songStmt.get(songId);
    
    if (songRow) {
      return customConfirm(`Are you sure you want to remove ${songRow.title} from this hotkey?`).then(confirmed => {
        if (confirmed) {
          debugLog?.info("Proceeding with removal from hotkey", { 
            module: 'ui-manager',
            function: 'removeFromHotkey',
            songId: songId,
            title: songRow.title
          });
          $("#selected_row").removeAttr("songid");
          $("#selected_row span").html("");
          $("#selected_row").removeAttr("id");
          saveHotkeysToStore();
          debugLog?.info("Hotkey cleared successfully", { 
            module: 'ui-manager',
            function: 'removeFromHotkey',
            songId: songId
          });
          return { success: true, songId: songId, title: songRow.title };
        } else {
          return { success: false, error: 'User cancelled' };
        }
      });
    } else {
      debugLog?.error("Song not found in database for ID", { 
        module: 'ui-manager',
        function: 'removeFromHotkey',
        songId: songId
      });
      // Still clear the hotkey even if song not found
      $("#selected_row").removeAttr("songid");
      $("#selected_row span").html("");
      $("#selected_row").removeAttr("id");
      saveHotkeysToStore();
    }
  }
  
  /**
   * Delete song from database
   */
  function deleteSong() {
    const songId = $("#selected_row").attr("songid");
    if (!songId) return;
    
    debugLog?.info(`Preparing to delete song ${songId}`, { 
      module: 'ui-manager',
      function: 'deleteSong',
      songId: songId
    });
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    const songRow = songStmt.get(songId);
    const filename = songRow.filename;
    
    return customConfirm(`Are you sure you want to delete ${songRow.title} from Mx. Voice permanently?`).then(confirmed => {
      if (confirmed) {
        debugLog?.info("Proceeding with delete", { 
          module: 'ui-manager',
          function: 'deleteSong',
          songId: songId,
          title: songRow.title
        });
        const deleteStmt = db.prepare("DELETE FROM mrvoice WHERE id = ?");
        if (deleteStmt.run(songId)) {
          // Delete file if electronAPI is available
          if (electronAPI && electronAPI.store) {
            secureStore.get("music_directory").then(result => {
              // Extract the actual value from the result object
              const musicDirectory = result.success && result.value ? result.value : null;
              if (!musicDirectory) {
                debugLog?.warn('❌ Could not get music directory from store', { 
                  module: 'ui-manager',
                  function: 'deleteSong'
                });
                return;
              }
              securePath.join(musicDirectory, filename).then(joinResult => {
                if (joinResult.success) {
                  const filePath = joinResult.data;
                  secureFileSystem.delete(filePath).then(result => {
                    if (result.success) {
                      debugLog?.info('File deleted successfully', { 
                        module: 'ui-manager',
                        function: 'deleteSong',
                        filePath: filePath
                      });
                    } else {
                      debugLog?.warn('Failed to delete file', { 
                        module: 'ui-manager',
                        function: 'deleteSong',
                        filePath: filePath,
                        error: result.error
                      });
                    }
                  }).catch(error => {
                    debugLog?.warn('File deletion error', { 
                      module: 'ui-manager',
                      function: 'deleteSong',
                      filePath: filePath,
                      error: error
                    });
                  });
                } else {
                  debugLog?.warn('Failed to join path', { 
                    module: 'ui-manager',
                    function: 'deleteSong',
                    musicDirectory: musicDirectory,
                    filename: filename,
                    error: joinResult.error
                  });
                }
              }).catch(error => {
                debugLog?.warn('Path join error', { 
                  module: 'ui-manager',
                  function: 'deleteSong',
                  musicDirectory: musicDirectory,
                  filename: filename,
                  error: error
                });
              });
            }).catch(error => {
              debugLog?.warn('Store get API error', { 
                module: 'ui-manager',
                function: 'deleteSong',
                error: error
              });
            });
          }
          
          // Remove song from UI elements
          $(`.holding_tank .list-group-item[songid=${songId}]`).remove();
          $(`.hotkeys li span[songid=${songId}]`).remove();
          $(`.hotkeys li [songid=${songId}]`).removeAttr("id");
          $(`#search_results tr[songid=${songId}]`).remove();
          saveHoldingTankToStore();
          saveHotkeysToStore();
          return { success: true, songId: songId, title: songRow.title };
        } else {
          debugLog?.info("Error deleting song from database", { 
            module: 'ui-manager',
            function: 'deleteSong',
            songId: songId
          });
          return { success: false, error: 'Database deletion failed' };
        }
      } else {
        return { success: false, error: 'User cancelled' };
      }
    });
  }
  
  /**
   * Close all tabs and clear stored data
   */
  function closeAllTabs() {
    debugLog?.info('closeAllTabs called', { 
      module: 'ui-manager',
      function: 'closeAllTabs'
    });
    customConfirm(`Are you sure you want to close all open Holding Tanks and Hotkeys?`, 'Confirm').then(confirmed => {
      debugLog?.info('User confirmed', { 
        module: 'ui-manager',
        function: 'closeAllTabs',
        confirmed: confirmed
      });
      if (confirmed) {
        debugLog?.info('Starting cleanup operations', { 
          module: 'ui-manager',
          function: 'closeAllTabs'
        });
        debugLog?.info('electronAPI available: ' + !!electronAPI, { 
          module: 'ui-manager',
          function: 'closeAllTabs'
        });
        debugLog?.info('electronAPI.store available: ' + !!(electronAPI && electronAPI.store), { 
          module: 'ui-manager',
          function: 'closeAllTabs'
        });
        debugLog?.info('legacy store available: ' + !!store, { 
          module: 'ui-manager',
          function: 'closeAllTabs'
        });
        
        // Use new store API for cleanup operations
        if (electronAPI && electronAPI.store) {
          debugLog?.info('Using modern store API', { 
            module: 'ui-manager',
            function: 'closeAllTabs'
          });
          Promise.all([
            secureStore.delete("holding_tank"),
            secureStore.delete("hotkeys"),
            secureStore.delete("column_order"),
            secureStore.delete("font-size")
          ]).then(() => {
            debugLog?.info('All tabs closed successfully', { 
              module: 'ui-manager',
              function: 'closeAllTabs'
            });
            debugLog?.info('Reloading page', { 
              module: 'ui-manager',
              function: 'closeAllTabs'
            });
            location.reload();
          }).catch(error => {
            debugLog?.warn('Failed to close tabs', { 
              module: 'ui-manager',
              function: 'closeAllTabs',
              error: error
            });
            // Fallback to legacy store access
            if (store) {
              debugLog?.info('Falling back to legacy store', { 
                module: 'ui-manager',
                function: 'closeAllTabs'
              });
              store.delete("holding_tank");
              store.delete("hotkeys");
              store.delete("column_order");
              store.delete("font-size");
            }
            debugLog?.info('Reloading page after fallback', { 
              module: 'ui-manager',
              function: 'closeAllTabs'
            });
            location.reload();
          });
        } else if (store) {
          // Fallback to legacy store access
          debugLog?.info('Using legacy store API', { 
            module: 'ui-manager',
            function: 'closeAllTabs'
          });
          store.delete("holding_tank");
          store.delete("hotkeys");
          store.delete("column_order");
          store.delete("font-size");
          debugLog?.info('Reloading page', { 
            module: 'ui-manager',
            function: 'closeAllTabs'
          });
          location.reload();
        } else {
          debugLog?.warn('No store API available', { 
            module: 'ui-manager',
            function: 'closeAllTabs'
          });
          debugLog?.info('Reloading page anyway', { 
            module: 'ui-manager',
            function: 'closeAllTabs'
          });
          location.reload();
        }
      } else {
        debugLog?.info('User cancelled the operation', { 
          module: 'ui-manager',
          function: 'closeAllTabs'
        });
      }
    }).catch(error => {
      debugLog?.error('Error in closeAllTabs', { 
        module: 'ui-manager',
        function: 'closeAllTabs',
        error: error
      });
    });
  }
  
  /**
   * Save holding tank to store
   */
  function saveHoldingTankToStore() {
    const currentHtml = $("#holding-tank-column").html();
    if (currentHtml.includes("mode-toggle")) {
      if (electronAPI && electronAPI.store) {
        secureStore.set("holding_tank", currentHtml).catch(error => {
          debugLog?.warn('Failed to save holding tank', { 
            module: 'ui-manager',
            function: 'saveHoldingTankToStore',
            error: error
          });
        });
      } else if (store) {
        store.set("holding_tank", currentHtml);
      }
    }
  }
  
  /**
   * Save hotkeys to store
   */
  function saveHotkeysToStore() {
    const currentHtml = $("#hotkeys-column").html();
    if (currentHtml.includes("header-button")) {
      if (electronAPI && electronAPI.store) {
        secureStore.set("hotkeys", currentHtml).catch(error => {
          debugLog?.warn('Failed to save hotkeys', { 
            module: 'ui-manager',
            function: 'saveHotkeysToStore',
            error: error
          });
        });
      } else if (store) {
        store.set("hotkeys", currentHtml);
      }
    }
  }
  
  return {
    scaleScrollable,
    getFontSize,
    setFontSize,
    editSelectedSong,
    deleteSelectedSong,
    closeAllTabs
  };
}

// Export the initialize function
export { initializeUIManager };

// Default export for module loading
export default initializeUIManager; 