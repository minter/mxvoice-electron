/**
 * Song Removal Operations
 * 
 * Handles deleting songs from the database and removing songs from
 * holding tank and hotkey collections
 */

/**
 * Deletes a song from the database and removes the associated file
 * Also removes the song from all UI elements (holding tank, hotkeys, search results)
 */
export function deleteSong() {
  var songId = $("#selected_row").attr("songid");
  if (songId) {
    console.log(`Preparing to delete song ${songId}`);
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    var songRow = songStmt.get(songId);
    var filename = songRow.filename;
    
    customConfirm(`Are you sure you want to delete ${songRow.title} from Mx. Voice permanently?`, function() {
      console.log("Proceeding with delete");
      const deleteStmt = db.prepare("DELETE FROM mrvoice WHERE id = ?");
      if (deleteStmt.run(songId)) {
        window.electronAPI.store.get("music_directory").then(musicDirectory => {
          window.electronAPI.path.join(musicDirectory.value, filename).then(joinResult => {
            if (joinResult.success) {
              const filePath = joinResult.data;
              window.electronAPI.fileSystem.delete(filePath).then(result => {
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
          // Remove song anywhere it appears
          $(`.holding_tank .list-group-item[songid=${songId}]`).remove();
          $(`.hotkeys li span[songid=${songId}]`).remove();
          $(`.hotkeys li [songid=${songId}]`).removeAttr("id");
          $(`#search_results tr[songid=${songId}]`).remove();
          saveHoldingTankToStore();
          saveHotkeysToStore();
        });
      } else {
        console.log("Error deleting song from database");
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
    console.log(`Preparing to remove song ${songId} from holding tank`);
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    var songRow = songStmt.get(songId);
    
    customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`, function() {
      console.log("Proceeding with removal from holding tank");
      // Remove the selected row from the holding tank
      $("#selected_row").remove();
      // Clear the selection
      $("#selected_row").removeAttr("id");
      // Save the updated holding tank to store
      saveHoldingTankToStore();
    });
  }
}

/**
 * Removes a song from a hotkey slot
 * Clears the hotkey slot and updates the store
 */
export function removeFromHotkey() {
  var songId = $("#selected_row").attr("songid");
  console.log("removeFromHotkey called, songId:", songId);
  console.log("selected_row element:", $("#selected_row"));
  
  if (songId) {
    console.log(`Preparing to remove song ${songId} from hotkey`);
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
    var songRow = songStmt.get(songId);
    
    if (songRow) {
      customConfirm(`Are you sure you want to remove ${songRow.title} from this hotkey?`, function() {
        console.log("Proceeding with removal from hotkey");
        // Clear the hotkey slot
        $("#selected_row").removeAttr("songid");
        $("#selected_row span").html("");
        // Clear the selection
        $("#selected_row").removeAttr("id");
        // Save the updated hotkeys to store
        saveHotkeysToStore();
        console.log("Hotkey cleared successfully");
      });
    } else {
      console.error("Song not found in database for ID:", songId);
      // Still clear the hotkey even if song not found
      $("#selected_row").removeAttr("songid");
      $("#selected_row span").html("");
      $("#selected_row").removeAttr("id");
      saveHotkeysToStore();
    }
  } else {
    console.log("No songId found on selected row");
  }
} 