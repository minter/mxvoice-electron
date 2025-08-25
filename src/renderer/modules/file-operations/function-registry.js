/**
 * File Operations Module Function Registry
 * 
 * Defines which functions from the file-operations module should be globally available
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

export const fileOperationsFunctions = {
  // File loading functions
  openHotkeyFile: 'openHotkeyFile',
  openHoldingTankFile: 'openHoldingTankFile',
  
  // File saving functions
  saveHotkeyFile: 'saveHotkeyFile',
  saveHoldingTankFile: 'saveHoldingTankFile',
  
  // System operations
  pickDirectory: 'pickDirectory',
  
  // Auto-update operations
  startUpdateProcess: 'startUpdateProcess',
  
  // Fallback functions for when module fails to load
  openHotkeyFileFallback: () => debugLog?.warn('⚠️ File operations not available - openHotkeyFile', { 
    module: 'file-operations',
    function: 'openHotkeyFileFallback'
  }),
  openHoldingTankFileFallback: () => debugLog?.warn('⚠️ File operations not available - openHoldingTankFile', { 
    module: 'file-operations',
    function: 'openHoldingTankFileFallback'
  }),
  saveHotkeyFileFallback: () => debugLog?.warn('⚠️ File operations not available - saveHotkeyFile', { 
    module: 'file-operations',
    function: 'saveHotkeyFileFallback'
  }),
  saveHoldingTankFileFallback: () => debugLog?.warn('⚠️ File operations not available - saveHoldingTankFile', { 
    module: 'file-operations',
    function: 'saveHoldingTankFileFallback'
  }),
  pickDirectoryFallback: () => debugLog?.warn('⚠️ File operations not available - pickDirectory', { 
    module: 'file-operations',
    function: 'pickDirectoryFallback'
  }),
  startUpdateProcessFallback: () => debugLog?.warn('⚠️ File operations not available - startUpdateProcess', { 
    module: 'file-operations',
    function: 'startUpdateProcessFallback'
  })
};

export default fileOperationsFunctions; 