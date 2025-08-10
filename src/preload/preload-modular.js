/**
 * Preload Module Entry Point
 * 
 * This is the main entry point for the preload process in the MxVoice Electron application.
 * It handles IPC bridge setup, API exposure, and database initialization.
 * 
 * CONTEXT ISOLATION ENABLED - This version uses secure API exposure via contextBridge.
 */

import { ipcRenderer, contextBridge } from 'electron';
import { Howl, Howler } from 'howler';
import log from 'electron-log';
import { initializeMainDebugLog } from '../main/modules/debug-log.js';
import Store from 'electron-store';

// Import preload modules
import * as ipcBridge from './modules/ipc-bridge.js';
import * as secureApiExposer from './modules/secure-api-exposer.js';

// Initialize debug logger
const store = new Store();
const debugLog = initializeMainDebugLog({ store });

console.log = log.log;

// Register IPC handlers
ipcBridge.registerIpcHandlers();

// Enable context isolation by exposing secure API via contextBridge
try {
  const secureAPIExposed = secureApiExposer.exposeSecureAPI();
  if (secureAPIExposed) {
    debugLog.info('✅ Secure API exposed via contextBridge (context isolation enabled)');
  } else {
    debugLog.error('❌ Failed to expose secure API - context isolation may not work properly');
  }
} catch (error) {
  debugLog.error('❌ Secure API exposure failed:', error.message);
}

// Test function to verify modular preload is working
function testModularPreload() {
  debugLog.debug('🧪 Testing Modular Preload...');
  
  // Test IPC bridge
  const ipcTest = ipcBridge.testIpcBridge();
  
  // Test secure API exposer
  const secureAPITest = secureApiExposer.testSecureAPI();
  
  if (ipcTest) {
    debugLog.info('✅ Modular preload is working correctly!');
    debugLog.info('📊 Secure API test result:', secureAPITest);
    return true;
  } else {
    debugLog.error('❌ Modular preload has issues');
    return false;
  }
}

// Make test function available globally via contextBridge
if (typeof window !== 'undefined') {
  // Note: In context isolation, we can't directly set window properties
  // The test function is available through the secure API
  debugLog.info('Preload script loaded in renderer context');
}

debugLog.info('Modular preload initialized successfully with context isolation enabled'); 