/**
 * Holding Tank Module
 * 
 * This module manages the holding tank functionality for Mx. Voice.
 * The holding tank can operate in two modes:
 * - Storage mode: Simple storage of songs for later use
 * - Playlist mode: Automatic playback of songs in sequence
 * 
 * Features:
 * - Add/remove songs from holding tank
 * - Save/load holding tank data
 * - Drag and drop functionality
 * - Mode switching (storage vs playlist)
 * - File import/export
 * - Tab management
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_error) {
  // Debug logger not available
}

// Use global electronAPI instead of importing services
// Import secure adapters
import { secureDatabase } from '../adapters/secure-adapter.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';
const database = secureDatabase;
import Dom from '../dom-utils/index.js';
// Import secure adapters
import { secureFileDialog } from '../adapters/secure-adapter.js';
import { scaleScrollable } from '../utils/index.js';
import { getPreference } from '../preferences/profile-preference-adapter.js';
import HoldingTankState from './holding-tank-state.js';

// Module state
let holdingTankMode = "storage"; // 'storage' or 'playlist'
let _autoplay = false;
let moduleRegistry = {};
let electronAPI = null;
const holdingTankState = new HoldingTankState();

export function getHoldingTankSnapshot() {
  return holdingTankState.toSnapshot();
}

export function loadHoldingTankSnapshot(snapshot) {
  holdingTankState.loadFromSnapshot(snapshot, { notify: false });
}

export function clearSongFromHoldingTankState(songId) {
  return holdingTankState.clearSong(songId);
}

export function removeHoldingTankElement(element) {
  const tab = element?.closest?.('.holding_tank');
  const tabNumber = Number(tab?.id?.match(/^holding_tank_(\d)$/)?.[1]);
  const items = tab ? [...tab.querySelectorAll('li.list-group-item[songid]')] : [];
  const index = items.indexOf(element);
  if (!tabNumber || index < 0) return null;
  return holdingTankState.removeAt(tabNumber, index);
}

export function clearActiveHoldingTankState() {
  const activeTab = document.querySelector('.holding_tank.active');
  const tabNumber = Number(activeTab?.id?.match(/^holding_tank_(\d)$/)?.[1]);
  return tabNumber ? holdingTankState.clearTab(tabNumber) : false;
}

function getActiveHoldingTankTabNumber() {
  return Number(document.querySelector('.holding_tank.active')?.id?.match(/^holding_tank_(\d)$/)?.[1]) || 1;
}

function updateStateForInsertion(songId, targetEl, insertPosition, existingElement) {
  const targetTab = targetEl?.closest?.('.holding_tank') || document.querySelector('.holding_tank.active');
  const targetTabNumber = Number(targetTab?.id?.match(/^holding_tank_(\d)$/)?.[1]);
  if (!targetTabNumber) return false;

  const targetItems = [...targetTab.querySelectorAll('li.list-group-item[songid]')];
  const targetItemIndex = targetEl?.matches?.('li') ? targetItems.indexOf(targetEl) : -1;
  let targetIndex = targetItems.length;
  if (targetItemIndex >= 0) {
    targetIndex = insertPosition === 'before' ? targetItemIndex : targetItemIndex + 1;
  }

  if (existingElement) {
    const sourceTab = existingElement.closest('.holding_tank');
    const sourceTabNumber = Number(sourceTab?.id?.match(/^holding_tank_(\d)$/)?.[1]);
    const sourceIndex = sourceTab
      ? [...sourceTab.querySelectorAll('li.list-group-item[songid]')].indexOf(existingElement)
      : -1;
    if (sourceTabNumber && sourceIndex >= 0) {
      holdingTankState.move(sourceTabNumber, sourceIndex, targetTabNumber, targetIndex);
      return true;
    }
  }

  holdingTankState.add(targetTabNumber, songId, targetIndex);
  return true;
}

export function renameHoldingTankStateTab(tabNumber, name) {
  return holdingTankState.renameTab(tabNumber, name);
}

export function moveHoldingTankItem(sourceTabNumber, sourceIndex, targetTabNumber, targetIndex) {
  return holdingTankState.move(sourceTabNumber, sourceIndex, targetTabNumber, targetIndex);
}

export async function restoreHoldingTankSnapshot(snapshot) {
  loadHoldingTankSnapshot(snapshot);
  const songIds = [...new Set(holdingTankState.toSnapshot().flatMap(tab => tab.songIds))];
  const songsById = new Map();
  if (songIds.length > 0) {
    const result = await database.getSongsByIds(songIds);
    if (result?.success === false) throw new Error(result.error || 'Failed to load holding tank metadata');
    const rows = result?.data || result || [];
    if (!Array.isArray(rows)) throw new Error('Failed to load holding tank metadata');
    rows.forEach(row => songsById.set(String(row.id), row));
    holdingTankState.batch(() => {
      songIds.filter(songId => !songsById.has(String(songId)))
        .forEach(songId => holdingTankState.clearSong(songId));
    });
  }

  for (const tab of holdingTankState.toSnapshot()) {
    const tabLink = document.querySelector(`#holding_tank_tabs .nav-item:nth-child(${tab.tabNumber}) a`);
    if (tabLink) tabLink.textContent = tab.tabName || String(tab.tabNumber);
    const tabContent = document.getElementById(`holding_tank_${tab.tabNumber}`);
    if (!tabContent) continue;
    tabContent.replaceChildren();
    for (const songId of tab.songIds) {
      const row = songsById.get(String(songId));
      if (!row) continue;
      const element = document.createElement('li');
      element.style.fontSize = '11px';
      element.className = 'song list-group-item context-menu';
      element.draggable = true;
      element.addEventListener('dragstart', songDrag);
      element.setAttribute('songid', songId);
      element.textContent = `${row.title || '[Unknown Title]'} by ${row.artist || '[Unknown Artist]'} (${row.time || '[??:??]'})`;
      tabContent.appendChild(element);
    }
  }
  return holdingTankState.toSnapshot();
}

/**
 * Initialize the holding tank module
 */
export function initHoldingTank() {
  debugLog?.info('Initializing Holding Tank module', { 
    module: 'holding-tank',
    function: 'initHoldingTank'
  });
  
  // Load saved mode from profile-aware preference store
  return getPreference('holding_tank_mode', electronAPI).then(result => {
    if (result.success && result.value) {
      holdingTankMode = result.value;
    } else {
      holdingTankMode = "storage"; // Default to storage mode
    }
    if (typeof window.setHoldingTankMode === 'function') {
      window.setHoldingTankMode(holdingTankMode);
    }
    return { success: true, mode: holdingTankMode };
  }).catch(error => {
    debugLog?.warn('Failed to initialize holding tank', {
      module: 'holding-tank',
      function: 'initHoldingTank',
      error: error.message
    });
    holdingTankMode = "storage";
    if (typeof window.setHoldingTankMode === 'function') {
      window.setHoldingTankMode(holdingTankMode);
    }
    return { success: false, error: error.message };
  });
}

/** Save holding-tank model state to the active profile. */
export function requestProfileStateSave() {
  if (!moduleRegistry.profileState) {
    return Promise.reject(new Error('Profile state module is unavailable'));
  }
  return moduleRegistry.profileState.saveProfileState();
}

/**
 * Populate holding tank with song IDs
 */
export async function populateHoldingTank(songIds) {
  debugLog?.info('populateHoldingTank called with song IDs', { 
    module: 'holding-tank',
    function: 'populateHoldingTank',
    songIds: songIds,
    databaseAvailable: !!electronAPI?.database
  });
  
  // Extend tooltip suppression during holding tank population to prevent tooltips
  // from appearing during DOM updates that happen after file loading
  const fileButtons = ['hotkey-load-btn', 'hotkey-save-btn', 'holding-tank-load-btn', 'holding-tank-save-btn'];
  fileButtons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.dataset.tooltipSuppressUntil = Date.now() + 3000; // Extend suppression for 3 more seconds
    }
  });
  
  if (!songIds || songIds.length === 0) {
    debugLog?.warn('No song IDs provided to populateHoldingTank', { 
      module: 'holding-tank',
      function: 'populateHoldingTank'
    });
    return { success: false, error: 'No song IDs provided' };
  }

  clearActiveHoldingTankState();
  Dom.empty('.holding_tank.active');
  debugLog?.info('Cleared active holding tank', { 
    module: 'holding-tank',
    function: 'populateHoldingTank'
  });
  
  let addedCount = 0;
  for (const songId of songIds) {
    debugLog?.info('Adding song ID to holding tank', { 
      module: 'holding-tank',
      function: 'populateHoldingTank',
      songId: songId
    });
    const result = await addToHoldingTank(songId, Dom.$('.holding_tank.active'));
    if (result?.success) addedCount += 1;
  }

  await requestProfileStateSave();
  scaleScrollable();
  debugLog?.info('populateHoldingTank completed successfully', {
    module: 'holding-tank',
    function: 'populateHoldingTank',
    count: addedCount
  });
  return { success: true, count: addedCount };
}

/**
 * Add a song to the holding tank
 * @param {string} song_id - The song ID to add
 * @param {Element|string} element - The target element or selector for insertion
 * @param {string} [insertPosition='append'] - 'before', 'after', or 'append' (default)
 */
export function addToHoldingTank(song_id, element, insertPosition) {
  return database.getSongById(song_id).then(result => {
    if (result.success && result.data.length > 0) {
      const row = result.data[0];
      const title = row.title || "[Unknown Title]";
      const artist = row.artist || "[Unknown Artist]";
      const time = row.time || "[??:??]";

      const existing_song = document.querySelector(`.holding_tank.active .list-group-item[songid="${song_id}"]`);
      let song_row;
      if (existing_song) {
        song_row = existing_song; // already in DOM; will be moved below
      } else {
        song_row = document.createElement("li");
        song_row.style.fontSize = `11px`; // Default font size since getFontSize was removed
        song_row.className = "song list-group-item context-menu";
        song_row.setAttribute("draggable", "true");
        song_row.addEventListener('dragstart', songDrag);
        song_row.setAttribute("songid", song_id);
        song_row.textContent = `${title} by ${artist} (${time})`;
      }

      const targetEl = element && element.nodeType ? element : Dom.$(element);

      updateStateForInsertion(song_id, targetEl, insertPosition, existing_song);

      // Support precise insertion when a position is specified (from drop indicator)
      if (insertPosition === 'before' && targetEl?.matches?.('li')) {
        targetEl.parentNode.insertBefore(song_row, targetEl);
      } else if (insertPosition === 'after' && targetEl?.matches?.('li')) {
        targetEl.parentNode.insertBefore(song_row, targetEl.nextSibling);
      } else if (targetEl?.matches?.('li')) {
        targetEl.insertAdjacentElement('afterend', song_row);
      } else if (targetEl?.matches?.('div')) {
        const ul = targetEl.querySelector('ul.active');
        (ul || targetEl).appendChild(song_row);
      } else if (targetEl?.appendChild) {
        targetEl.appendChild(song_row);
      }

      // Note: Save is now done by caller, not here, to avoid N saves during batch operations
      return { success: true, songId: song_id, title: title };
    } else {
      debugLog?.warn('Failed to get song by ID', {
        module: 'holding-tank',
        function: 'addToHoldingTank',
        songId: song_id,
        error: result.error
      });
      return { success: false, error: 'Song not found' };
    }
  }).catch(error => {
    debugLog?.warn('Database API error', {
      module: 'holding-tank',
      function: 'addToHoldingTank',
      songId: song_id,
      error: error.message
    });
    return { success: false, error: error.message };
  });
}

/**
 * Remove a song from the holding tank
 */
export function removeFromHoldingTank() {
  const songId = Dom.attr('#selected_row', 'songid');
  if (songId) {
    debugLog?.info('Preparing to remove song from holding tank', { 
      module: 'holding-tank',
      function: 'removeFromHoldingTank',
      songId: songId
    });
    
    return database.getSongById(songId).then(result => {
      if (result.success && result.data.length > 0) {
        const songRow = result.data[0];
        
        return customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`).then(confirmed => {
          if (confirmed) {
            debugLog?.info('Proceeding with removal from holding tank', { 
              module: 'holding-tank',
              function: 'removeFromHoldingTank',
              songId: songId
            });
            // Remove the selected row from the holding tank
            const selected = document.getElementById('selected_row');
            if (selected) {
              removeHoldingTankElement(selected);
              selected.remove();
            }
            // Clear the selection
            document.getElementById('selected_row')?.removeAttribute('id');
            // Save the updated holding tank to store
            requestProfileStateSave();
            window.secureElectronAPI?.analytics?.trackEvent?.('holding_tank_used', { action: 'remove' });
            return { success: true, songId: songId, title: songRow.title };
          } else {
            return { success: false, error: 'User cancelled' };
          }
        });
      } else {
        debugLog?.error('Song not found in database for ID', { 
          module: 'holding-tank',
          function: 'removeFromHoldingTank',
          songId: songId
        });
        return { success: false, error: 'Song not found' };
      }
    }).catch(error => {
      debugLog?.warn('Database API error', { 
        module: 'holding-tank',
        function: 'removeFromHoldingTank',
        songId: songId,
        error: error.message
      });
      return { success: false, error: error.message };
    });
  } else {
    debugLog?.info('No songId found on selected row', { 
      module: 'holding-tank',
      function: 'removeFromHoldingTank'
    });
    return Promise.resolve({ success: false, error: 'No song selected' });
  }
}

/**
 * Remove selected song from holding tank (for Delete key)
 * Removes immediately without confirmation dialog
 */
export function removeSelected() {
  const songId = Dom.attr('#selected_row', 'songid');
  if (songId) {
    debugLog?.info('Removing selected song from holding tank via Delete key', { 
      module: 'holding-tank',
      function: 'removeSelected',
      songId: songId
    });
    
    // Remove the selected row from the holding tank immediately
    const selected = document.getElementById('selected_row');
    if (selected) {
      removeHoldingTankElement(selected);
      selected.remove();
      // Clear the selection
      document.getElementById('selected_row')?.removeAttribute('id');
      // Save the updated holding tank to store
      requestProfileStateSave();
      
      debugLog?.info('Song removed from holding tank successfully', { 
        module: 'holding-tank',
        function: 'removeSelected',
        songId: songId
      });
      
      return { success: true, songId: songId };
    } else {
      debugLog?.warn('Selected row not found in DOM', { 
        module: 'holding-tank',
        function: 'removeSelected'
      });
      return { success: false, error: 'Selected row not found' };
    }
  } else {
    debugLog?.info('No songId found on selected row', { 
      module: 'holding-tank',
      function: 'removeSelected'
    });
    return { success: false, error: 'No song selected' };
  }
}

/**
 * Clear all songs from the holding tank
 */
export async function clearHoldingTank() {
  const confirmed = await customConfirm("Are you sure you want clear your holding tank?");
  if (confirmed) {
    clearActiveHoldingTankState();
    Dom.empty('.holding_tank.active');
    requestProfileStateSave();
    window.secureElectronAPI?.analytics?.trackEvent?.('holding_tank_used', { action: 'clear' });
    return { success: true };
  } else {
    return { success: false, error: 'User cancelled' };
  }
}

/**
 * Open holding tank file
 */
export function openHoldingTankFile() {
  return secureFileDialog.openHoldingTankFile();
}

/**
 * Save holding tank to file
 */
export function saveHoldingTankFile() {
  debugLog?.info('Renderer starting saveHoldingTankFile', { 
    module: 'holding-tank',
    function: 'saveHoldingTankFile'
  });
  const holdingTankArray = holdingTankState.toSnapshot()[getActiveHoldingTankTabNumber() - 1]?.songIds || [];
  return secureFileDialog.saveHoldingTankFile(holdingTankArray);
}

// Mode management functions moved to dedicated mode-management module

/**
 * Handle drag and drop for holding tank
 */
export function holdingTankDrop(event) {
  event.preventDefault();
  addToHoldingTank(event.dataTransfer.getData("text"), event.target).then(result => {
    if (result && result.success) {
      // Save holding tank state after adding
      requestProfileStateSave();
    }
  }).catch(err => { debugLog?.warn('Failed to add song to holding tank (drop)', { module: 'holding-tank', function: 'holdingTankDrop', error: err?.message }); });
}

/**
 * Send selected song to holding tank
 */
export function sendToHoldingTank() {
  const target = Dom.$('.holding_tank.active');
  const song_id = Dom.attr('#selected_row', 'songid');
  if (song_id) {
    addToHoldingTank(song_id, target).then(result => {
      if (result && result.success) {
        // Save holding tank state after adding
        requestProfileStateSave();
      }
    }).catch(err => { debugLog?.warn('Failed to send song to holding tank', { module: 'holding-tank', function: 'sendToHoldingTank', error: err?.message }); });
  }
  return false;
}

/**
 * Rename holding tank tab
 */
export async function renameHoldingTankTab() {
  const currentName = Dom.text('#holding_tank_tabs .nav-link.active');
  const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Holding Tank Tab");
  if (newName && newName.trim() !== "") {
    Dom.text('#holding_tank_tabs .nav-link.active', newName);
    const tabNumber = Number(document.querySelector('#holding_tank_tabs .nav-link.active')
      ?.getAttribute('href')?.match(/^#holding_tank_(\d)$/)?.[1]);
    if (tabNumber) holdingTankState.renameTab(tabNumber, newName);
    requestProfileStateSave();
    return { success: true, newName: newName };
  } else {
    return { success: false, error: 'Invalid name' };
  }
}

// toggleAutoPlay function moved to mode-management module

/**
 * Cancel autoplay
 */
export function cancel_autoplay() {
  {
    const col = Dom.$('#holding-tank-column');
    const sel = Dom.$('#selected_row');
    if (!(col && sel && col.contains(sel))) {
    // Only cancel autoplay if we're not in the holding tank
    if (holdingTankMode === "playlist") {
      _autoplay = false;
      if (typeof window.setHoldingTankMode === 'function') {
        window.setHoldingTankMode("storage");
      }
    }
    }
  }
}

/**
 * Wrapper for requestProfileStateSave - includes state updates for Function Registry
 */
function requestProfileStateSaveWrapper() {
  debugLog?.info('Saving holding tank to store and refreshing display');
  requestProfileStateSave().then(() => {
    debugLog?.info('Holding tank saved successfully');
    // Optionally adjust layout without repopulating
    try { 
      scaleScrollable(); 
    } catch (error) {
      debugLog?.warn('Failed to scale scrollable elements after saving', { 
        module: 'holding-tank', 
        function: 'requestProfileStateSaveWrapper',
        error: error?.message || 'Unknown error' 
      });
    }
  }).catch(error => {
    debugLog?.error('Error saving holding tank to store', error);
  });
}

/**
 * Wrapper for clearHoldingTank used by HTML-compatible callers.
 */
function clearHoldingTankWrapper() {
  clearHoldingTank().catch(error => {
    debugLog?.error('Error in clearHoldingTank', error);
  });
}

/**
 * Wrapper for renameHoldingTankTab used by HTML-compatible callers.
 */
function renameHoldingTankTabWrapper() {
  renameHoldingTankTab().catch(error => {
    debugLog?.error('Error in renameHoldingTankTab', error);
  });
}

// Export all functions
const holdingTankModule = {
  initHoldingTank,
  requestProfileStateSave,
  populateHoldingTank,
  addToHoldingTank,
  removeFromHoldingTank,
  removeSelected,
  clearHoldingTank,
  openHoldingTankFile,
  saveHoldingTankFile,
  holdingTankDrop,
  sendToHoldingTank,
  renameHoldingTankTab,
  cancel_autoplay,
  scaleScrollable,
  // Wrapper functions for HTML compatibility
  clearHoldingTankWrapper,
  renameHoldingTankTabWrapper,
  requestProfileStateSaveWrapper,
  getHoldingTankSnapshot,
  loadHoldingTankSnapshot,
  clearSongFromHoldingTankState,
  removeHoldingTankElement,
  clearActiveHoldingTankState,
  renameHoldingTankStateTab,
  moveHoldingTankItem,
  restoreHoldingTankSnapshot
};

function initializeHoldingTank(options = {}) {
  moduleRegistry = options.moduleRegistry || {};
  electronAPI = options.electronAPI || window.secureElectronAPI;
  return holdingTankModule;
}

export { initializeHoldingTank };
export default initializeHoldingTank;
