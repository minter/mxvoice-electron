// Test script for modular preload
// This can be run to test the modular preload functionality

console.log('🧪 Testing Modular Preload Components...');

// Test database setup module
try {
  const databaseSetup = require('./preload/modules/database-setup');
  console.log('✅ Database setup module loaded');
  
  const dbTest = databaseSetup.testDatabaseSetup();
  if (dbTest) {
    console.log('✅ Database setup test passed');
  } else {
    console.log('❌ Database setup test failed');
  }
} catch (error) {
  console.error('❌ Database setup module error:', error);
}

// Test API exposer module
try {
  const apiExposer = require('./preload/modules/api-exposer');
  console.log('✅ API exposer module loaded');
  
  const apiTest = apiExposer.testApiExposer();
  if (apiTest) {
    console.log('✅ API exposer test passed');
  } else {
    console.log('❌ API exposer test failed');
  }
} catch (error) {
  console.error('❌ API exposer module error:', error);
}

// Test IPC bridge module
try {
  const ipcBridge = require('./preload/modules/ipc-bridge');
  console.log('✅ IPC bridge module loaded');
  
  const ipcTest = ipcBridge.testIpcBridge();
  if (ipcTest) {
    console.log('✅ IPC bridge test passed');
  } else {
    console.log('❌ IPC bridge test failed');
  }
} catch (error) {
  console.error('❌ IPC bridge module error:', error);
}

console.log('🧪 Modular preload component tests completed'); 