#!/usr/bin/env node

/**
 * Merge script for latest-mac.yml files
 * Combines x64 and ARM64 update information into a single file
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const VERSION = process.env.VERSION || '4.0.0-pre.1';
const BUILD_DIR = 'dist';

async function mergeLatestMac() {
  console.log('🔀 Merging latest-mac.yml files...');
  
  try {
    // Read the ARM64 latest-mac.yml (built locally)
    const arm64Path = path.join(BUILD_DIR, 'latest-mac.yml');
    if (!fs.existsSync(arm64Path)) {
      throw new Error('ARM64 latest-mac.yml not found. Run build-arm64-local.js first.');
    }
    
    const arm64LatestMac = yaml.load(fs.readFileSync(arm64Path, 'utf8'));
    console.log('✅ Loaded ARM64 latest-mac.yml');
    
    // Create merged latest-mac.yml with both architectures
    const mergedLatestMac = {
      version: VERSION,
      files: [
        // ARM64 files
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
        // x64 files (will be updated after GitHub Actions build)
        {
          url: `Mx. Voice-${VERSION}-x64.dmg`,
          sha512: 'placeholder-sha512', // Will be updated from GitHub Actions
          size: 0
        },
        {
          url: `Mx. Voice-${VERSION}-x64.zip`,
          sha512: 'placeholder-sha512', // Will be updated from GitHub Actions
          size: 0
        }
      ],
      path: `Mx. Voice-${VERSION}-arm64.dmg`, // Default to ARM64 for local builds
      sha512: arm64LatestMac.sha512 || 'placeholder-sha512',
      releaseDate: new Date().toISOString()
    };
    
    // Write merged file
    const mergedPath = path.join(BUILD_DIR, 'latest-mac-merged.yml');
    fs.writeFileSync(mergedPath, yaml.dump(mergedLatestMac));
    
    console.log('✅ Created merged latest-mac-merged.yml');
    console.log('📋 Next steps:');
    console.log('   1. Download x64 latest-mac.yml from GitHub Actions artifacts');
    console.log('   2. Run merge-with-x64.js to combine them');
    console.log('   3. Upload the final merged file to GitHub');
    
  } catch (error) {
    console.error('❌ Merge failed:', error);
    process.exit(1);
  }
}

// Run the merge
mergeLatestMac().catch(console.error);
