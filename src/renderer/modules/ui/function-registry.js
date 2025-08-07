/**
 * UI Module Function Registry
 * 
 * Defines which functions from the ui module should be globally available
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

export const uiFunctions = {
  // UI scaling and layout functions
  scaleScrollable: 'scaleScrollable',
  
  // Song management UI functions
  editSelectedSong: 'editSelectedSong',
  deleteSelectedSong: 'deleteSelectedSong',
  
  // Tab management functions
  closeAllTabs: 'closeAllTabs',
  toggleSelectedRow: 'toggleSelectedRow',
  switchToHotkeyTab: 'switchToHotkeyTab',
  
  // Font and display functions
  increaseFontSize: 'increaseFontSize',
  decreaseFontSize: 'decreaseFontSize',
  toggleWaveform: 'toggleWaveform',
  getFontSize: 'getFontSize',
  setFontSize: 'setFontSize',
  
  // Fallback functions for when module fails to load
  scaleScrollableFallback: () => debugLog?.warn('UI module not available - scaleScrollable', { 
    module: 'ui-function-registry',
    function: 'scaleScrollableFallback'
  }),
  editSelectedSongFallback: () => debugLog?.warn('UI module not available - editSelectedSong', { 
    module: 'ui-function-registry',
    function: 'editSelectedSongFallback'
  }),
  deleteSelectedSongFallback: () => debugLog?.warn('UI module not available - deleteSelectedSong', { 
    module: 'ui-function-registry',
    function: 'deleteSelectedSongFallback'
  }),
  closeAllTabsFallback: () => debugLog?.warn('UI module not available - closeAllTabs', { 
    module: 'ui-function-registry',
    function: 'closeAllTabsFallback'
  }),
  toggleSelectedRowFallback: () => debugLog?.warn('UI module not available - toggleSelectedRow', { 
    module: 'ui-function-registry',
    function: 'toggleSelectedRowFallback'
  }),
  switchToHotkeyTabFallback: () => debugLog?.warn('UI module not available - switchToHotkeyTab', { 
    module: 'ui-function-registry',
    function: 'switchToHotkeyTabFallback'
  }),
  increaseFontSizeFallback: () => debugLog?.warn('UI module not available - increaseFontSize', { 
    module: 'ui-function-registry',
    function: 'increaseFontSizeFallback'
  }),
  decreaseFontSizeFallback: () => debugLog?.warn('UI module not available - decreaseFontSize', { 
    module: 'ui-function-registry',
    function: 'decreaseFontSizeFallback'
  }),
  toggleWaveformFallback: () => debugLog?.warn('UI module not available - toggleWaveform', { 
    module: 'ui-function-registry',
    function: 'toggleWaveformFallback'
  }),
  getFontSizeFallback: () => debugLog?.warn('UI module not available - getFontSize', { 
    module: 'ui-function-registry',
    function: 'getFontSizeFallback'
  }),
  setFontSizeFallback: () => debugLog?.warn('UI module not available - setFontSize', { 
    module: 'ui-function-registry',
    function: 'setFontSizeFallback'
  })
};

export default uiFunctions; 