/**
 * UI Manager Module (simplified, syntax-safe)
 * Provides UI helpers and delegates heavy actions to other modules.
 */

import { getSongFontSize, setSongFontSize } from './song-font-size.js';
import { scaleScrollable } from '../utils/index.js';

let debugLog = null;
try { 
  debugLog = window.debugLog || null; 
} catch {
  // debugLog not available yet during early initialization - this is expected
}

export default function initializeUIManager(options = {}) {
  const { electronAPI, moduleRegistry = {} } = options;
  // One size for every song row (ui/song-font-size.js)
  function getFontSize() { return getSongFontSize(); }

  function setFontSize(size) {
    return setSongFontSize(size, electronAPI);
  }

  async function editSelectedSong() {
    try {
      if (moduleRegistry.songManagement?.editSelectedSong) {
        return await moduleRegistry.songManagement.editSelectedSong();
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
      if (moduleRegistry.songManagement?.deleteSelectedSong) {
        return await moduleRegistry.songManagement.deleteSelectedSong();
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

  return {
    scaleScrollable,
    getFontSize,
    setFontSize,
    editSelectedSong,
    deleteSelectedSong
  };
}
