/**
 * Song CRUD Operations
 * 
 * Handles creating, reading, updating, and deleting songs in the database
 * and managing the song form modal interface
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
import { secureFileSystem, secureDatabase, securePath, secureStore } from '../adapters/secure-adapter.js';

/**
 * Saves an edited song to the database
 * Updates song information and refreshes the search results
 * 
 * @param {Event} event - The form submission event
 */
export async function saveEditedSong(event) {
  event.preventDefault();
  $(`#songFormModal`).modal("hide");
  debugLog?.info("Starting edit process", { module: 'song-management', function: 'saveEditedSong' });
  const songId = $("#song-form-songid").val();
  const title = $("#song-form-title").val();
  const artist = $("#song-form-artist").val();
  const info = $("#song-form-info").val();
  const category = $("#song-form-category").val();

  try {
    const result = await secureDatabase.execute(
      "UPDATE mrvoice SET title = ?, artist = ?, category = ?, info = ? WHERE id = ?",
      [title, artist, category, info, songId]
    );
    if (!result?.success) {
      debugLog?.warn('Edit update failed', { module: 'song-management', function: 'saveEditedSong', error: result?.error });
    }
  } catch (error) {
    debugLog?.error('Edit update error', { module: 'song-management', function: 'saveEditedSong', error: error?.message });
  }

  $("#omni_search").val(title);
  if (typeof searchData === 'function') {
    searchData();
  }
}

/**
 * Saves a new song to the database
 * Handles file copying, category creation, and database insertion
 * 
 * @param {Event} event - The form submission event
 */
export function saveNewSong(event) {
  event.preventDefault();
  $(`#songFormModal`).modal("hide");
  debugLog?.info("Starting save process", { module: 'song-management', function: 'saveNewSong' });
  const filename = $("#song-form-filename").val();
  securePath.parse(filename).then(result => {
      if (!result.success || !result.data) {
        debugLog?.warn('❌ Path parse failed:', { module: 'song-management', function: 'saveNewSong', result: result });
        return;
      }
      const pathData = result.data;
      const title = $("#song-form-title").val();
      const artist = $("#song-form-artist").val();
      const info = $("#song-form-info").val();
      let category = $("#song-form-category").val();

      if (category == "--NEW--") {
        const description = $("#song-form-new-category").val();
        let baseCode = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
        const findUniqueCode = async (base, index = 1) => {
          const test = index === 1 ? base : `${base}${index}`;
          const check = await secureDatabase.query("SELECT 1 FROM categories WHERE code = ?", [test]);
          const exists = Array.isArray(check?.data || check) && (check.data || check).length > 0;
          return exists ? findUniqueCode(base, index + 1) : test;
        };
        (async () => {
          const finalCode = await findUniqueCode(baseCode);
          const insert = await secureDatabase.execute("INSERT INTO categories VALUES (?, ?)", [finalCode, description]);
          if (!insert?.success) {
            debugLog?.warn('Category insert failed', { module: 'song-management', function: 'saveNewSong', error: insert?.error });
            return;
          }
          debugLog?.info(`Added new category`, { module: 'song-management', function: 'saveNewSong', code: finalCode });
          if (typeof populateCategorySelect === 'function') populateCategorySelect();
          if (typeof populateCategoriesModal === 'function') populateCategoriesModal();
          category = finalCode;
        })();
      }

      const duration = $("#song-form-duration").val();
      const uuid = (window.secureElectronAPI?.utils?.generateId)
        ? await window.secureElectronAPI.utils.generateId()
        : (typeof uuidv4 === 'function' ? uuidv4() : Date.now().toString());
      const newFilename = `${artist}-${title}-${uuid}${pathData.ext}`.replace(
        /[^-.\w]/g,
        ""
      );
      secureStore.get("music_directory").then(dirResult => {
        const musicDirectory = dirResult?.success ? dirResult.value : null;
        if (!musicDirectory) {
          debugLog?.warn('❌ Could not get music directory from store', { module: 'song-management', function: 'saveNewSong' });
          return;
        }
        securePath.join(musicDirectory, newFilename).then(result => {
          if (!result.success || !result.data) {
            debugLog?.warn('❌ Path join failed:', { module: 'song-management', function: 'saveNewSong', result: result });
            return;
          }
          const newPath = result.data;
          secureDatabase.execute(
            "INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              title,
              artist,
              category,
              info,
              newFilename,
              duration,
              Math.floor(Date.now() / 1000)
            ]
          ).then(() => {
          secureFileSystem.copy(filename, newPath).then(result => {
            if (result.success) {
              debugLog?.info('✅ File copied successfully', { module: 'song-management', function: 'saveNewSong' });
            } else {
              debugLog?.warn('❌ Failed to copy file:', { module: 'song-management', function: 'saveNewSong', error: result.error });
            }
          }).catch(error => {
            debugLog?.warn('❌ File copy error:', { module: 'song-management', function: 'saveNewSong', error: error });
          });

          // Song has been saved, now let's show item
          $("#omni_search").val(title);
          searchData();
          }).catch(error => {
        debugLog?.warn('❌ Path join error:', { module: 'song-management', function: 'saveNewSong', error: error });
        });
      }).catch(error => {
        debugLog?.warn('❌ Store get error:', { module: 'song-management', function: 'saveNewSong', error: error });
      });
  }).catch(error => {
    debugLog?.warn('❌ Path parse error:', { module: 'song-management', function: 'saveNewSong', error: error });
  });
}

/**
 * Opens the song edit modal for the selected song
 * Populates the form with the song's current information
 */
export async function editSelectedSong() {
  try {
    const songId = $("#selected_row").attr("songid");
    if (!songId) {
      debugLog?.warn('No selected song to edit', { module: 'song-management', function: 'editSelectedSong' });
      return;
    }

    // Fetch song info using secure database adapter
    const songResult = await secureDatabase.query("SELECT * FROM mrvoice WHERE id = ?", [songId]);
    const songRows = songResult?.data || songResult;
    const songInfo = Array.isArray(songRows) && songRows.length > 0 ? songRows[0] : null;
    if (!songInfo) {
      debugLog?.warn('Song not found for ID', { module: 'song-management', function: 'editSelectedSong', songId });
      return;
    }

    // Populate basic fields
    $("#song-form-songid").val(songId);
    $("#song-form-title").val(songInfo.title || '');
    $("#song-form-artist").val(songInfo.artist || '');
    $("#song-form-info").val(songInfo.info || '');
    $("#song-form-duration").val(songInfo.time || '');

    // Load categories securely and populate select
    $("#song-form-category").empty();
    const catResult = await secureDatabase.query("SELECT * FROM categories ORDER BY description ASC");
    const categories = (catResult?.data || catResult) || [];
    if (Array.isArray(categories)) {
      categories.forEach(row => {
        const selected = row.code === songInfo.category ? 'selected="selected"' : '';
        $("#song-form-category").append(`<option ${selected} value="${row.code}">${row.description}</option>`);
      });
    }

    // Prepare and show modal
    $("#songFormModal form").attr("onsubmit", "saveEditedSong(event)");
    $("#songFormModalTitle").html("Edit This Song");
    $("#songFormSubmitButton").html("Save");
    $("#songFormModal").modal();
  } catch (error) {
    debugLog?.error('Failed to open edit song modal', { module: 'song-management', function: 'editSelectedSong', error: error?.message });
  }
}

/**
 * Determines the appropriate delete action based on the selected row's location
 * Handles deletion from holding tank, hotkeys, or database
 */
export function deleteSelectedSong() {
  debugLog?.info("deleteSelectedSong called", { module: 'song-management', function: 'deleteSelectedSong' });
  debugLog?.info("selected_row:", { module: 'song-management', function: 'deleteSelectedSong', selectedRow: $("#selected_row") });
  debugLog?.info("holding-tank-column has selected_row:", { module: 'song-management', function: 'deleteSelectedSong', hasSelectedRow: $("#holding-tank-column").has($("#selected_row")).length });
  debugLog?.info("hotkey-tab-content has selected_row:", { module: 'song-management', function: 'deleteSelectedSong', hasSelectedRow: $("#hotkey-tab-content").has($("#selected_row")).length });
  
  // Check if the selected row is in the holding tank
  if ($("#holding-tank-column").has($("#selected_row")).length) {
    debugLog?.info("Selected row is in holding tank", { module: 'song-management', function: 'deleteSelectedSong' });
    // If in holding tank, remove from holding tank
    removeFromHoldingTank();
  } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
    debugLog?.info("Selected row is in hotkey tab", { module: 'song-management', function: 'deleteSelectedSong' });
    // If in hotkey tab, remove from hotkey
    removeFromHotkey();
  } else {
    debugLog?.info("Selected row is in search results", { module: 'song-management', function: 'deleteSelectedSong' });
    // If not in holding tank or hotkey, delete from database
    deleteSong();
  }
} 