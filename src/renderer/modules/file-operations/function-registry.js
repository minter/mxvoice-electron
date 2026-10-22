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
} catch (_error) {
  // Debug logger not available
}

export const fileOperationsFunctions = {
  // System operations
  pickDirectory: 'pickDirectory',
  
  // Auto-update operations
  startUpdateProcess: 'startUpdateProcess',
  
  // Fallback functions for when module fails to load
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