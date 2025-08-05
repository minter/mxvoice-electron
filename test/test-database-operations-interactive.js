/**
 * Interactive Database Operations Test
 * 
 * This script allows you to test specific database operations interactively.
 * Run with: node src/test-database-operations-interactive.js
 */

const databaseModule = require('./renderer/modules/database');

console.log('🧪 Interactive Database Operations Test');
console.log('=====================================\n');

// Mock data for testing
const mockSongData = {
  title: 'Test Song',
  artist: 'Test Artist',
  category: 'ROCK',
  info: 'Test song for database operations',
  filename: 'test-song.mp3',
  duration: '03:30'
};

const mockCategoryData = {
  code: 'TEST',
  description: 'Test Category'
};

// Test functions
async function testCategoryOperations() {
  console.log('📂 Testing Category Operations...\n');
  
  try {
    // Test addNewCategory
    console.log('1. Testing addNewCategory...');
    const addResult = await databaseModule.addNewCategory('Interactive Test Category');
    console.log('   ✅ addNewCategory result:', addResult);
    
    // Test editCategory
    console.log('\n2. Testing editCategory...');
    const editResult = await databaseModule.editCategory('TEST', 'Updated Test Category');
    console.log('   ✅ editCategory result:', editResult);
    
    // Test deleteCategory
    console.log('\n3. Testing deleteCategory...');
    const deleteResult = await databaseModule.deleteCategory('TEST', 'Updated Test Category');
    console.log('   ✅ deleteCategory result:', deleteResult);
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

async function testSongOperations() {
  console.log('\n🎵 Testing Song Operations...\n');
  
  try {
    // Test saveNewSong
    console.log('1. Testing saveNewSong...');
    const saveResult = await databaseModule.saveNewSong(mockSongData);
    console.log('   ✅ saveNewSong result:', saveResult);
    
    // Test getSongById (if we have a song ID)
    if (saveResult && saveResult.lastInsertRowid) {
      console.log('\n2. Testing getSongById...');
      const getResult = await databaseModule.getSongById(saveResult.lastInsertRowid);
      console.log('   ✅ getSongById result:', getResult);
      
      // Test saveEditedSong
      console.log('\n3. Testing saveEditedSong...');
      const editSongData = {
        ...mockSongData,
        id: saveResult.lastInsertRowid,
        title: 'Updated Test Song'
      };
      const editResult = await databaseModule.saveEditedSong(editSongData);
      console.log('   ✅ saveEditedSong result:', editResult);
      
      // Test deleteSong
      console.log('\n4. Testing deleteSong...');
      const deleteResult = await databaseModule.deleteSong(saveResult.lastInsertRowid);
      console.log('   ✅ deleteSong result:', deleteResult);
    }
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

async function testQueryOperations() {
  console.log('\n🔍 Testing Query Operations...\n');
  
  try {
    // Test executeQuery
    console.log('1. Testing executeQuery...');
    const queryResult = await databaseModule.executeQuery('SELECT COUNT(*) as count FROM categories');
    console.log('   ✅ executeQuery result:', queryResult);
    
    // Test executeStatement
    console.log('\n2. Testing executeStatement...');
    const statementResult = await databaseModule.executeStatement(
      'INSERT OR REPLACE INTO categories VALUES(?, ?)',
      ['QUERY', 'Query Test Category']
    );
    console.log('   ✅ executeStatement result:', statementResult);
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

async function testBulkOperations() {
  console.log('\n📦 Testing Bulk Operations...\n');
  
  try {
    // Test addSongsByPath
    console.log('1. Testing addSongsByPath...');
    const mockPaths = ['/path/to/song1.mp3', '/path/to/song2.mp3'];
    const bulkResult = await databaseModule.addSongsByPath(mockPaths, 'BULK');
    console.log('   ✅ addSongsByPath result:', bulkResult);
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

async function testDataPopulation() {
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

async function testStoreOperations() {
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

async function testUIOperations() {
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

// Main test runner
async function runAllTests() {
  console.log('Starting comprehensive database operations test...\n');
  
  await testCategoryOperations();
  await testSongOperations();
  await testQueryOperations();
  await testBulkOperations();
  await testDataPopulation();
  await testStoreOperations();
  await testUIOperations();
  
  console.log('\n🎉 All tests completed!');
  console.log('\n📋 Test Summary:');
  console.log('- ✅ Category operations tested');
  console.log('- ✅ Song operations tested');
  console.log('- ✅ Query operations tested');
  console.log('- ✅ Bulk operations tested');
  console.log('- ✅ Data population tested');
  console.log('- ✅ Store operations tested');
  console.log('- ✅ UI operations tested');
}

// Run the tests
runAllTests().catch(error => {
  console.error('❌ Test runner error:', error);
}); 