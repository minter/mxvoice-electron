#!/usr/bin/env node

/**
 * Test script to debug auto-updater URL construction
 * This simulates what the auto-updater does without building the app
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Simulate the auto-updater environment
function testAutoUpdaterUrls() {
  console.log('🔍 Testing Auto-Updater URL Construction...\n');
  
  // Read the current latest-mac.yml from GitHub (or use a local copy)
  const latestMacPath = path.join('dist', 'latest-mac.yml');
  
  if (!fs.existsSync(latestMacPath)) {
    console.log('❌ No latest-mac.yml found. Please download it from GitHub first.');
    return;
  }
  
  try {
    const latestMac = yaml.load(fs.readFileSync(latestMacPath, 'utf8'));
    console.log('✅ Loaded latest-mac.yml:', latestMac.version);
    
    // Simulate what the auto-updater sees
    console.log('\n📋 Update Info:');
    console.log('  Current Version: 4.0.0-pre.1 (simulated)');
    console.log('  Update Version:', latestMac.version);
    console.log('  Files:', latestMac.files.length);
    
    // Test URL construction for each file
    console.log('\n🔗 Testing File URLs:');
    latestMac.files.forEach((file, index) => {
      console.log(`\n  File ${index + 1}:`);
      console.log(`    URL: ${file.url}`);
      console.log(`    Size: ${file.size}`);
      console.log(`    SHA512: ${file.sha512.substring(0, 16)}...`);
      
      // Test if this looks like a valid GitHub URL
      if (file.url.includes('github.com') && file.url.includes('/releases/download/')) {
        console.log('    ✅ Valid GitHub release URL');
      } else {
        console.log('    ❌ Invalid URL format');
      }
    });
    
    // Test the path field
    console.log('\n🎯 Testing Path Field:');
    console.log(`  Path: ${latestMac.path}`);
    if (latestMac.path.includes('github.com') && latestMac.path.includes('/releases/download/')) {
      console.log('  ✅ Valid GitHub release path');
    } else {
      console.log('  ❌ Invalid path format');
    }
    
    // Simulate blockmap URL construction (what's causing the duplication)
    console.log('\n🧩 Simulating Blockmap URL Construction:');
    const currentVersion = '4.0.0-pre.1';
    const currentBaseUrl = `https://github.com/minter/mxvoice-electron/releases/download/${currentVersion}`;
    
    console.log(`  Current Base URL: ${currentBaseUrl}`);
    
    // This is what the auto-updater might be doing incorrectly
    latestMac.files.forEach((file, index) => {
      if (file.url.includes('.zip')) {
        const blockmapUrl = `${currentBaseUrl}/${file.url}`;
        console.log(`\n  Blockmap ${index + 1} (INCORRECT construction):`);
        console.log(`    ${blockmapUrl}`);
        console.log(`    ❌ This shows the duplication issue!`);
        
        // Show what it should be
        const correctBlockmapUrl = file.url.replace('.zip', '.zip.blockmap');
        console.log(`\n    Correct blockmap URL should be:`);
        console.log(`    ${correctBlockmapUrl}`);
      }
    });
    
    console.log('\n💡 Analysis:');
    console.log('  The auto-updater is incorrectly prepending the current version\'s base URL');
    console.log('  to the new version\'s asset URLs, causing the duplication.');
    console.log('  This suggests a configuration issue in how the auto-updater determines');
    console.log('  the base URL for differential updates.');
    
  } catch (error) {
    console.error('❌ Error testing auto-updater URLs:', error);
  }
}

// Run the test
testAutoUpdaterUrls(); 