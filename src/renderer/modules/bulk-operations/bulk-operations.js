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
  const pathEl = document.getElementById('bulk-add-path');
  if (pathEl) pathEl.value = directory || '';
  const catSel = document.getElementById('bulk-add-category');
  if (catSel) catSel.innerHTML = '';
  try {
    const result = await secureDatabase.query("SELECT * FROM categories ORDER BY description ASC");
    const rows = result?.data || result || [];
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        if (typeof categories !== 'undefined') {
          categories[row.code] = row.description;
        }
        if (catSel) {
          const opt = document.createElement('option');
          opt.value = row.code;
          opt.textContent = row.description;
          catSel.appendChild(opt);
        }
      });
    }
  } catch (_err) {
    // ignore; modal can still open
  }
  if (catSel) {
    const sep = document.createElement('option');
    sep.value = '';
    sep.disabled = true;
    sep.textContent = '-----------------------';
    catSel.appendChild(sep);
    const addNew = document.createElement('option');
    addNew.value = '--NEW--';
    addNew.textContent = 'ADD NEW CATEGORY...';
    catSel.appendChild(addNew);
  }

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

    // Use direct database execute and then query for the ID instead of relying on lastInsertRowid
    const insRes = await secureDatabase.execute(
      "INSERT INTO mrvoice (title, artist, category, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?)",
      [title, artist, category, newFilename, durationString, Math.floor(Date.now() / 1000)]
    );
    
    // Debug the database response to see what we're getting
    debugLog?.info('Database insert response:', { 
      module: 'bulk-operations', 
      function: 'addSongsByPath', 
      insRes, 
      insResType: typeof insRes,
      hasData: !!insRes?.data,
      dataType: typeof insRes?.data,
      lastInsertRowid: insRes?.data?.lastInsertRowid,
      changes: insRes?.data?.changes
    });
    
    // Since lastInsertRowid isn't working reliably, always query for the inserted song's ID
    let lastId = null;
    
    try {
      debugLog?.info('Querying for inserted song ID', { 
        module: 'bulk-operations', 
        function: 'addSongsByPath',
        title,
        artist,
        filename: newFilename
      });
      
      const songQuery = await secureDatabase.query(
        "SELECT id FROM mrvoice WHERE title = ? AND artist = ? AND filename = ? ORDER BY id DESC LIMIT 1",
        [title, artist, newFilename]
      );
      
      debugLog?.info('Song query result:', { 
        module: 'bulk-operations', 
        function: 'addSongsByPath', 
        songQuery,
        hasData: !!songQuery?.data,
        dataLength: songQuery?.data?.length
      });
      
      if (songQuery?.data && Array.isArray(songQuery.data) && songQuery.data.length > 0) {
        lastId = songQuery.data[0].id;
        debugLog?.info('Retrieved song ID from query:', { 
          module: 'bulk-operations', 
          function: 'addSongsByPath', 
          lastId 
        });
      } else {
        debugLog?.warn('Song query returned no results', { 
          module: 'bulk-operations', 
          function: 'addSongsByPath',
          songQuery
        });
      }
    } catch (queryError) {
      debugLog?.error('Failed to query for song ID:', { 
        module: 'bulk-operations', 
        function: 'addSongsByPath', 
        error: queryError?.message 
      });
    }
    
    debugLog?.info('Extracted lastId:', { 
      module: 'bulk-operations', 
      function: 'addSongsByPath', 
      lastId, 
      lastIdType: typeof lastId 
    });
    
    // Only create the row if we have a valid ID
    if (!lastId) {
      debugLog?.error('Failed to get valid song ID for row creation:', { 
        module: 'bulk-operations', 
        function: 'addSongsByPath', 
        title, 
        artist, 
        filename: newFilename 
      });
      return; // Skip creating this row
    }

    debugLog?.info('Copying audio file', { module: 'bulk-operations', function: 'addSongsByPath', songSourcePath, newPath });
    const copyRes = await secureFileSystem.copy(songSourcePath, newPath);
    if (!copyRes?.success) {
      debugLog?.warn('Failed to copy file', { module: 'bulk-operations', function: 'addSongsByPath', songSourcePath, newPath, error: copyRes?.error });
    } else {
      debugLog?.info('File copied successfully', { module: 'bulk-operations', function: 'addSongsByPath', songSourcePath, newPath });
    }

    // Get category description from database instead of relying on global categories object
    let categoryLabel = category;
    try {
      const catResult = await secureDatabase.query("SELECT description FROM categories WHERE code = ?", [category]);
      if (catResult?.data && Array.isArray(catResult.data) && catResult.data.length > 0) {
        categoryLabel = catResult.data[0].description || category;
      }
    } catch (catError) {
      debugLog?.warn('Failed to get category description, using code', { 
        module: 'bulk-operations', 
        function: 'addSongsByPath', 
        category, 
        error: catError?.message 
      });
    }

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
  try { const { hideModal } = await import('../ui/bootstrap-adapter.js'); hideModal('#bulkAddModal'); } catch {}
  const dirname = (document.getElementById('bulk-add-path') || {}).value || '';

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

  const tbody = document.querySelector('#search_results tbody');
  if (tbody) tbody.querySelectorAll('tr').forEach(tr => tr.remove());
  const thead = document.querySelector('#search_results thead');
  if (thead) thead.style.display = '';

  let category = (document.getElementById('bulk-add-category') || {}).value || '';

  if (category == "--NEW--") {
    const descriptionEl = document.getElementById('bulk-song-form-new-category');
    const description = descriptionEl?.value || '';
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
        if (descriptionEl) descriptionEl.value = '';
        alert(`Couldn't add a category named "${description}" - apparently one already exists!`);
        return;
      }
    } catch (err) {
      debugLog?.warn('Error adding new category for bulk upload', { module: 'bulk-operations', function: 'saveBulkUpload', error: err?.message });
      if (descriptionEl) descriptionEl.value = '';
      alert(`Error adding category: ${err?.message}`);
      return;
    }
  }

  await addSongsByPath(songs, category);
}