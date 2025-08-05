/**
 * Database Operations Test for Electron Environment
 * 
 * This script should be run within the Electron application to test
 * database operations with real database access.
 * 
 * Usage: Add this to your renderer process and call the test functions
 */

// Test functions for use within Electron
function testDatabaseOperationsInElectron() {
  console.log('🧪 Testing Database Operations in Electron Environment');
  console.log('=====================================================\n');

  // Test category operations
  testCategoryOperations();
  
  // Test song operations
  testSongOperations();
  
  // Test query operations
  testQueryOperations();
  
  // Test data population
  testDataPopulation();
  
  // Test store operations
  testStoreOperations();
  
  // Test UI operations
  testUIOperations();
}

function testCategoryOperations() {
  console.log('📂 Testing Category Operations...\n');
  
  // Test addNewCategory
  console.log('1. Testing addNewCategory...');
  databaseModule.addNewCategory('Electron Test Category')
    .then(result => {
      console.log('   ✅ addNewCategory result:', result);
      
      // Test editCategory
      console.log('\n2. Testing editCategory...');
      return databaseModule.editCategory('TEST', 'Updated Electron Test Category');
    })
    .then(result => {
      console.log('   ✅ editCategory result:', result);
      
      // Test deleteCategory
      console.log('\n3. Testing deleteCategory...');
      return databaseModule.deleteCategory('TEST', 'Updated Electron Test Category');
    })
    .then(result => {
      console.log('   ✅ deleteCategory result:', result);
    })
    .catch(error => {
      console.log('   ❌ Error:', error.message);
    });
}

function testSongOperations() {
  console.log('\n🎵 Testing Song Operations...\n');
  
  const mockSongData = {
    title: 'Electron Test Song',
    artist: 'Electron Test Artist',
    category: 'ROCK',
    info: 'Test song for Electron database operations',
    filename: 'electron-test-song.mp3',
    duration: '03:30'
  };
  
  // Test saveNewSong
  console.log('1. Testing saveNewSong...');
  databaseModule.saveNewSong(mockSongData)
    .then(result => {
      console.log('   ✅ saveNewSong result:', result);
      
      if (result && result.lastInsertRowid) {
        // Test getSongById
        console.log('\n2. Testing getSongById...');
        return databaseModule.getSongById(result.lastInsertRowid);
      }
    })
    .then(result => {
      if (result) {
        console.log('   ✅ getSongById result:', result);
        
        // Test saveEditedSong
        console.log('\n3. Testing saveEditedSong...');
        const editSongData = {
          ...mockSongData,
          id: result.data[0].id,
          title: 'Updated Electron Test Song'
        };
        return databaseModule.saveEditedSong(editSongData);
      }
    })
    .then(result => {
      if (result) {
        console.log('   ✅ saveEditedSong result:', result);
        
        // Test deleteSong
        console.log('\n4. Testing deleteSong...');
        return databaseModule.deleteSong(result.data[0].id);
      }
    })
    .then(result => {
      if (result) {
        console.log('   ✅ deleteSong result:', result);
      }
    })
    .catch(error => {
      console.log('   ❌ Error:', error.message);
    });
}

function testQueryOperations() {
  console.log('\n🔍 Testing Query Operations...\n');
  
  // Test executeQuery
  console.log('1. Testing executeQuery...');
  databaseModule.executeQuery('SELECT COUNT(*) as count FROM categories')
    .then(result => {
      console.log('   ✅ executeQuery result:', result);
      
      // Test executeStatement
      console.log('\n2. Testing executeStatement...');
      return databaseModule.executeStatement(
        'INSERT OR REPLACE INTO categories VALUES(?, ?)',
        ['QUERY', 'Query Test Category']
      );
    })
    .then(result => {
      console.log('   ✅ executeStatement result:', result);
    })
    .catch(error => {
      console.log('   ❌ Error:', error.message);
    });
}

function testDataPopulation() {
  console.log('\n📊 Testing Data Population...\n');
  
  try {
    // Test populateCategorySelect
    console.log('1. Testing populateCategorySelect...');
    databaseModule.populateCategorySelect();
    console.log('   ✅ populateCategorySelect called successfully');
    
    // Test populateHotkeys
    console.log('\n2. Testing populateHotkeys...');
    const mockHotkeys = { f1: '123', f2: '456' };
    databaseModule.populateHotkeys(mockHotkeys, 'Test Hotkeys');
    console.log('   ✅ populateHotkeys called successfully');
    
    // Test populateHoldingTank
    console.log('\n3. Testing populateHoldingTank...');
    const mockSongIds = ['123', '456', '789'];
    databaseModule.populateHoldingTank(mockSongIds);
    console.log('   ✅ populateHoldingTank called successfully');
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

function testStoreOperations() {
  console.log('\n💾 Testing Store Operations...\n');
  
  try {
    // Test saveHoldingTankToStore
    console.log('1. Testing saveHoldingTankToStore...');
    databaseModule.saveHoldingTankToStore();
    console.log('   ✅ saveHoldingTankToStore called successfully');
    
    // Test saveHotkeysToStore
    console.log('\n2. Testing saveHotkeysToStore...');
    databaseModule.saveHotkeysToStore();
    console.log('   ✅ saveHotkeysToStore called successfully');
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

function testUIOperations() {
  console.log('\n🎨 Testing UI Operations...\n');
  
  try {
    // Test scaleScrollable
    console.log('1. Testing scaleScrollable...');
    databaseModule.scaleScrollable();
    console.log('   ✅ scaleScrollable called successfully');
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

// Make functions available globally for testing in Electron
if (typeof window !== 'undefined') {
  window.testDatabaseOperationsInElectron = testDatabaseOperationsInElectron;
  window.testCategoryOperations = testCategoryOperations;
  window.testSongOperations = testSongOperations;
  window.testQueryOperations = testQueryOperations;
  window.testDataPopulation = testDataPopulation;
  window.testStoreOperations = testStoreOperations;
  window.testUIOperations = testUIOperations;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testDatabaseOperationsInElectron,
    testCategoryOperations,
    testSongOperations,
    testQueryOperations,
    testDataPopulation,
    testStoreOperations,
    testUIOperations
  };
} 