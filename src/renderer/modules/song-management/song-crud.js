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
  try { const { hideModal } = await import('../ui/bootstrap-adapter.js'); hideModal('#songFormModal'); } catch {}
  debugLog?.info("Starting edit process", { module: 'song-management', function: 'saveEditedSong' });
  const songId = (document.getElementById('song-form-songid') || {}).value || '';
  const title = (document.getElementById('song-form-title') || {}).value || '';
  const artist = (document.getElementById('song-form-artist') || {}).value || '';
  const info = (document.getElementById('song-form-info') || {}).value || '';
  const category = (document.getElementById('song-form-category') || {}).value || '';

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

  const omni = document.getElementById('omni_search');
  if (omni) omni.value = title;
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
export async function saveNewSong(event) {
  event.preventDefault();
  try { const { hideModal } = await import('../ui/bootstrap-adapter.js'); hideModal('#songFormModal'); } catch {}
  debugLog?.info("Starting save process", { module: 'song-management', function: 'saveNewSong' });
  try {
    const filename = (document.getElementById('song-form-filename') || {}).value || '';
    const parsed = await securePath.parse(filename);
    if (!parsed?.success || !parsed.data) {
      debugLog?.warn('❌ Path parse failed:', { module: 'song-management', function: 'saveNewSong', result: parsed });
      return;
    }
    const pathData = parsed.data;
    const title = (document.getElementById('song-form-title') || {}).value || '';
    const artist = (document.getElementById('song-form-artist') || {}).value || '';
    const info = (document.getElementById('song-form-info') || {}).value || '';
    let category = (document.getElementById('song-form-category') || {}).value || '';

    if (category == "--NEW--") {
      const description = (document.getElementById('song-form-new-category') || {}).value || '';
      const baseCode = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
      const findUniqueCode = async (base, index = 1) => {
        const test = index === 1 ? base : `${base}${index}`;
        const check = await secureDatabase.query("SELECT 1 FROM categories WHERE code = ?", [test]);
        const exists = Array.isArray(check?.data || check) && (check.data || check).length > 0;
        return exists ? findUniqueCode(base, index + 1) : test;
      };
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
    }

    const duration = (document.getElementById('song-form-duration') || {}).value || '';
    let uuid;
    if (window.secureElectronAPI?.utils?.generateId) {
      const uuidResult = await window.secureElectronAPI.utils.generateId();
      uuid = uuidResult?.success && uuidResult?.data ? uuidResult.data : Date.now().toString();
    } else if (typeof uuidv4 === 'function') {
      uuid = uuidv4();
    } else {
      uuid = Date.now().toString();
    }
    const newFilename = `${artist}-${title}-${uuid}${pathData.ext}`.replace(/[^-.\w]/g, "");

    const dirResult = await secureStore.get("music_directory");
    const musicDirectory = dirResult?.success ? dirResult.value : null;
    if (!musicDirectory) {
      debugLog?.warn('❌ Could not get music directory from store', { module: 'song-management', function: 'saveNewSong' });
      return;
    }
    const joinResult = await securePath.join(musicDirectory, newFilename);
    if (!joinResult?.success || !joinResult.data) {
      debugLog?.warn('❌ Path join failed:', { module: 'song-management', function: 'saveNewSong', result: joinResult });
      return;
    }
    const newPath = joinResult.data;
    const insertSong = await secureDatabase.execute(
      "INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [title, artist, category, info, newFilename, duration, Math.floor(Date.now() / 1000)]
    );
    if (!insertSong?.success) {
      debugLog?.warn('❌ Song insert failed:', { module: 'song-management', function: 'saveNewSong', error: insertSong?.error });
      return;
    }
    const copyRes = await secureFileSystem.copy(filename, newPath);
    if (!copyRes?.success) {
      debugLog?.warn('❌ Failed to copy file:', { module: 'song-management', function: 'saveNewSong', error: copyRes?.error });
    } else {
      debugLog?.info('✅ File copied successfully', { module: 'song-management', function: 'saveNewSong' });
    }

    const omni2 = document.getElementById('omni_search');
    if (omni2) omni2.value = title;
    if (typeof searchData === 'function') searchData();
  } catch (error) {
    debugLog?.warn('❌ Error in saveNewSong:', { module: 'song-management', function: 'saveNewSong', error: error?.message });
  }
}

/**
 * Opens the song edit modal for the selected song
 * Populates the form with the song's current information
 */
export async function editSelectedSong() {
  try {
    const songId = (document.getElementById('selected_row') || {}).getAttribute?.('songid');
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
    const idEl = document.getElementById('song-form-songid');
    const titleEl = document.getElementById('song-form-title');
    const artistEl = document.getElementById('song-form-artist');
    const infoEl = document.getElementById('song-form-info');
    const durEl = document.getElementById('song-form-duration');
    if (idEl) idEl.value = songId;
    if (titleEl) titleEl.value = songInfo.title || '';
    if (artistEl) artistEl.value = songInfo.artist || '';
    if (infoEl) infoEl.value = songInfo.info || '';
    if (durEl) durEl.value = songInfo.time || '';

    // Load categories securely and populate select
    const catSelect = document.getElementById('song-form-category');
    if (catSelect) catSelect.innerHTML = '';
    const catResult = await secureDatabase.query("SELECT * FROM categories ORDER BY description ASC");
    const categories = (catResult?.data || catResult) || [];
    if (Array.isArray(categories)) {
      categories.forEach(row => {
        const opt = document.createElement('option');
        if (row.code === songInfo.category) opt.setAttribute('selected','selected');
        opt.value = row.code;
        opt.textContent = row.description;
        catSelect?.appendChild(opt);
      });
    }

    // Prepare and show modal
    const editForm = document.querySelector('#songFormModal form');
    if (editForm) editForm.setAttribute('onsubmit','saveEditedSong(event)');
    const mTitle = document.getElementById('songFormModalTitle');
    if (mTitle) mTitle.textContent = 'Edit This Song';
    const mBtn = document.getElementById('songFormSubmitButton');
    if (mBtn) mBtn.textContent = 'Save';
    try { const { showModal } = await import('../ui/bootstrap-adapter.js'); showModal('#songFormModal'); } catch {}
  } catch (error) {
    debugLog?.error('Failed to open edit song modal', { module: 'song-management', function: 'editSelectedSong', error: error?.message });
  }
}

/**
 * Open the Add New Song modal and prefill fields
 * @param {string} filename - Full path to the selected audio file
 * @param {object} [metadata] - Optional metadata object
 */
export async function startAddNewSong(filename, metadata = null) {
  try {
    debugLog?.info('startAddNewSong invoked', {
      module: 'song-management',
      function: 'startAddNewSong',
      filename: filename || null,
      hasMetadata: !!metadata,
      metaDuration: metadata?.format?.duration || null,
      metaTitle: metadata?.common?.title || null,
      metaArtist: metadata?.common?.artist || null
    });
    // Reset any previous values
    const idEl2 = document.getElementById('song-form-songid');
    if (idEl2) idEl2.value = '';
    if (filename) {
      const fileEl = document.getElementById('song-form-filename');
      if (fileEl) fileEl.value = filename;
    }

    // Prefill from metadata if available
    const title = metadata?.common?.title || '';
    const artist = metadata?.common?.artist || '';
    let durationSeconds = (metadata?.format?.duration && !Number.isNaN(metadata.format.duration))
      ? Math.round(Number(metadata.format.duration))
      : 0;
    const toTimeString = (secs) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m.toString().padStart(1, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (title) { const t = document.getElementById('song-form-title'); if (t) t.value = title; }
    if (artist) { const a = document.getElementById('song-form-artist'); if (a) a.value = artist; }
    // Always try secure audio.getDuration for more accuracy
    if (filename) {
      try {
        debugLog?.info('Attempting to fetch duration via audio API', {
          module: 'song-management',
          function: 'startAddNewSong',
          filename
        });
        if (window.secureElectronAPI?.audio?.getDuration) {
          const res = await window.secureElectronAPI.audio.getDuration(filename);
          if (res?.success) {
            const sec = Math.round(res.duration ?? res.data ?? 0);
            if (sec > 0) durationSeconds = Math.max(durationSeconds, sec);
            debugLog?.info('Duration fetched via secure audio API', {
              module: 'song-management',
              function: 'startAddNewSong',
              durationSeconds
            });
          }
        } else if (window.electronAPI?.audio?.getDuration) {
          const res = await window.electronAPI.audio.getDuration(filename);
          if (res?.success) {
            const sec = Math.round(res.duration ?? res.data ?? 0);
            if (sec > 0) durationSeconds = Math.max(durationSeconds, sec);
            debugLog?.info('Duration fetched via legacy audio API', {
              module: 'song-management',
              function: 'startAddNewSong',
              durationSeconds
            });
          }
        }
      } catch (err) {
        debugLog?.warn('Failed to fetch duration via audio API', { module: 'song-management', function: 'startAddNewSong', error: err?.message });
      }
    }

    if (typeof durationSeconds === 'number' && durationSeconds > 0) {
      if (window.secureElectronAPI?.utils?.formatDuration) {
        try {
          const fmt = await window.secureElectronAPI.utils.formatDuration(durationSeconds);
          const formatted = fmt?.data || fmt?.formatted || (typeof fmt === 'string' ? fmt : null);
           const d = document.getElementById('song-form-duration'); if (d) d.value = (formatted || toTimeString(durationSeconds));
          debugLog?.info('Duration field set', {
            module: 'song-management',
            function: 'startAddNewSong',
            durationSeconds,
            formatted: formatted || toTimeString(durationSeconds)
          });
        } catch {
          const d2 = document.getElementById('song-form-duration'); if (d2) d2.value = toTimeString(durationSeconds);
          debugLog?.info('Duration field set (fallback formatter)', {
            module: 'song-management',
            function: 'startAddNewSong',
            durationSeconds
          });
        }
      } else {
        const d3 = document.getElementById('song-form-duration'); if (d3) d3.value = toTimeString(durationSeconds);
        debugLog?.info('Duration field set (local formatter)', {
          module: 'song-management',
          function: 'startAddNewSong',
          durationSeconds
        });
      }
    } else {
      // Ensure field not left blank if all else fails
      const d4 = document.getElementById('song-form-duration'); if (d4) d4.value = '';
      debugLog?.warn('Duration unavailable after attempts', {
        module: 'song-management',
        function: 'startAddNewSong',
        filename
      });
    }

    // Prepare and show modal for adding
    const addForm = document.querySelector('#songFormModal form');
    if (addForm) addForm.setAttribute('onsubmit','saveNewSong(event)');
    const addTitle = document.getElementById('songFormModalTitle');
    if (addTitle) addTitle.textContent = 'Add New Song';
    const addBtn = document.getElementById('songFormSubmitButton');
    if (addBtn) addBtn.textContent = 'Add';
    // Ensure category select element reference exists
    const catSelect = document.getElementById('song-form-category');
    // Populate categories for the add flow
    try {
      if (catSelect) catSelect.innerHTML = '';
      if (window.secureElectronAPI?.database?.query) {
        const catResult = await window.secureElectronAPI.database.query("SELECT * FROM categories ORDER BY description ASC");
        const rows = (catResult?.data || catResult) || [];
        if (Array.isArray(rows)) {
          rows.forEach(row => {
            const opt = document.createElement('option');
            opt.value = row.code;
            opt.textContent = row.description;
            catSelect?.appendChild(opt);
          });
        }
      }
      // Add new category option separator and entry
      if (catSelect) {
        const sep = document.createElement('option');
        sep.value = '';
        sep.disabled = true;
        sep.textContent = '-----------------------';
        catSelect.appendChild(sep);
        const newOpt = document.createElement('option');
        newOpt.value = '--NEW--';
        newOpt.textContent = 'ADD NEW CATEGORY...';
        catSelect.appendChild(newOpt);
        catSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (err) {
      debugLog?.warn('Failed to populate categories for add modal', { module: 'song-management', function: 'startAddNewSong', error: err?.message });
    }
    try { const { showModal } = await import('../ui/bootstrap-adapter.js'); showModal('#songFormModal'); } catch {}
  } catch (error) {
    debugLog?.error('Failed to open add new song modal', { module: 'song-management', function: 'startAddNewSong', error: error?.message });
  }
}

/**
 * Determines the appropriate delete action based on the selected row's location
 * Handles deletion from holding tank, hotkeys, or database
 */
export function deleteSelectedSong() {
  debugLog?.info("deleteSelectedSong called", { module: 'song-management', function: 'deleteSelectedSong' });
  debugLog?.info("selected_row:", { module: 'song-management', function: 'deleteSelectedSong', selectedRow: document.getElementById('selected_row') });
  debugLog?.info("holding-tank-column has selected_row:", { module: 'song-management', function: 'deleteSelectedSong', hasSelectedRow: document.getElementById('holding-tank-column')?.contains?.(document.getElementById('selected_row')) ? 1 : 0 });
  debugLog?.info("hotkey-tab-content has selected_row:", { module: 'song-management', function: 'deleteSelectedSong', hasSelectedRow: document.getElementById('hotkey-tab-content')?.contains?.(document.getElementById('selected_row')) ? 1 : 0 });
  
  // Check if the selected row is in the holding tank
  if (document.getElementById('holding-tank-column')?.contains?.(document.getElementById('selected_row'))) {
    debugLog?.info("Selected row is in holding tank", { module: 'song-management', function: 'deleteSelectedSong' });
    // If in holding tank, remove from holding tank
    removeFromHoldingTank();
  } else if (document.getElementById('hotkey-tab-content')?.contains?.(document.getElementById('selected_row'))) {
    debugLog?.info("Selected row is in hotkey tab", { module: 'song-management', function: 'deleteSelectedSong' });
    // If in hotkey tab, remove from hotkey
    removeFromHotkey();
  } else {
    debugLog?.info("Selected row is in search results", { module: 'song-management', function: 'deleteSelectedSong' });
    // If not in holding tank or hotkey, delete from database
    deleteSong();
  }
} 