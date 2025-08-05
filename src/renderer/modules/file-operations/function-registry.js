/**
 * File Operations Module Function Registry
 * 
 * Defines which functions from the file-operations module should be globally available
 */

export const fileOperationsFunctions = {
  // File loading functions
  openHotkeyFile: 'openHotkeyFile',
  openHoldingTankFile: 'openHoldingTankFile',
  
  // File saving functions
  saveHotkeyFile: 'saveHotkeyFile',
  saveHoldingTankFile: 'saveHoldingTankFile',
  
  // System operations
  pickDirectory: 'pickDirectory',
  installUpdate: 'installUpdate',
  
  // Fallback functions for when module fails to load
  openHotkeyFileFallback: () => console.warn('⚠️ File operations not available - openHotkeyFile'),
  openHoldingTankFileFallback: () => console.warn('⚠️ File operations not available - openHoldingTankFile'),
  saveHotkeyFileFallback: () => console.warn('⚠️ File operations not available - saveHotkeyFile'),
  saveHoldingTankFileFallback: () => console.warn('⚠️ File operations not available - saveHoldingTankFile'),
  pickDirectoryFallback: () => console.warn('⚠️ File operations not available - pickDirectory'),
  installUpdateFallback: () => console.warn('⚠️ File operations not available - installUpdate')
};

export default fileOperationsFunctions; 