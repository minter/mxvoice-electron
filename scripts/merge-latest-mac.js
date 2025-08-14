#!/usr/bin/env node

/**
 * Merge script for latest-mac.yml files
 * Combines x64 and ARM64 update information into a single file
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const BUILD_DIR = 'dist';

// Read version from package.json
function getVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error('❌ Could not read version from package.json:', error);
    process.exit(1);
  }
}

async function mergeLatestMac() {
  const VERSION = getVersion();
  console.log(`🔀 Merging latest-mac.yml files for version ${VERSION}...`);
  
  try {
    // Read the ARM64 latest-mac.yml (built locally)
    const arm64Path = path.join(BUILD_DIR, 'latest-mac.yml');
    if (!fs.existsSync(arm64Path)) {
      throw new Error('ARM64 latest-mac.yml not found. Run build-arm64-local.js first.');
    }
    
    // Read the x64 latest-mac.yml (from GitHub Actions)
    const x64Path = path.join(BUILD_DIR, 'latest-mac-x64.yml');
    if (!fs.existsSync(x64Path)) {
      throw new Error('x64 latest-mac-x64.yml not found. Please download it from GitHub Actions artifacts.');
    }
    
    const arm64LatestMac = yaml.load(fs.readFileSync(arm64Path, 'utf8'));
    const x64LatestMac = yaml.load(fs.readFileSync(x64Path, 'utf8'));
    
    console.log('✅ Loaded ARM64 latest-mac.yml');
    console.log('✅ Loaded x64 latest-mac-x64.yml');
    
    // IMPORTANT: For GitHub provider, entries must be relative file names, not full URLs
    const mergedLatestMac = {
      version: VERSION,
      files: [
        // ARM64 files (relative names)
        {
          url: `Mx. Voice-${VERSION}-arm64.dmg`,
          sha512: arm64LatestMac.files?.[0]?.sha512 || 'placeholder-sha512',
          size: arm64LatestMac.files?.[0]?.size || 0
        },
        {
          url: `Mx. Voice-${VERSION}-arm64.zip`,
          sha512: arm64LatestMac.files?.[1]?.sha512 || 'placeholder-sha512',
          size: arm64LatestMac.files?.[1]?.size || 0
        },
        // x64 files (relative names)
        {
          url: `Mx. Voice-${VERSION}-x64.dmg`,
          sha512: x64LatestMac.files?.[0]?.sha512 || 'placeholder-sha512',
          size: x64LatestMac.files?.[0]?.size || 0
        },
        {
          url: `Mx. Voice-${VERSION}-x64.zip`,
          sha512: x64LatestMac.files?.[1]?.sha512 || 'placeholder-sha512',
          size: x64LatestMac.files?.[1]?.size || 0
        }
      ],
      path: `Mx. Voice-${VERSION}-x64.dmg`, // Default to x64 for backward compatibility
      sha512: x64LatestMac.files?.[0]?.sha512 || 'placeholder-sha512', // Use x64 DMG hash as default
      releaseDate: new Date().toISOString()
    };
    
    // Write merged file
    const mergedPath = path.join(BUILD_DIR, 'latest-mac-merged.yml');
    fs.writeFileSync(mergedPath, yaml.dump(mergedLatestMac));
    
    console.log('✅ Created merged latest-mac-merged.yml with full GitHub URLs for both architectures');
    console.log('✅ Default path set to x64 for backward compatibility');
    console.log('📋 Next steps:');
    console.log('   1. Upload the merged file to GitHub');
    console.log('   2. Rename it to latest-mac.yml');
    console.log('   3. The auto-updater will now be able to download updates correctly');
    
  } catch (error) {
    console.error('❌ Merge failed:', error);
    process.exit(1);
  }
}

// Run the merge
mergeLatestMac().catch(console.error);
