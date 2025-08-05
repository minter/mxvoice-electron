/**
 * UI Module Function Registry
 * 
 * Defines which functions from the ui module should be globally available
 */

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
  scaleScrollableFallback: () => console.warn('⚠️ UI module not available - scaleScrollable'),
  editSelectedSongFallback: () => console.warn('⚠️ UI module not available - editSelectedSong'),
  deleteSelectedSongFallback: () => console.warn('⚠️ UI module not available - deleteSelectedSong'),
  closeAllTabsFallback: () => console.warn('⚠️ UI module not available - closeAllTabs'),
  toggleSelectedRowFallback: () => console.warn('⚠️ UI module not available - toggleSelectedRow'),
  switchToHotkeyTabFallback: () => console.warn('⚠️ UI module not available - switchToHotkeyTab'),
  increaseFontSizeFallback: () => console.warn('⚠️ UI module not available - increaseFontSize'),
  decreaseFontSizeFallback: () => console.warn('⚠️ UI module not available - decreaseFontSize'),
  toggleWaveformFallback: () => console.warn('⚠️ UI module not available - toggleWaveform'),
  getFontSizeFallback: () => console.warn('⚠️ UI module not available - getFontSize'),
  setFontSizeFallback: () => console.warn('⚠️ UI module not available - setFontSize')
};

export default uiFunctions; 