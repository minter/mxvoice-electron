/**
 * Preload Module Entry Point
 * 
 * This is the main entry point for the preload process in the MxVoice Electron application.
 * It handles IPC bridge setup, API exposure, and database initialization.
 */

import { ipcRenderer, contextBridge } from 'electron';
import { Howl, Howler } from 'howler';
import log from 'electron-log';

// Import preload modules
import * as ipcBridge from './modules/ipc-bridge.js';
import * as apiExposer from './modules/api-exposer.js';
import * as databaseSetup from './modules/database-setup.js';

console.log = log.log;

// Initialize database
const db = databaseSetup.initializeDatabase();

// Setup global exposure with database instance
apiExposer.setupGlobalExposure(db);

// Register IPC handlers
ipcBridge.registerIpcHandlers();

// Set the database in the legacy globals
apiExposer.setDatabaseInstance(db);

// Test function to verify modular preload is working
function testModularPreload() {
  console.log('🧪 Testing Modular Preload...');
  
  // Test database setup
  const dbTest = databaseSetup.testDatabaseSetup();
  
  // Test API exposer
  const apiTest = apiExposer.testApiExposer();
  
  // Test IPC bridge
  const ipcTest = ipcBridge.testIpcBridge();
  
  if (dbTest && apiTest && ipcTest) {
    console.log('✅ Modular preload is working correctly!');
    return true;
  } else {
    console.log('❌ Modular preload has issues');
    return false;
  }
}

// Make test function available globally
if (typeof window !== 'undefined') {
  window.testModularPreload = testModularPreload;
}

console.log('Modular preload initialized successfully'); 