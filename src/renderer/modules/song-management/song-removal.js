/**
 * Song Removal Operations
 * 
 * Handles deleting songs from the database and removing songs from
 * holding tank and hotkey collections
 */

// Import debug logger
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Deletes a song from the database and removes the associated file
 * Also removes the song from all UI elements (holding tank, hotkeys, search results)
 */
export function deleteSong() {
  var songId = $("#selected_row").attr("songid");
  if (songId) {
    debugLog?.info(`Preparing to delete song ${songId}`, { module: 'song-management', function: 'deleteSong' });
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    var songRow = songStmt.get(songId);
    var filename = songRow.filename;
    
    return customConfirm(`Are you sure you want to delete ${songRow.title} from Mx. Voice permanently?`).then(confirmed => {
      if (confirmed) {
        debugLog?.info("Proceeding with delete", { module: 'song-management', function: 'deleteSong' });
        const deleteStmt = db.prepare("DELETE FROM mrvoice WHERE id = ?");
        if (deleteStmt.run(songId)) {
          window.electronAPI.store.get("music_directory").then(musicDirectory => {
            window.electronAPI.path.join(musicDirectory.value, filename).then(joinResult => {
              if (joinResult.success) {
                const filePath = joinResult.data;
                window.electronAPI.fileSystem.delete(filePath).then(result => {
                  if (result.success) {
                    debugLog?.info('✅ File deleted successfully', { module: 'song-management', function: 'deleteSong' });
                  } else {
                    debugLog?.warn('❌ Failed to delete file:', { module: 'song-management', function: 'deleteSong', error: result.error });
                  }
                }).catch(error => {
                  debugLog?.warn('❌ File deletion error:', { module: 'song-management', function: 'deleteSong', error: error });
                });
              } else {
                debugLog?.warn('❌ Failed to join path:', { module: 'song-management', function: 'deleteSong', error: joinResult.error });
              }
            }).catch(error => {
              debugLog?.warn('❌ Path join error:', { module: 'song-management', function: 'deleteSong', error: error });
            });
            // Remove song anywhere it appears
            $(`.holding_tank .list-group-item[songid=${songId}]`).remove();
            $(`.hotkeys li span[songid=${songId}]`).remove();
            $(`.hotkeys li [songid=${songId}]`).removeAttr("id");
            $(`#search_results tr[songid=${songId}]`).remove();
            saveHoldingTankToStore();
            saveHotkeysToStore();
          });
          return { success: true, songId: songId, title: songRow.title };
        } else {
          debugLog?.info("Error deleting song from database", { module: 'song-management', function: 'deleteSong' });
          return { success: false, error: 'Database deletion failed' };
        }
      } else {
        return { success: false, error: 'User cancelled' };
      }
    });
  }
}

/**
 * Removes a song from the holding tank
 * Prompts for confirmation and updates the store after removal
 */
export function removeFromHoldingTank() {
  var songId = $("#selected_row").attr("songid");
  if (songId) {
    debugLog?.info(`Preparing to remove song ${songId} from holding tank`, { module: 'song-management', function: 'removeFromHoldingTank' });
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    var songRow = songStmt.get(songId);
    
    return customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`).then(confirmed => {
      if (confirmed) {
        debugLog?.info("Proceeding with removal from holding tank", { module: 'song-management', function: 'removeFromHoldingTank' });
        // Remove the selected row from the holding tank
        $("#selected_row").remove();
        // Clear the selection
        $("#selected_row").removeAttr("id");
        // Save the updated holding tank to store
        saveHoldingTankToStore();
        return { success: true, songId: songId, title: songRow.title };
      } else {
        return { success: false, error: 'User cancelled' };
      }
    });
  }
}

/**
 * Removes a song from a hotkey slot
 * Clears the hotkey slot and updates the store
 */
export function removeFromHotkey() {
  var songId = $("#selected_row").attr("songid");
  debugLog?.info("removeFromHotkey called, songId:", { module: 'song-management', function: 'removeFromHotkey', songId: songId });
  debugLog?.info("selected_row element:", { module: 'song-management', function: 'removeFromHotkey', selectedRow: $("#selected_row") });
  
  if (songId) {
    debugLog?.info(`Preparing to remove song ${songId} from hotkey`, { module: 'song-management', function: 'removeFromHotkey' });
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    var songRow = songStmt.get(songId);
    
    if (songRow) {
      return customConfirm(`Are you sure you want to remove ${songRow.title} from this hotkey?`).then(confirmed => {
        if (confirmed) {
          debugLog?.info("Proceeding with removal from hotkey", { module: 'song-management', function: 'removeFromHotkey' });
          // Clear the hotkey slot
          $("#selected_row").removeAttr("songid");
          $("#selected_row span").html("");
          // Clear the selection
          $("#selected_row").removeAttr("id");
          // Save the updated hotkeys to store
          saveHotkeysToStore();
          debugLog?.info("Hotkey cleared successfully", { module: 'song-management', function: 'removeFromHotkey' });
          return { success: true, songId: songId, title: songRow.title };
        } else {
          return { success: false, error: 'User cancelled' };
        }
      });
    } else {
      debugLog?.error("Song not found in database for ID:", { module: 'song-management', function: 'removeFromHotkey', songId: songId });
      // Still clear the hotkey even if song not found
      $("#selected_row").removeAttr("songid");
      $("#selected_row span").html("");
      $("#selected_row").removeAttr("id");
      saveHotkeysToStore();
    }
  } else {
    debugLog?.info("No songId found on selected row", { module: 'song-management', function: 'removeFromHotkey' });
  }
} 