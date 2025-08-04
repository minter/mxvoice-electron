// Modular Preload Script
// Main entry point for preload functionality

const { ipcRenderer, contextBridge } = require('electron');
const { Howl, Howler } = require('howler');
const log = require('electron-log');

// Import modules
const ipcBridge = require('./modules/ipc-bridge');
const apiExposer = require('./modules/api-exposer');
const databaseSetup = require('./modules/database-setup');

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