/**
 * Preload Module Entry Point
 * 
 * This is the main entry point for the preload process in the MxVoice Electron application.
 * It handles IPC bridge setup, API exposure, and database initialization.
 */

import { ipcRenderer, contextBridge } from 'electron';
import { Howl, Howler } from 'howler';
import log from 'electron-log';
import { initializeMainDebugLog } from '../main/modules/debug-log.js';
import Store from 'electron-store';

// Import preload modules
import * as ipcBridge from './modules/ipc-bridge.js';
import * as apiExposer from './modules/api-exposer.js';
import * as databaseSetup from './modules/database-setup.js';
import * as secureApiExposer from './modules/secure-api-exposer.js';

// Initialize debug logger
const store = new Store();
const debugLog = initializeMainDebugLog({ store });

console.log = log.log;

// Initialize database
const db = databaseSetup.initializeDatabase();

// Setup global exposure with database instance
apiExposer.setupGlobalExposure(db);

// Register IPC handlers
ipcBridge.registerIpcHandlers();

// Set the database in the legacy globals
apiExposer.setDatabaseInstance(db);

// Initialize secure API exposer (for Phase 1 testing)
try {
  const secureAPIExposed = secureApiExposer.exposeSecureAPI();
  if (secureAPIExposed) {
    debugLog.info('✅ Secure API exposed for Phase 1 testing');
  } else {
    debugLog.info('ℹ️ Secure API infrastructure ready but not exposed (context isolation disabled - expected in Phase 1)');
  }
} catch (error) {
  if (error.message.includes('contextIsolation')) {
    debugLog.info('ℹ️ Secure API infrastructure ready (context isolation disabled - expected in Phase 1)');
  } else {
    debugLog.warn('⚠️ Secure API exposure failed:', error.message);
  }
}

// Test function to verify modular preload is working
function testModularPreload() {
  debugLog.debug('🧪 Testing Modular Preload...');
  
  // Test database setup
  const dbTest = databaseSetup.testDatabaseSetup();
  
  // Test API exposer
  const apiTest = apiExposer.testApiExposer();
  
  // Test IPC bridge
  const ipcTest = ipcBridge.testIpcBridge();
  
  // Test secure API exposer
  const secureAPITest = secureApiExposer.testSecureAPI();
  
  if (dbTest && apiTest && ipcTest) {
    debugLog.info('✅ Modular preload is working correctly!');
    debugLog.info('📊 Secure API test result:', secureAPITest);
    return true;
  } else {
    debugLog.error('❌ Modular preload has issues');
    return false;
  }
}

// Make test function available globally
if (typeof window !== 'undefined') {
  window.testModularPreload = testModularPreload;
}

debugLog.info('Modular preload initialized successfully'); 