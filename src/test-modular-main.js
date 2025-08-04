// Test script for modular main process
// This can be run to test the modular main process functionality

console.log('🧪 Testing Modular Main Process Components...');

// Test app setup module
try {
  const appSetup = require('./main/modules/app-setup');
  console.log('✅ App setup module loaded');
  
  const appSetupTest = appSetup.testAppSetup();
  if (appSetupTest) {
    console.log('✅ App setup test passed');
  } else {
    console.log('❌ App setup test failed');
  }
} catch (error) {
  console.error('❌ App setup module error:', error);
}

// Test IPC handlers module
try {
  const ipcHandlers = require('./main/modules/ipc-handlers');
  console.log('✅ IPC handlers module loaded');
  
  const ipcHandlersTest = ipcHandlers.testIpcHandlers();
  if (ipcHandlersTest) {
    console.log('✅ IPC handlers test passed');
  } else {
    console.log('❌ IPC handlers test failed');
  }
} catch (error) {
  console.error('❌ IPC handlers module error:', error);
}

// Test file operations module
try {
  const fileOperations = require('./main/modules/file-operations');
  console.log('✅ File operations module loaded');
  
  const fileOperationsTest = fileOperations.testFileOperations();
  if (fileOperationsTest) {
    console.log('✅ File operations test passed');
  } else {
    console.log('❌ File operations test failed');
  }
} catch (error) {
  console.error('❌ File operations module error:', error);
}

console.log('🧪 Modular main process component tests completed'); 