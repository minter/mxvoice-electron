/**
 * Bulk Operations Functions
 * 
 * Core functions for handling bulk import of songs from directories
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
import { secureFileSystem, secureDatabase, securePath, secureStore } from '../adapters/secure-adapter.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';

// Supported audio file extensions (lowercase)
const SUPPORTED_AUDIO_EXTS = new Set([".mp3", ".mp4", ".m4a", ".wav", ".ogg", ".flac", ".aac"]);

/**
 * Shows the bulk add modal with directory and category selection
 * 
 * @param {string} directory - The directory path to pre-populate
 */
export async function showBulkAddModal(directory) {
  $("#bulk-add-path").val(directory);
  $("#bulk-add-category").empty();
  try {
    const result = await secureDatabase.query("SELECT * FROM categories ORDER BY description ASC");
    const rows = result?.data || result || [];
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        if (typeof categories !== 'undefined') {
          categories[row.code] = row.description;
        }
        $("#bulk-add-category").append(
          `<option value="${row.code}">${row.description}</option>`
        );
      });
    }
  } catch (_err) {
    // ignore; modal can still open
  }
  $("#bulk-add-category").append(
    `<option value="" disabled>-----------------------</option>`
  );
  $("#bulk-add-category").append(
    `<option value="--NEW--">ADD NEW CATEGORY...</option>`
  );

  try { const { showModal } = await import('../ui/bootstrap-adapter.js'); showModal('#bulkAddModal'); } catch {}
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

    const uuid = (window.secureElectronAPI?.utils?.generateId)
      ? await window.secureElectronAPI.utils.generateId()
      : Date.now().toString();

    const newFilename = `${artist}-${title}-${uuid}${ext}`.replace(/[^-.\w]/g, "");

    const storeRes = await secureStore.get("music_directory");
    if (!storeRes?.success || !storeRes.value) {
      debugLog?.warn('Failed to get music directory:', { module: 'bulk-operations', function: 'addSongsByPath', result: storeRes });
      return;
    }
    const musicDirectory = storeRes.value;

    const joinRes = await securePath.join(musicDirectory, newFilename);
    const newPath = joinRes?.data || joinRes;

    const insRes = await secureDatabase.execute(
      "INSERT INTO mrvoice (title, artist, category, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?)",
      [title, artist, category, newFilename, durationString, Math.floor(Date.now() / 1000)]
    );
    const lastId = insRes?.data?.lastInsertRowid;

    debugLog?.info('Copying audio file', { module: 'bulk-operations', function: 'addSongsByPath', songSourcePath, newPath });
    const copyRes = await secureFileSystem.copy(songSourcePath, newPath);
    if (!copyRes?.success) {
      debugLog?.warn('Failed to copy file', { module: 'bulk-operations', function: 'addSongsByPath', songSourcePath, newPath, error: copyRes?.error });
    } else {
      debugLog?.info('File copied successfully', { module: 'bulk-operations', function: 'addSongsByPath', songSourcePath, newPath });
    }

    const categoryLabel = (typeof categories !== 'undefined') ? categories[category] : category;

    // Create row safely without interpreting user-controlled values as HTML
    const row = document.createElement('tr');
    row.className = 'song unselectable context-menu';
    row.setAttribute('songid', String(lastId || ''));
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
  try { const { hideModal } = await import('../ui/bootstrap-adapter.js'); hideModal('#bulkAddModal'); } catch {}
  const dirname = $("#bulk-add-path").val();

  const walk = async (dir) => {
    let results = [];
    try {
      const readdirResult = await secureFileSystem.readdir(dir);
      const entries = Array.isArray(readdirResult)
        ? readdirResult
        : (Array.isArray(readdirResult?.data) ? readdirResult.data : null);
      if (!entries) {
        debugLog?.warn('Failed to read directory', { module: 'bulk-operations', function: 'saveBulkUpload', dir, error: readdirResult?.error });
        return results;
      }
      for (const fileEntry of entries) {
        // Skip hidden/system entries like .DS_Store
        if (typeof fileEntry === 'string' && fileEntry.startsWith('.')) {
          continue;
        }
        const fullPath = `${dir}/${fileEntry}`;
        try {
          const statResult = await secureFileSystem.stat(fullPath);
          // Normalize stat shape from secure API
          const isDir = (!!statResult?.isDirectory) || (typeof statResult?.isDirectory === 'function' && statResult.isDirectory());
          const isFile = (!!statResult?.isFile) || (typeof statResult?.isFile === 'function' && statResult.isFile());
          if (isDir || isFile) {
            if (isDir) {
              results = results.concat(await walk(fullPath));
            } else if (isFile) {
              const parseRes = await securePath.parse(fullPath);
              if (!parseRes.success || !parseRes.data) continue;
              const pathData = parseRes.data;
              if (SUPPORTED_AUDIO_EXTS.has(pathData.ext.toLowerCase())) {
                results.push(fullPath);
              }
            } else {
              debugLog?.warn('Unknown stat shape for entry', { module: 'bulk-operations', function: 'saveBulkUpload', file: fullPath, stat: statResult });
            }
          } else {
            debugLog?.warn('Failed to get file stats', { module: 'bulk-operations', function: 'saveBulkUpload', file: fullPath, error: statResult?.error });
          }
        } catch (error) {
          debugLog?.warn('File stat error', { module: 'bulk-operations', function: 'saveBulkUpload', file: fullPath, error: error?.message });
        }
      }
    } catch (error) {
      debugLog?.warn('Directory read error', { module: 'bulk-operations', function: 'saveBulkUpload', dir, error: error?.message });
    }
    return results;
  };

  const songs = await walk(dirname);

  $("#search_results tbody").find("tr").remove();
  $("#search_results thead").show();

  let category = $("#bulk-add-category").val();

  if (category == "--NEW--") {
    const description = $("#bulk-song-form-new-category").val();
    const baseCode = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
    const findUnique = async (base, i = 1) => {
      const test = i === 1 ? base : `${base}${i}`;
      const existsRes = await secureDatabase.query("SELECT 1 FROM categories WHERE code = ?", [test]);
      const exists = Array.isArray(existsRes?.data || existsRes) && (existsRes.data || existsRes).length > 0;
      return exists ? findUnique(base, i + 1) : test;
    };
    try {
      const finalCode = await findUnique(baseCode);
      const ins = await secureDatabase.execute("INSERT INTO categories VALUES (?, ?)", [finalCode, description]);
      if (ins?.success) {
        debugLog?.info('Added new row into database', { module: 'bulk-operations', function: 'saveBulkUpload', code: finalCode, description });
        if (typeof populateCategorySelect === 'function') populateCategorySelect();
        if (typeof populateCategoriesModal === 'function') populateCategoriesModal();
        category = finalCode;
      } else {
        $("#bulk-song-form-new-category").val("");
        alert(`Couldn't add a category named "${description}" - apparently one already exists!`);
        return;
      }
    } catch (err) {
      debugLog?.warn('Error adding new category for bulk upload', { module: 'bulk-operations', function: 'saveBulkUpload', error: err?.message });
      $("#bulk-song-form-new-category").val("");
      alert(`Error adding category: ${err?.message}`);
      return;
    }
  }

  await addSongsByPath(songs, category);
}