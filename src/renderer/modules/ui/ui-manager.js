/**
 * UI Manager Module (simplified, syntax-safe)
 * Provides UI helpers and delegates heavy actions to other modules.
 */

import { secureStore } from '../adapters/secure-adapter.js';
import { scaleScrollable } from '../utils/index.js';

let debugLog = null;
try { 
  debugLog = window.debugLog || null; 
} catch (error) {
  // Fallback to prevent initialization failure
  console.warn('Failed to access window.debugLog during UI manager initialization', { 
    module: 'ui-manager', 
    function: 'ui-manager-init',
    error: error?.message || 'Unknown error' 
  });
}

export default function initializeUIManager(options = {}) {
  const { electronAPI } = options;
  let fontSize = 11;
  
  function getFontSize() { return fontSize; }

  function setFontSize(size) {
    fontSize = size;
    document.querySelectorAll('.song').forEach(el => { el.style.fontSize = fontSize + 'px'; });
    try {
      // Save to profile preferences (not global store)
      if (electronAPI && electronAPI.profile) {
        electronAPI.profile.setPreference('font_size', fontSize).catch(err => {
          debugLog?.warn('Failed to save font size to profile', { module: 'ui-manager', function: 'setFontSize', error: err });
        });
      } else if (electronAPI && electronAPI.store) {
        // Fallback to global store if profile API not available
        secureStore.set('font_size', fontSize).catch(err => {
          debugLog?.warn('Failed to save font size', { module: 'ui-manager', function: 'setFontSize', error: err });
        });
      }
    } catch (error) {
      debugLog?.warn('Failed to save font size', { 
        module: 'ui-manager', 
        function: 'setFontSize',
        error: error?.message || 'Unknown error' 
      });
    }
  }

  async function editSelectedSong() {
    try {
      if (window.moduleRegistry?.songManagement?.editSelectedSong) {
        return await window.moduleRegistry.songManagement.editSelectedSong();
      }
    } catch (error) {
      debugLog?.warn('Failed to call editSelectedSong in songManagement', { 
        module: 'ui-manager', 
        function: 'editSelectedSong',
        error: error?.message || 'Unknown error' 
      });
    }
    debugLog?.warn('editSelectedSong not available in songManagement');
  }

  async function deleteSelectedSong() {
    try {
      if (window.moduleRegistry?.songManagement?.deleteSelectedSong) {
        return await window.moduleRegistry.songManagement.deleteSelectedSong();
      }
    } catch (error) {
      debugLog?.warn('Failed to call deleteSelectedSong in songManagement', { 
        module: 'ui-manager', 
        function: 'deleteSelectedSong',
        error: error?.message || 'Unknown error' 
      });
    }
    debugLog?.warn('deleteSelectedSong not available in songManagement');
  }

  function closeAllTabs() {
    const reload = () => { 
      try { 
        location.reload(); 
      } catch (error) {
        debugLog?.warn('Failed to reload page', { 
          module: 'ui-manager', 
          function: 'reload',
          error: error?.message || 'Unknown error' 
        });
      } 
    };
    try {
        if (electronAPI && electronAPI.store) {
          // Note: In the new profile architecture, hotkeys and holding_tank are auto-saved to state.json
          // This clears any legacy stored data. Profile preferences (font_size, column_order) are intentionally preserved.
          Promise.all([
          secureStore.delete('holding_tank'),
          secureStore.delete('hotkeys'),
          secureStore.delete('column_order'), // Legacy cleanup
          secureStore.delete('font-size'), // Legacy cleanup (old key)
          secureStore.delete('font_size') // Current key cleanup
        ]).finally(reload);
      } else {
        reload();
      }
    } catch (error) {
      debugLog?.warn('Failed to clear store data during closeAllTabs', { 
        module: 'ui-manager', 
        function: 'closeAllTabs',
        error: error?.message || 'Unknown error' 
      });
      reload();
    }
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
