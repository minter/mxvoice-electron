import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';

/**
 * Bulk Operations Functions
 *
 * Core functions for handling bulk import of songs from directories
 */

// Import debug logger
let debugLog = null;
let moduleRegistry = {};

export function configureBulkOperationsDependencies(dependencies = {}) {
  moduleRegistry = dependencies.moduleRegistry || {};
}
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_error) {
  // Debug logger not available
}

// Import secure adapters
import { secureFileSystem, secureDatabase, securePath, secureStore } from '../adapters/secure-adapter.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';
import { populateCategorySelect, findUniqueCategoryCode, refreshCategories, getCategoryDescription } from '../categories/category-data.js';
import { showMultiSongImport, MULTI_SONG_THRESHOLD } from './multi-song-import.js';

// Supported audio file extensions (lowercase)
export const SUPPORTED_AUDIO_EXTS = new Set([".mp3", ".mp4", ".m4a", ".wav", ".ogg", ".flac", ".opus"]);

/**
 * Shows the bulk add modal with directory and category selection.
 * Performs a directory walk first to determine if it should route to
 * the Multi-Song Import modal instead.
 * 
 * @param {string} directory - The directory path to pre-populate
 */
export async function showBulkAddModal(directory) {
  if (!directory) return;

  debugLog?.info('showBulkAddModal called, checking song count...', { 
    module: 'bulk-operations', 
    function: 'showBulkAddModal', 
    directory 
  });

  const scanResult = await secureFileSystem.scanAudioDirectory(directory);
  const songs = scanResult?.success && Array.isArray(scanResult.data) ? scanResult.data : [];

  if (!songs.length) {
    alert('No supported audio files found in the selected directory.');
    return;
  }

  // Routing based on threshold
  if (songs.length === 1) {
    debugLog?.info('Single song in directory, routing to startAddNewSong', { count: 1 });
    let metadata = null;
    try {
      const metaRes = await window.secureElectronAPI?.audio?.getMetadata?.(songs[0]);
      if (metaRes?.success && metaRes.data) {
        const d = metaRes.data;
        metadata = {
          common: { title: d.title || '', artist: d.artist || '' },
          format: { duration: d.duration || 0 }
        };
      }
    } catch (_e) {
      // Metadata is optional; the add-song form derives defaults from the path.
    }

    if (moduleRegistry.songManagement?.startAddNewSong) {
      moduleRegistry.songManagement.startAddNewSong(songs[0], metadata);
    }
    return;
  }

  if (songs.length <= MULTI_SONG_THRESHOLD) {
    debugLog?.info('Directory count within threshold, routing to showMultiSongImport', { count: songs.length });
    showMultiSongImport(songs);
    return;
  }

  // Above threshold: Show the standard bulk add modal
  debugLog?.info('Directory count above threshold, showing bulk add modal', { count: songs.length });
  const pathEl = document.getElementById('bulk-add-path');
  if (pathEl) pathEl.value = directory || '';
  const catSel = document.getElementById('bulk-add-category');
  await populateCategorySelect(catSel);

  safeShowModal('#bulkAddModal', { module: 'bulk-operations', function: 'showBulkAddModal' });
}

// Module-level state for file-list bulk import (set by showBulkAddFromFiles)
let pendingBulkFiles = null;

/**
 * Shows the bulk add modal pre-populated with a list of file paths (from drag-drop).
 * Hides the directory path field and shows a summary instead.
 *
 * @param {string[]} filePaths - Array of audio file paths to import
 */
export async function showBulkAddFromFiles(filePaths) {
  if (!filePaths || !filePaths.length) return;

  // 1. If only one file, use the standard single-song add flow
  if (filePaths.length === 1) {
    debugLog?.info('Single file dropped, routing to startAddNewSong', {
      module: 'bulk-operations',
      function: 'showBulkAddFromFiles'
    });
    
    // Attempt to get metadata before showing modal
    let metadata = null;
    try {
      const metaRes = await window.secureElectronAPI?.audio?.getMetadata?.(filePaths[0]);
      if (metaRes?.success && metaRes.data) {
        const d = metaRes.data;
        metadata = {
          common: { title: d.title || '', artist: d.artist || '' },
          format: { duration: d.duration || 0 }
        };
      }
    } catch (_e) {
      // Metadata is optional; the add-song form derives defaults from the path.
    }

    if (moduleRegistry.songManagement?.startAddNewSong) {
      moduleRegistry.songManagement.startAddNewSong(filePaths[0], metadata);
    }
    return;
  }

  // 2. If between 2 and MULTI_SONG_THRESHOLD, use the new Multi-Song Import modal
  if (filePaths.length <= MULTI_SONG_THRESHOLD) {
    debugLog?.info('Multiple files dropped (within threshold), routing to showMultiSongImport', {
      module: 'bulk-operations',
      function: 'showBulkAddFromFiles',
      count: filePaths.length
    });
    showMultiSongImport(filePaths);
    return;
  }

  // 3. Otherwise, use the standard bulk add flow (one category for all)
  debugLog?.info('Multiple files dropped (above threshold), using bulk add modal', {
    module: 'bulk-operations',
    function: 'showBulkAddFromFiles',
    count: filePaths.length
  });

  pendingBulkFiles = filePaths;

  const pathEl = document.getElementById('bulk-add-path');
  const pathRow = pathEl?.closest('.row');
  if (pathRow) pathRow.style.display = 'none';

  // Show a summary of the files to import
  let summaryEl = document.getElementById('bulk-add-file-summary');
  if (!summaryEl) {
    summaryEl = document.createElement('div');
    summaryEl.id = 'bulk-add-file-summary';
    summaryEl.className = 'row g-2 mb-3';

    const label = document.createElement('label');
    label.className = 'col-form-label col-sm-3';
    label.textContent = 'Files';
    summaryEl.appendChild(label);

    const valueCol = document.createElement('div');
    valueCol.className = 'col-sm-9 d-flex align-items-center';
    const span = document.createElement('span');
    span.id = 'bulk-add-file-count';
    valueCol.appendChild(span);
    summaryEl.appendChild(valueCol);

    // Insert before the modal footer (after the path row's parent)
    if (pathRow?.parentNode) {
      pathRow.parentNode.insertBefore(summaryEl, pathRow.nextSibling);
    }
  }
  summaryEl.style.display = '';
  const countEl = document.getElementById('bulk-add-file-count');
  if (countEl) {
    countEl.textContent = `${filePaths.length} audio file${filePaths.length !== 1 ? 's' : ''} ready to import`;
  }

  const catSel = document.getElementById('bulk-add-category');
  await populateCategorySelect(catSel);

  safeShowModal('#bulkAddModal', { module: 'bulk-operations', function: 'showBulkAddFromFiles' });
}

/**
 * Processes songs from a path array and adds them to the database
 * Handles metadata extraction, file copying, and database insertion
 * 
 * @param {Array} pathArray - Array of file paths to process
 * @param {string} category - Category code for the songs
 * @returns {Promise} - Promise that resolves when all songs are processed
 */
export async function addSongsByPath(pathArray, category) {
  const songSourcePath = pathArray.shift();
  if (!songSourcePath) return;

  try {
    // Read metadata to get title/artist/duration when possible
    let title = '';
    let artist = '';
    let durationString = '';
    try {
      const metaRes = await window.secureElectronAPI?.audio?.getMetadata?.(songSourcePath);
      if (metaRes?.success && metaRes.data) {
        title = metaRes.data.title || '';
        artist = metaRes.data.artist || '';
        const durSec = Math.round(metaRes.data.duration || 0);
        if (durSec > 0) {
          // Format mm:ss
          const m = Math.floor(durSec / 60);
          const s = durSec % 60;
          durationString = `${m}:${s.toString().padStart(2, '0')}`;
        }
      }
    } catch (_e) {
      // ignore, fallback below
    }

    // Parse path to derive fallback title and extension
    const parseRes = await securePath.parse(songSourcePath);
    const parsed = parseRes?.data || {};
    if (!title) title = parsed.name;
    if (!title) return;

    const extRes = await securePath.extname(songSourcePath);
    const ext = extRes?.data || extRes || '';

    let uuid;
    if (window.secureElectronAPI?.utils?.generateId) {
      const uuidResult = await window.secureElectronAPI.utils.generateId();
      uuid = uuidResult?.success && uuidResult?.data ? uuidResult.data : Date.now().toString();
    } else {
      uuid = Date.now().toString();
    }

    const newFilename = `${artist}-${title}-${uuid}${ext}`.replace(/[^-.\w]/g, "");

    const storeRes = await secureStore.get("music_directory");
    if (!storeRes?.success || !storeRes.value) {
      debugLog?.warn('Failed to get music directory:', { module: 'bulk-operations', function: 'addSongsByPath', result: storeRes });
      return;
    }
    const musicDirectory = storeRes.value;

    const joinRes = await securePath.join(musicDirectory, newFilename);
    const newPath = joinRes?.data || joinRes;

    const insRes = await secureDatabase.addSong({
      title, artist, category, filename: newFilename, duration: durationString
    });

    // Use lastInsertRowid from the insert result
    const lastId = insRes?.data?.lastInsertRowid || insRes?.lastInsertRowid || null;

    if (!lastId) {
      debugLog?.error('Failed to get valid song ID from insert result', {
        module: 'bulk-operations',
        function: 'addSongsByPath',
        title,
        artist,
        filename: newFilename,
        insRes
      });
      return;
    }

    window.secureElectronAPI?.analytics?.trackEvent?.('song_added', { method: 'bulk' });
    debugLog?.info('Copying audio file', { module: 'bulk-operations', function: 'addSongsByPath', songSourcePath, newPath });
    const copyRes = await secureFileSystem.copy(songSourcePath, newPath);
    if (!copyRes?.success) {
      debugLog?.warn('Failed to copy file', { module: 'bulk-operations', function: 'addSongsByPath', songSourcePath, newPath, error: copyRes?.error });
      await secureDatabase.deleteSong(lastId);
      return;
    } else {
      debugLog?.info('File copied successfully', { module: 'bulk-operations', function: 'addSongsByPath', songSourcePath, newPath });
    }

    // Get category description from cache instead of per-song DB query
    const categoryLabel = getCategoryDescription(category) || category;

    // Create row safely without interpreting user-controlled values as HTML
    const row = document.createElement('tr');
    row.className = 'song unselectable context-menu';
    row.setAttribute('songid', String(lastId));
    row.draggable = true;
    row.addEventListener('dragstart', songDrag);

    const tdCategory = document.createElement('td');
    tdCategory.textContent = categoryLabel || '';
    row.appendChild(tdCategory);

    const tdEmpty = document.createElement('td');
    row.appendChild(tdEmpty);

    const tdTitle = document.createElement('td');
    tdTitle.style.fontWeight = 'bold';
    tdTitle.textContent = title || '';
    row.appendChild(tdTitle);

    const tdArtist = document.createElement('td');
    tdArtist.style.fontWeight = 'bold';
    tdArtist.textContent = artist || '';
    row.appendChild(tdArtist);

    const tdDuration = document.createElement('td');
    tdDuration.textContent = durationString || '';
    row.appendChild(tdDuration);

    // Append to results table
    const results = document.querySelector('#search_results tbody') || document.querySelector('#search_results');
    results?.appendChild(row);

    // Process the rest
    await addSongsByPath(pathArray, category);
  } catch (error) {
    debugLog?.warn('Error in addSongsByPath', { module: 'bulk-operations', function: 'addSongsByPath', error: error?.message });
  }
}

/**
 * Handles bulk upload of songs from a directory
 * Walks through directory recursively, finds audio files, and processes them
 * 
 * @param {Event} event - The form submission event
 */
export async function saveBulkUpload(event) {
  event.preventDefault();
  safeHideModal('#bulkAddModal', { module: 'bulk-operations', function: 'saveBulkUpload' });

  // If we have pending files from a drag-drop, use them directly (skip directory walk)
  const droppedFiles = pendingBulkFiles;
  pendingBulkFiles = null;
  resetBulkAddModalState();

  if (droppedFiles && droppedFiles.length) {
    // Note: showBulkAddFromFiles already handles routing for dropped files.
    // This block is a fallback/safety.
    const tbody = document.querySelector('#search_results tbody');
    if (tbody) tbody.querySelectorAll('tr').forEach(tr => tr.remove());
    const thead = document.querySelector('#search_results thead');
    if (thead) thead.style.display = '';

    let category = (document.getElementById('bulk-add-category') || {}).value || '';
    if (category === '--NEW--') {
      category = await handleNewCategoryCreation();
      if (!category) return;
    }

    await addSongsByPath([...droppedFiles], category);
    return;
  }

  const dirname = (document.getElementById('bulk-add-path') || {}).value || '';

  const walk = async dir => {
    const result = await secureFileSystem.scanAudioDirectory(dir);
    return result?.success && Array.isArray(result.data) ? result.data : [];
  };

  const songs = await walk(dirname);

  if (!songs.length) {
    alert('No supported audio files found in the selected directory.');
    return;
  }

  // Routing based on threshold for directory imports
  if (songs.length === 1) {
    // Single song from directory -> startAddNewSong
    let metadata = null;
    try {
      const metaRes = await window.secureElectronAPI?.audio?.getMetadata?.(songs[0]);
      if (metaRes?.success && metaRes.data) {
        const d = metaRes.data;
        metadata = {
          common: { title: d.title || '', artist: d.artist || '' },
          format: { duration: d.duration || 0 }
        };
      }
    } catch (_e) {
      // Metadata is optional; the add-song form derives defaults from the path.
    }

    if (moduleRegistry.songManagement?.startAddNewSong) {
      moduleRegistry.songManagement.startAddNewSong(songs[0], metadata);
    }
    return;
  }

  if (songs.length <= MULTI_SONG_THRESHOLD) {
    debugLog?.info('Directory import (within threshold), routing to showMultiSongImport', {
      module: 'bulk-operations',
      function: 'saveBulkUpload',
      count: songs.length
    });
    showMultiSongImport(songs);
    return;
  }

  // Above threshold: Proceed with simple bulk add (one category for all)
  const tbody = document.querySelector('#search_results tbody');
  if (tbody) tbody.querySelectorAll('tr').forEach(tr => tr.remove());
  const thead = document.querySelector('#search_results thead');
  if (thead) thead.style.display = '';

  let category = (document.getElementById('bulk-add-category') || {}).value || '';

  if (category === '--NEW--') {
    category = await handleNewCategoryCreation();
    if (!category) return;
  }

  await addSongsByPath(songs, category);
}

/**
 * Handle --NEW-- category creation from the bulk add modal.
 * @returns {string|null} The new category code, or null if creation failed.
 */
async function handleNewCategoryCreation() {
  const descriptionEl = document.getElementById('bulk-song-form-new-category');
  const description = descriptionEl?.value || '';
  const baseCode = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
  try {
    const finalCode = await findUniqueCategoryCode(baseCode);
    const ins = await secureDatabase.addCategory({code: finalCode, description});
    if (ins?.success) {
      debugLog?.info('Added new row into database', { module: 'bulk-operations', function: 'handleNewCategoryCreation', code: finalCode, description });
      await refreshCategories();
      if (typeof populateCategoriesModal === 'function') populateCategoriesModal();
      return finalCode;
    } else {
      if (descriptionEl) descriptionEl.value = '';
      alert(`Couldn't add a category named "${description}" - apparently one already exists!`);
      return null;
    }
  } catch (err) {
    debugLog?.warn('Error adding new category for bulk upload', { module: 'bulk-operations', function: 'handleNewCategoryCreation', error: err?.message });
    if (descriptionEl) descriptionEl.value = '';
    alert(`Error adding category: ${err?.message}`);
    return null;
  }
}

/**
 * Reset the bulk add modal to its default state (directory mode).
 * Called when the modal is closed after a file-list import.
 */
export function resetBulkAddModalState() {
  // Clear any pending file-list state
  pendingBulkFiles = null;
  // Show the path row again
  const pathEl = document.getElementById('bulk-add-path');
  const pathRow = pathEl?.closest('.row');
  if (pathRow) pathRow.style.display = '';

  // Hide the file summary
  const summaryEl = document.getElementById('bulk-add-file-summary');
  if (summaryEl) summaryEl.style.display = 'none';
}
