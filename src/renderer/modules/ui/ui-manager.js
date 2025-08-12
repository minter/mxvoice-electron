/**
 * UI Manager Module (simplified, syntax-safe)
 * Provides UI helpers and delegates heavy actions to other modules.
 */

import { secureStore } from '../adapters/secure-adapter.js';

let debugLog = null;
try { debugLog = window.debugLog || null; } catch (_) {}

export default function initializeUIManager(options = {}) {
  const { electronAPI } = options;
  let fontSize = 11;

  function scaleScrollable() {
    const advEl = document.getElementById('advanced-search');
    const advancedSearchHeight = advEl && advEl.offsetParent !== null ? 38 : 0;
    const height = (window.innerHeight || document.documentElement.clientHeight) - 240 - advancedSearchHeight + 'px';
    document.querySelectorAll('.table-wrapper-scroll-y').forEach(el => { el.style.height = height; });
  }
  
  function getFontSize() { return fontSize; }

  function setFontSize(size) {
    fontSize = size;
    document.querySelectorAll('.song').forEach(el => { el.style.fontSize = fontSize + 'px'; });
    try {
    if (electronAPI && electronAPI.store) {
        secureStore.set('font-size', fontSize).catch(err => {
          debugLog?.warn('Failed to save font size', { module: 'ui-manager', function: 'setFontSize', error: err });
        });
      }
    } catch (_) {}
  }

  async function editSelectedSong() {
    try {
      if (window.moduleRegistry?.songManagement?.editSelectedSong) {
        return await window.moduleRegistry.songManagement.editSelectedSong();
      }
    } catch (_) {}
    debugLog?.warn('editSelectedSong not available in songManagement');
  }

  async function deleteSelectedSong() {
    try {
      if (window.moduleRegistry?.songManagement?.deleteSelectedSong) {
        return await window.moduleRegistry.songManagement.deleteSelectedSong();
      }
    } catch (_) {}
    debugLog?.warn('deleteSelectedSong not available in songManagement');
  }

  function closeAllTabs() {
    const reload = () => { try { location.reload(); } catch (_) {} };
    try {
        if (electronAPI && electronAPI.store) {
          Promise.all([
          secureStore.delete('holding_tank'),
          secureStore.delete('hotkeys'),
          secureStore.delete('column_order'),
          secureStore.delete('font-size')
        ]).finally(reload);
      } else {
        reload();
      }
    } catch (_) { reload(); }
  }
  
  return {
    scaleScrollable,
    getFontSize,
    setFontSize,
    editSelectedSong,
    deleteSelectedSong,
    closeAllTabs
  };
}
