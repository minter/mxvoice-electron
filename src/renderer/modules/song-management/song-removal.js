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

// Import secure adapters
import { secureFileSystem, secureDatabase, secureStore, securePath } from '../adapters/secure-adapter.js';

/**
 * Deletes a song from the database and removes the associated file
 * Also removes the song from all UI elements (holding tank, hotkeys, search results)
 */
export function deleteSong() {
  const songId = document.getElementById('selected_row')?.getAttribute('songid');
  if (songId) {
    debugLog?.info(`Preparing to delete song ${songId}`, { module: 'song-management', function: 'deleteSong' });
    return secureDatabase.query("SELECT * FROM mrvoice WHERE ID = ?", [songId]).then(async (songResult) => {
      const rows = songResult?.data || songResult;
      const songRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      const filename = songRow?.filename;
    
      return customConfirm(`Are you sure you want to delete ${songRow?.title || 'this song'} from Mx. Voice permanently?`).then(async confirmed => {
      if (confirmed) {
        debugLog?.info("Proceeding with delete", { module: 'song-management', function: 'deleteSong' });
          const delResult = await secureDatabase.execute("DELETE FROM mrvoice WHERE id = ?", [songId]);
          if (!delResult?.success) {
            debugLog?.info("Error deleting song from database", { module: 'song-management', function: 'deleteSong', error: delResult?.error });
            return { success: false, error: delResult?.error || 'Database deletion failed' };
          }

          try {
            const dirResult = await secureStore.get("music_directory");
            const musicDirectory = dirResult?.success && dirResult.value ? dirResult.value : null;
            if (!musicDirectory || !filename) {
              debugLog?.warn('❌ Missing music directory or filename for file delete', { module: 'song-management', function: 'deleteSong' });
            } else {
              const joinResult = await securePath.join(musicDirectory, filename);
              if (joinResult?.success && joinResult.data) {
                const filePath = joinResult.data;
                const delFile = await secureFileSystem.delete(filePath);
                if (!delFile?.success) {
                  debugLog?.warn('❌ Failed to delete file:', { module: 'song-management', function: 'deleteSong', error: delFile?.error });
                } else {
                  debugLog?.info('✅ File deleted successfully', { module: 'song-management', function: 'deleteSong' });
                }
              } else {
                debugLog?.warn('❌ Path join failed:', { module: 'song-management', function: 'deleteSong', result: joinResult });
              }
            }
          } catch (error) {
            debugLog?.warn('❌ Error during file deletion sequence', { module: 'song-management', function: 'deleteSong', error: error?.message });
          }

          // Remove song anywhere it appears
          document.querySelectorAll(`.holding_tank .list-group-item[songid="${songId}"]`).forEach(el => el.remove());
          document.querySelectorAll(`.hotkeys li span[songid="${songId}"]`).forEach(el => el.remove());
          document.querySelectorAll(`.hotkeys li [songid="${songId}"]`).forEach(el => el.removeAttribute('id'));
          document.querySelectorAll(`#search_results tr[songid="${songId}"]`).forEach(el => el.remove());
          if (typeof saveHoldingTankToStore === 'function') saveHoldingTankToStore();
          if (typeof saveHotkeysToStore === 'function') saveHotkeysToStore();

          return { success: true, songId: songId, title: songRow?.title };
      } else {
        return { success: false, error: 'User cancelled' };
      }
      });
    });
  }
}

/**
 * Removes a song from the holding tank
 * Removes immediately without confirmation and updates the store after removal
 */
export function removeFromHoldingTank() {
  const songId = document.getElementById('selected_row')?.getAttribute('songid');
  if (songId) {
    debugLog?.info(`Preparing to remove song ${songId} from holding tank`, { module: 'song-management', function: 'removeFromHoldingTank' });
    return secureDatabase.query("SELECT * FROM mrvoice WHERE ID = ?", [songId]).then(result => {
      const rows = result?.data || result;
      const songRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    
      // Remove immediately without confirmation
      debugLog?.info("Proceeding with removal from holding tank", { module: 'song-management', function: 'removeFromHoldingTank' });
      // Remove the selected row from the holding tank
      document.getElementById('selected_row')?.remove();
      // Clear the selection
      document.getElementById('selected_row')?.removeAttribute('id');
      // Save the updated holding tank to store
      if (typeof saveHoldingTankToStore === 'function') saveHoldingTankToStore();
      return { success: true, songId: songId, title: songRow?.title };
    });
  }
}

/**
 * Removes a song from a hotkey slot
 * Clears the hotkey slot and updates the store
 */
export function removeFromHotkey() {
  const songId = document.getElementById('selected_row')?.getAttribute('songid');
  debugLog?.info("removeFromHotkey called, songId:", { module: 'song-management', function: 'removeFromHotkey', songId: songId });
  debugLog?.info("selected_row element:", { module: 'song-management', function: 'removeFromHotkey', selectedRow: document.getElementById('selected_row') });
  
  if (songId) {
    debugLog?.info(`Preparing to remove song ${songId} from hotkey`, { module: 'song-management', function: 'removeFromHotkey' });
    return secureDatabase.query("SELECT * FROM mrvoice WHERE ID = ?", [songId]).then(result => {
      const rows = result?.data || result;
      const songRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    
      if (songRow) {
        return customConfirm(`Are you sure you want to remove ${songRow.title} from this hotkey?`).then(confirmed => {
        if (confirmed) {
          debugLog?.info("Proceeding with removal from hotkey", { module: 'song-management', function: 'removeFromHotkey' });
          // Clear the hotkey slot
          document.getElementById('selected_row')?.removeAttribute('songid');
          { const span = document.querySelector('#selected_row span'); if (span) span.textContent = ''; }
          // Clear the selection
          document.getElementById('selected_row')?.removeAttribute('id');
          // Save the updated hotkeys to store
            if (typeof saveHotkeysToStore === 'function') saveHotkeysToStore();
          debugLog?.info("Hotkey cleared successfully", { module: 'song-management', function: 'removeFromHotkey' });
          return { success: true, songId: songId, title: songRow.title };
        } else {
          return { success: false, error: 'User cancelled' };
        }
        });
      } else {
        debugLog?.error("Song not found in database for ID:", { module: 'song-management', function: 'removeFromHotkey', songId: songId });
        // Still clear the hotkey even if song not found
        document.getElementById('selected_row')?.removeAttribute('songid');
        { const span2 = document.querySelector('#selected_row span'); if (span2) span2.textContent = ''; }
        document.getElementById('selected_row')?.removeAttribute('id');
        if (typeof saveHotkeysToStore === 'function') saveHotkeysToStore();
      }
    });
  } else {
    debugLog?.info("No songId found on selected row", { module: 'song-management', function: 'removeFromHotkey' });
  }
} 