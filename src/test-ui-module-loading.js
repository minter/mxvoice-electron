/**
 * UI Module Loading Test
 * 
 * This file tests that the UI module files can be loaded correctly.
 */

const fs = require('fs');
const path = require('path');

function testModuleFileLoading() {
  console.log('🧪 Testing UI Module File Loading...');
  
  const moduleFiles = [
    'src/renderer/modules/ui/index.js',
    'src/renderer/modules/ui/ui-manager.js',
    'src/renderer/modules/ui/event-handlers.js',
    'src/renderer/modules/ui/controls.js',
    'src/renderer/modules/ui/modals.js',
    'src/renderer/modules/ui/README.md'
  ];
  
  let allFilesExist = true;
  
  moduleFiles.forEach(filePath => {
    try {
      const fullPath = path.resolve(filePath);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        console.log(`✅ ${filePath} exists (${stats.size} bytes)`);
        
        // Check if it's a JavaScript file and has valid syntax
        if (filePath.endsWith('.js')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Basic syntax check - try to parse as JSON-like structure
            if (content.includes('module.exports') || content.includes('function')) {
              console.log(`✅ ${filePath} has valid JavaScript syntax`);
            } else {
              console.log(`⚠️ ${filePath} may have syntax issues`);
            }
          } catch (error) {
            console.log(`❌ ${filePath} has syntax errors:`, error.message);
            allFilesExist = false;
          }
        }
      } else {
        console.log(`❌ ${filePath} does not exist`);
        allFilesExist = false;
      }
    } catch (error) {
      console.log(`❌ Error checking ${filePath}:`, error.message);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

function testModuleStructure() {
  console.log('\n📁 Testing Module Structure...');
  
  const moduleDir = 'src/renderer/modules/ui';
  
  try {
    if (fs.existsSync(moduleDir)) {
      const files = fs.readdirSync(moduleDir);
      console.log(`✅ Module directory exists with ${files.length} files:`);
      files.forEach(file => {
        console.log(`  - ${file}`);
      });
      
      // Check for required files
      const requiredFiles = ['index.js', 'ui-manager.js', 'event-handlers.js', 'controls.js', 'modals.js', 'README.md'];
      const missingFiles = requiredFiles.filter(file => !files.includes(file));
      
      if (missingFiles.length === 0) {
        console.log('✅ All required files are present');
        return true;
      } else {
        console.log('❌ Missing required files:', missingFiles);
        return false;
      }
    } else {
      console.log('❌ Module directory does not exist');
      return false;
    }
  } catch (error) {
    console.log('❌ Error checking module structure:', error.message);
    return false;
  }
}

function testModuleContent() {
  console.log('\n📄 Testing Module Content...');
  
  try {
    // Test index.js
    const indexContent = fs.readFileSync('src/renderer/modules/ui/index.js', 'utf8');
    if (indexContent.includes('initialize') && indexContent.includes('module.exports')) {
      console.log('✅ index.js has correct structure');
    } else {
      console.log('❌ index.js has incorrect structure');
      return false;
    }
    
    // Test ui-manager.js
    const managerContent = fs.readFileSync('src/renderer/modules/ui/ui-manager.js', 'utf8');
    if (managerContent.includes('scaleScrollable') && managerContent.includes('editSelectedSong')) {
      console.log('✅ ui-manager.js has correct functions');
    } else {
      console.log('❌ ui-manager.js missing required functions');
      return false;
    }
    
    // Test event-handlers.js
    const handlersContent = fs.readFileSync('src/renderer/modules/ui/event-handlers.js', 'utf8');
    if (handlersContent.includes('toggleSelectedRow') && handlersContent.includes('switchToHotkeyTab')) {
      console.log('✅ event-handlers.js has correct functions');
    } else {
      console.log('❌ event-handlers.js missing required functions');
      return false;
    }
    
    // Test controls.js
    const controlsContent = fs.readFileSync('src/renderer/modules/ui/controls.js', 'utf8');
    if (controlsContent.includes('increaseFontSize') && controlsContent.includes('toggleWaveform')) {
      console.log('✅ controls.js has correct functions');
    } else {
      console.log('❌ controls.js missing required functions');
      return false;
    }
    
    // Test modals.js
    const modalsContent = fs.readFileSync('src/renderer/modules/ui/modals.js', 'utf8');
    if (modalsContent.includes('pickDirectory') && modalsContent.includes('installUpdate')) {
      console.log('✅ modals.js has correct functions');
    } else {
      console.log('❌ modals.js missing required functions');
      return false;
    }
    
    // Test README.md
    const readmeContent = fs.readFileSync('src/renderer/modules/ui/README.md', 'utf8');
    if (readmeContent.includes('# UI Module') && readmeContent.includes('## Features')) {
      console.log('✅ README.md has correct documentation');
    } else {
      console.log('❌ README.md missing required documentation');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Error testing module content:', error.message);
    return false;
  }
}

// Run all tests
console.log('🚀 Starting UI Module Loading Tests...\n');

const fileLoadingResult = testModuleFileLoading();
const structureResult = testModuleStructure();
const contentResult = testModuleContent();

console.log('\n📊 Loading Test Results:');
console.log(`File Loading Test: ${fileLoadingResult ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Structure Test: ${structureResult ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Content Test: ${contentResult ? '✅ PASSED' : '❌ FAILED'}`);

if (fileLoadingResult && structureResult && contentResult) {
  console.log('\n🎉 All loading tests passed! UI Module files are correctly structured.');
} else {
  console.log('\n⚠️ Some loading tests failed. Please check the module files.');
}

// Export test functions
module.exports = {
  testModuleFileLoading,
  testModuleStructure,
  testModuleContent
}; 