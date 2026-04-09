import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';
import { secureFileSystem, secureDatabase, securePath, secureStore } from '../adapters/secure-adapter.js';
import { populateCategorySelect, getCategoryDescription } from '../categories/category-data.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';
import { customAlert } from '../utils/modal-utils.js';

/**
 * Multi-Song Import Module
 * 
 * Handles the "Middle" path for importing 2 to N songs (N=20).
 * Allows fine-tuning of metadata and categories for each song before import.
 */

// Threshold for choosing between multi-song fine-tuning and simple bulk import
export let MULTI_SONG_THRESHOLD = 20;

/**
 * Sets the threshold for multi-song import vs bulk import.
 * @param {number} value - The new threshold
 */
export function setMultiSongThreshold(value) {
  MULTI_SONG_THRESHOLD = value;
}

// Module-level state
let pendingSongs = [];
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_e) {}

/**
 * Shows the Multi-Song Import modal pre-populated with song data
 * 
 * @param {string[]} filePaths - Array of audio file paths to import
 */
export async function showMultiSongImport(filePaths) {
  debugLog?.info('Opening Multi-Song Import modal', {
    module: 'multi-song-import',
    function: 'showMultiSongImport',
    count: filePaths.length
  });

  const listContainer = document.getElementById('multi-song-import-list');
  const countEl = document.getElementById('multi-song-import-count');
  const globalCatSelect = document.getElementById('multi-import-global-category');
  
  if (!listContainer || !countEl || !globalCatSelect) {
    debugLog?.error('Multi-song import UI elements not found');
    return;
  }

  // Clear previous state
  listContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"></div><div class="mt-2">Parsing metadata...</div></div>';
  countEl.textContent = `Preparing ${filePaths.length} songs...`;
  pendingSongs = [];

  // Populate global category selector
  await populateCategorySelect(globalCatSelect);
  globalCatSelect.value = ''; // Default to none

  // Process files to get initial metadata
  const songDataPromises = filePaths.map(async (filePath) => {
    let title = '';
    let artist = '';
    let durationString = '';
    
    try {
      const metaRes = await window.secureElectronAPI?.audio?.getMetadata?.(filePath);
      if (metaRes?.success && metaRes.data) {
        title = metaRes.data.title || '';
        artist = metaRes.data.artist || '';
        const durSec = Math.round(metaRes.data.duration || 0);
        if (durSec > 0) {
          const m = Math.floor(durSec / 60);
          const s = durSec % 60;
          durationString = `${m}:${s.toString().padStart(2, '0')}`;
        }
      }
    } catch (_e) {}

    // Fallback to filename if title is missing
    if (!title) {
      const parseRes = await securePath.parse(filePath);
      title = parseRes?.data?.name || 'Unknown Title';
    }

    return {
      filePath,
      title,
      artist,
      info: '',
      category: '',
      duration: durationString
    };
  });

  pendingSongs = await Promise.all(songDataPromises);

  // Render the list
  renderSongList();
  
  countEl.textContent = `${filePaths.length} song${filePaths.length !== 1 ? 's' : ''} ready to import`;

  // Set up global category listener
  globalCatSelect.onchange = () => {
    const newCat = globalCatSelect.value;
    if (!newCat || newCat === 'NONE' || newCat === '-----------------') return;
    
    debugLog?.info('Applying global category', { category: newCat });
    const rowSelects = listContainer.querySelectorAll('.song-category-select');
    rowSelects.forEach(select => {
      select.value = newCat;
      select.classList.remove('is-invalid');
    });
    
    // Update state
    pendingSongs.forEach(s => s.category = newCat);
  };

  // Set up submit listener
  const submitBtn = document.getElementById('multiSongImportSubmitButton');
  submitBtn.onclick = saveMultiSongImport;

  safeShowModal('#multiSongImportModal', { module: 'multi-song-import', function: 'showMultiSongImport' });
}

/**
 * Renders the list of songs in the modal
 */
function renderSongList() {
  const listContainer = document.getElementById('multi-song-import-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  pendingSongs.forEach((song, index) => {
    const row = document.createElement('div');
    row.className = 'row g-2 mb-3 pb-3 border-bottom align-items-center song-import-row';
    row.dataset.index = index;

    // We'll create a grid: Title (4), Artist (3), Info (2), Category (3)
    row.innerHTML = `
      <div class="col-md-4">
        <label class="small text-muted d-block">Title</label>
        <input type="text" class="form-control form-control-sm song-title-input" value="${escapeHtml(song.title)}">
      </div>
      <div class="col-md-3">
        <label class="small text-muted d-block">Artist</label>
        <input type="text" class="form-control form-control-sm song-artist-input" value="${escapeHtml(song.artist)}">
      </div>
      <div class="col-md-2">
        <label class="small text-muted d-block">Info</label>
        <input type="text" class="form-control form-control-sm song-info-input" value="${escapeHtml(song.info)}">
      </div>
      <div class="col-md-3">
        <label class="small text-muted d-block">Category</label>
        <select class="form-control form-control-sm song-category-select"></select>
      </div>
      <div class="col-12 mt-1">
        <small class="text-muted text-truncate d-block" style="font-size: 0.7rem;">${escapeHtml(song.filePath)}</small>
      </div>
    `;

    listContainer.appendChild(row);

    // Populate category select for this row
    const catSelect = row.querySelector('.song-category-select');
    populateCategorySelect(catSelect).then(() => {
      catSelect.value = song.category;
      catSelect.onchange = () => {
        song.category = catSelect.value;
        if (song.category && song.category !== 'NONE' && song.category !== '-----------------') {
          catSelect.classList.remove('is-invalid');
        }
      };
    });

    // Add listeners for other inputs
    row.querySelector('.song-title-input').oninput = (e) => {
      song.title = e.target.value;
      if (song.title.trim()) {
        e.target.classList.remove('is-invalid');
      }
    };
    row.querySelector('.song-artist-input').oninput = (e) => song.artist = e.target.value;
    row.querySelector('.song-info-input').oninput = (e) => song.info = e.target.value;
  });
}

/**
 * Validates that all songs have a title and a valid category
 * @returns {boolean} True if all valid
 */
function validateInputs() {
  let allValid = true;
  const listContainer = document.getElementById('multi-song-import-list');
  const rows = listContainer.querySelectorAll('.song-import-row');

  pendingSongs.forEach((song, index) => {
    const row = rows[index];
    const titleInput = row.querySelector('.song-title-input');
    const catSelect = row.querySelector('.song-category-select');

    // Title validation
    if (!song.title || !song.title.trim()) {
      titleInput.classList.add('is-invalid');
      allValid = false;
    } else {
      titleInput.classList.remove('is-invalid');
    }

    // Category validation
    const invalidCats = ['', 'NONE', '-----------------', 'null', null];
    if (!song.category || invalidCats.includes(song.category)) {
      catSelect.classList.add('is-invalid');
      allValid = false;
    } else {
      catSelect.classList.remove('is-invalid');
    }
  });

  if (!allValid) {
    // Scroll to the first invalid element if possible
    const firstInvalid = listContainer.querySelector('.is-invalid');
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid.focus();
    }
  }

  return allValid;
}

/**
 * Saves all songs in the Multi-Song Import modal to the database
 */
async function saveMultiSongImport() {
  // 1. Validate
  if (!validateInputs()) {
    customAlert('Please ensure all songs have a title and a category selected.');
    return;
  }

  const submitBtn = document.getElementById('multiSongImportSubmitButton');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Importing...';

  debugLog?.info('Saving multi-song import', {
    module: 'multi-song-import',
    function: 'saveMultiSongImport',
    count: pendingSongs.length
  });

  try {
    // Clear current search results to show new imports
    const tbody = document.querySelector('#search_results tbody');
    if (tbody) tbody.querySelectorAll('tr').forEach(tr => tr.remove());
    const thead = document.querySelector('#search_results thead');
    if (thead) thead.style.display = '';

    // Process each song
    for (const song of pendingSongs) {
      if (!song.title) continue;

      // Ensure category is selected or use a default
      const category = song.category || 'NONE';

      // 1. Generate UUID and unique filename
      let uuid;
      if (window.secureElectronAPI?.utils?.generateId) {
        const uuidResult = await window.secureElectronAPI.utils.generateId();
        uuid = uuidResult?.success && uuidResult?.data ? uuidResult.data : Date.now().toString();
      } else {
        uuid = Date.now().toString();
      }

      const extRes = await securePath.extname(song.filePath);
      const ext = extRes?.data || extRes || '';
      const newFilename = `${song.artist}-${song.title}-${uuid}${ext}`.replace(/[^-.\w]/g, "");

      // 2. Get music directory
      const storeRes = await secureStore.get("music_directory");
      const musicDirectory = storeRes?.value || '';
      
      if (!musicDirectory) {
        debugLog?.error('Music directory not found during multi-import');
        continue;
      }

      const joinRes = await securePath.join(musicDirectory, newFilename);
      const newPath = joinRes?.data || joinRes;

      // 3. Add to database
      const insRes = await secureDatabase.addSong({
        title: song.title,
        artist: song.artist,
        info: song.info,
        category: category,
        filename: newFilename,
        duration: song.duration
      });

      const lastId = insRes?.data?.lastInsertRowid || insRes?.lastInsertRowid;

      if (lastId) {
        // 4. Copy file
        const copyRes = await secureFileSystem.copy(song.filePath, newPath);
        if (!copyRes?.success) {
          debugLog?.warn('Failed to copy file during multi-import', { path: song.filePath, error: copyRes?.error });
        }

        // 5. Add to UI (search results)
        addSongToSearchResultsUI(lastId, song, newFilename);
      }
    }

    debugLog?.info('Multi-song import completed');
    safeHideModal('#multiSongImportModal');
    
    // Optional: Show success message
    if (typeof window.showDropToast === 'function') {
      window.showDropToast(`Successfully imported ${pendingSongs.length} songs`);
    }

  } catch (error) {
    debugLog?.error('Error during multi-song import save', { error: error.message });
    alert(`Error during import: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Import All Songs';
  }
}

/**
 * Adds a newly imported song to the search results table
 */
function addSongToSearchResultsUI(id, song, filename) {
  const categoryLabel = getCategoryDescription(song.category) || song.category;
  const results = document.querySelector('#search_results tbody') || document.querySelector('#search_results');
  if (!results) return;

  const row = document.createElement('tr');
  row.className = 'song unselectable context-menu';
  row.setAttribute('songid', String(id));
  row.draggable = true;
  row.addEventListener('dragstart', songDrag);

  row.innerHTML = `
    <td>${escapeHtml(categoryLabel)}</td>
    <td>${escapeHtml(song.info)}</td>
    <td style="font-weight: bold;">${escapeHtml(song.title)}</td>
    <td style="font-weight: bold;">${escapeHtml(song.artist)}</td>
    <td>${escapeHtml(song.duration)}</td>
  `;

  results.appendChild(row);
}

/**
 * Minimal HTML escaping to prevent XSS in UI
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
