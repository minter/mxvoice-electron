/**
 * UI Manager Module
 * 
 * Handles core UI management functions including scaling, editing, deletion,
 * and tab management operations.
 * 
 * @module ui-manager
 */

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
      electronAPI.store.set("font-size", fontSize).catch(error => {
        console.warn('❌ Failed to save font size:', error);
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
      console.warn('❌ Song not found for ID:', songId);
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
    console.log("deleteSelectedSong called");
    
    // Check if the selected row is in the holding tank
    if ($("#holding-tank-column").has($("#selected_row")).length) {
      console.log("Selected row is in holding tank");
      // If in holding tank, remove from holding tank
      removeFromHoldingTank();
    } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
      console.log("Selected row is in hotkey tab");
      // If in hotkey tab, remove from hotkey
      removeFromHotkey();
    } else {
      console.log("Selected row is in search results");
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
      console.warn('❌ Song not found for ID:', songId);
      return;
    }
    
    return customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`).then(confirmed => {
      if (confirmed) {
        console.log("Proceeding with removal from holding tank");
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
    console.log("removeFromHotkey called, songId:", songId);
    
    if (!songId) {
      console.log("No songId found on selected row");
      return;
    }
    
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    const songRow = songStmt.get(songId);
    
    if (songRow) {
      return customConfirm(`Are you sure you want to remove ${songRow.title} from this hotkey?`).then(confirmed => {
        if (confirmed) {
          console.log("Proceeding with removal from hotkey");
          $("#selected_row").removeAttr("songid");
          $("#selected_row span").html("");
          $("#selected_row").removeAttr("id");
          saveHotkeysToStore();
          console.log("Hotkey cleared successfully");
          return { success: true, songId: songId, title: songRow.title };
        } else {
          return { success: false, error: 'User cancelled' };
        }
      });
    } else {
      console.error("Song not found in database for ID:", songId);
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
    
    console.log(`Preparing to delete song ${songId}`);
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    const songRow = songStmt.get(songId);
    const filename = songRow.filename;
    
    return customConfirm(`Are you sure you want to delete ${songRow.title} from Mx. Voice permanently?`).then(confirmed => {
      if (confirmed) {
        console.log("Proceeding with delete");
        const deleteStmt = db.prepare("DELETE FROM mrvoice WHERE id = ?");
        if (deleteStmt.run(songId)) {
          // Delete file if electronAPI is available
          if (electronAPI && electronAPI.store) {
            electronAPI.store.get("music_directory").then(musicDirectory => {
              if (musicDirectory.success && musicDirectory.value) {
                electronAPI.path.join(musicDirectory.value, filename).then(joinResult => {
                  if (joinResult.success) {
                    const filePath = joinResult.data;
                    electronAPI.fileSystem.delete(filePath).then(result => {
                      if (result.success) {
                        console.log('✅ File deleted successfully');
                      } else {
                        console.warn('❌ Failed to delete file:', result.error);
                      }
                    }).catch(error => {
                      console.warn('❌ File deletion error:', error);
                    });
                  } else {
                    console.warn('❌ Failed to join path:', joinResult.error);
                  }
                }).catch(error => {
                  console.warn('❌ Path join error:', error);
                });
              }
            }).catch(error => {
              console.warn('❌ Store get API error:', error);
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
          console.log("Error deleting song from database");
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
    customConfirm(`Are you sure you want to close all open Holding Tanks and Hotkeys?`, function() {
      // Use new store API for cleanup operations
      if (electronAPI && electronAPI.store) {
        Promise.all([
          electronAPI.store.delete("holding_tank"),
          electronAPI.store.delete("hotkeys"),
          electronAPI.store.delete("column_order"),
          electronAPI.store.delete("font-size")
        ]).then(() => {
          console.log('✅ All tabs closed successfully');
          location.reload();
        }).catch(error => {
          console.warn('❌ Failed to close tabs:', error);
          // Fallback to legacy store access
          if (store) {
            store.delete("holding_tank");
            store.delete("hotkeys");
            store.delete("column_order");
            store.delete("font-size");
          }
          location.reload();
        });
      } else if (store) {
        // Fallback to legacy store access
        store.delete("holding_tank");
        store.delete("hotkeys");
        store.delete("column_order");
        store.delete("font-size");
        location.reload();
      }
    });
  }
  
  /**
   * Save holding tank to store
   */
  function saveHoldingTankToStore() {
    const currentHtml = $("#holding-tank-column").html();
    if (currentHtml.includes("mode-toggle")) {
      if (electronAPI && electronAPI.store) {
        electronAPI.store.set("holding_tank", currentHtml).catch(error => {
          console.warn('❌ Failed to save holding tank:', error);
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
        electronAPI.store.set("hotkeys", currentHtml).catch(error => {
          console.warn('❌ Failed to save hotkeys:', error);
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