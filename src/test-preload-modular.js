// Test script for preload modularization
const preloadModular = require('./preload/preload-modular');

console.log('🧪 Testing Preload Modularization...');
console.log('=====================================');

// Test individual modules
console.log('\n1. Testing IPC Bridge Module...');
const ipcBridge = preloadModular.ipcBridge;
console.log('IPC Bridge available:', !!ipcBridge ? '✅ YES' : '❌ NO');
console.log('IPC Handlers count:', Object.keys(ipcBridge.getIpcHandlers()).length);

console.log('\n2. Testing API Exposer Module...');
const apiExposer = preloadModular.apiExposer;
console.log('API Exposer available:', !!apiExposer ? '✅ YES' : '❌ NO');
console.log('ElectronAPI methods:', Object.keys(apiExposer.electronAPI).length);
console.log('Legacy globals count:', Object.keys(apiExposer.legacyGlobals).length);

console.log('\n3. Testing Database Setup Module...');
const databaseSetup = preloadModular.databaseSetup;
console.log('Database Setup available:', !!databaseSetup ? '✅ YES' : '❌ NO');

console.log('\n4. Testing Database Connection...');
const db = preloadModular.db;
console.log('Database connection available:', !!db ? '✅ YES' : '❌ NO');

// Run comprehensive test
console.log('\n5. Running Comprehensive Test...');
const testResult = preloadModular.testPreloadModular();

console.log('\n=====================================');
console.log('🎯 PRELOAD MODULARIZATION TEST RESULTS');
console.log('=====================================');
console.log('Overall test result:', testResult ? '✅ PASSED' : '❌ FAILED');

if (testResult) {
  console.log('✅ Preload modularization is working correctly!');
  console.log('✅ All modules are properly initialized');
  console.log('✅ Database connection is established');
  console.log('✅ IPC handlers are registered');
  console.log('✅ API exposure is configured');
} else {
  console.log('❌ Preload modularization has issues');
  console.log('❌ Check the individual test results above');
}

console.log('\n📋 Next Steps:');
console.log('1. Update package.json to use preload-modular.js');
console.log('2. Test the application with the new preload');
console.log('3. Verify all functionality still works');
console.log('4. Move to main process modularization');

module.exports = {
  testResult,
  preloadModular
}; 