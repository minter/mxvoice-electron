// Phase 1 Testing Script for Mx. Voice Electron Modernization
// Run this in the browser console after starting the app

console.log('🧪 Starting Phase 1 Testing...');

// Test 1: Check if both old and new APIs are available
function testAPIAvailability() {
  console.log('\n📋 Test 1: API Availability');
  
  // Check old API
  if (typeof ipcRenderer !== 'undefined') {
    console.log('✅ Old API: ipcRenderer is available');
  } else {
    console.log('❌ Old API: ipcRenderer is NOT available');
  }
  
  // Check new API
  if (typeof window.electronAPI !== 'undefined') {
    console.log('✅ New API: window.electronAPI is available');
    console.log('Available methods:', Object.keys(window.electronAPI));
  } else {
    console.log('❌ New API: window.electronAPI is NOT available');
  }
  
  // Check other globals
  const requiredGlobals = ['db', 'store', 'path', 'fs'];
  requiredGlobals.forEach(globalName => {
    if (typeof window[globalName] !== 'undefined') {
      console.log(`✅ Global: ${globalName} is available`);
    } else {
      console.log(`❌ Global: ${globalName} is NOT available`);
    }
  });
}

// Test 2: Test new API functionality
async function testNewAPIs() {
  console.log('\n📋 Test 2: New API Functionality');
  
  if (!window.electronAPI) {
    console.log('❌ Cannot test new APIs - window.electronAPI not available');
    return;
  }
  
  try {
    // Test getAppPath
    console.log('Testing getAppPath...');
    const appPath = await window.electronAPI.getAppPath();
    console.log('✅ getAppPath works:', appPath);
  } catch (error) {
    console.log('❌ getAppPath failed:', error.message);
  }
  
  try {
    // Test showDirectoryPicker (this will open a dialog)
    console.log('Testing showDirectoryPicker...');
    const result = await window.electronAPI.showDirectoryPicker();
    console.log('✅ showDirectoryPicker works:', result);
  } catch (error) {
    console.log('❌ showDirectoryPicker failed:', error.message);
  }
  
  // Test UI operations (these send messages to main process)
  try {
    console.log('Testing UI operations...');
    await window.electronAPI.increaseFontSize();
    console.log('✅ increaseFontSize works');
  } catch (error) {
    console.log('❌ increaseFontSize failed:', error.message);
  }
  
  try {
    await window.electronAPI.decreaseFontSize();
    console.log('✅ decreaseFontSize works');
  } catch (error) {
    console.log('❌ decreaseFontSize failed:', error.message);
  }
  
  try {
    await window.electronAPI.toggleWaveform();
    console.log('✅ toggleWaveform works');
  } catch (error) {
    console.log('❌ toggleWaveform failed:', error.message);
  }
}

// Test 3: Test old API functionality
function testOldAPIs() {
  console.log('\n📋 Test 3: Old API Functionality');
  
  if (typeof ipcRenderer === 'undefined') {
    console.log('❌ Cannot test old APIs - ipcRenderer not available');
    return;
  }
  
  // Test old IPC send
  try {
    console.log('Testing old IPC send...');
    ipcRenderer.send('open-hotkey-file');
    console.log('✅ Old IPC send works');
  } catch (error) {
    console.log('❌ Old IPC send failed:', error.message);
  }
  
  // Test old IPC invoke
  try {
    console.log('Testing old IPC invoke...');
    ipcRenderer.invoke('get-app-path').then(result => {
      console.log('✅ Old IPC invoke works:', result);
    }).catch(error => {
      console.log('❌ Old IPC invoke failed:', error.message);
    });
  } catch (error) {
    console.log('❌ Old IPC invoke failed:', error.message);
  }
}

// Test 4: Test database functionality
function testDatabaseFunctionality() {
  console.log('\n📋 Test 4: Database Functionality');
  
  if (typeof window.db === 'undefined') {
    console.log('❌ Cannot test database - db not available');
    return;
  }
  
  try {
    // Test database query
    const stmt = window.db.prepare("SELECT COUNT(*) as count FROM categories");
    const result = stmt.get();
    console.log('✅ Database query works:', result);
  } catch (error) {
    console.log('❌ Database query failed:', error.message);
  }
  
  try {
    // Test store functionality
    const testValue = window.store.get('browser_width');
    console.log('✅ Store get works:', testValue);
  } catch (error) {
    console.log('❌ Store get failed:', error.message);
  }
}

// Test 5: Test hybrid approach
async function testHybridApproach() {
  console.log('\n📋 Test 5: Hybrid Approach');
  
  // Test both APIs for the same functionality
  try {
    console.log('Testing both APIs for getAppPath...');
    
    // New API
    const newResult = await window.electronAPI.getAppPath();
    console.log('✅ New API getAppPath:', newResult);
    
    // Old API
    const oldResult = await ipcRenderer.invoke('get-app-path');
    console.log('✅ Old API getAppPath:', oldResult);
    
    // Compare results
    if (newResult === oldResult) {
      console.log('✅ Both APIs return the same result');
    } else {
      console.log('⚠️ APIs return different results');
    }
  } catch (error) {
    console.log('❌ Hybrid test failed:', error.message);
  }
}

// Test 6: Test existing app functionality
function testExistingFunctionality() {
  console.log('\n📋 Test 6: Existing App Functionality');
  
  // Test if key functions are available
  const requiredFunctions = [
    'openHotkeyFile',
    'saveHotkeyFile', 
    'openHoldingTankFile',
    'saveHoldingTankFile',
    'searchData',
    'populateCategorySelect'
  ];
  
  requiredFunctions.forEach(funcName => {
    if (typeof window[funcName] === 'function') {
      console.log(`✅ Function ${funcName} is available`);
    } else {
      console.log(`❌ Function ${funcName} is NOT available`);
    }
  });
  
  // Test if key DOM elements exist
  const requiredElements = [
    '#search_results',
    '#category_select',
    '#omni_search'
  ];
  
  requiredElements.forEach(selector => {
    if ($(selector).length > 0) {
      console.log(`✅ Element ${selector} exists`);
    } else {
      console.log(`❌ Element ${selector} does NOT exist`);
    }
  });
}

// Run all tests
function runAllTests() {
  console.log('🚀 Starting comprehensive Phase 1 testing...\n');
  
  testAPIAvailability();
  testNewAPIs();
  testOldAPIs();
  testDatabaseFunctionality();
  testHybridApproach();
  testExistingFunctionality();
  
  console.log('\n🎉 Phase 1 testing complete!');
  console.log('\n📊 Summary:');
  console.log('- If all tests show ✅, Phase 1 is working correctly');
  console.log('- If any tests show ❌, there may be issues to address');
  console.log('- The hybrid approach should allow both old and new APIs to work');
}

// Make functions available globally
window.testPhase1 = {
  testAPIAvailability,
  testNewAPIs,
  testOldAPIs,
  testDatabaseFunctionality,
  testHybridApproach,
  testExistingFunctionality,
  runAllTests
};

console.log('✅ Phase 1 test functions loaded!');
console.log('Run window.testPhase1.runAllTests() to start testing'); 