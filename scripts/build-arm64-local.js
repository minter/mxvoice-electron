#!/usr/bin/env node

/**
 * Local ARM64 build script for Mx. Voice
 * This builds the ARM64 version locally and prepares for merging with x64 builds
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const VERSION = process.env.VERSION || '4.0.0-pre.1';
const BUILD_DIR = 'dist';

async function buildArm64() {
  console.log('🚀 Building ARM64 version locally...');
  
  try {
    // Build ARM64 version
    execSync('yarn build:mac:arm64', { stdio: 'inherit' });
    console.log('✅ ARM64 build completed successfully');
    
    // Check if latest-mac.yml was created
    const latestMacPath = path.join(BUILD_DIR, 'latest-mac.yml');
    if (!fs.existsSync(latestMacPath)) {
      console.log('⚠️  No latest-mac.yml found, creating one for ARM64...');
      await createArm64LatestMac();
    } else {
      console.log('✅ latest-mac.yml found');
    }
    
    console.log('🎯 ARM64 build ready for merging with x64');
    
  } catch (error) {
    console.error('❌ ARM64 build failed:', error);
    process.exit(1);
  }
}

async function createArm64LatestMac() {
  const arm64LatestMac = {
    version: VERSION,
    files: [
      {
        url: `Mx. Voice-${VERSION}-arm64.dmg`,
        sha512: 'placeholder-sha512', // Will be updated after actual build
        size: 0
      },
      {
        url: `Mx. Voice-${VERSION}-arm64.zip`,
        sha512: 'placeholder-sha512', // Will be updated after actual build
        size: 0
      }
    ],
    path: `Mx. Voice-${VERSION}-arm64.dmg`,
    sha512: 'placeholder-sha512', // Will be updated after actual build
    releaseDate: new Date().toISOString()
  };
  
  const latestMacPath = path.join(BUILD_DIR, 'latest-mac.yml');
  fs.writeFileSync(latestMacPath, yaml.dump(arm64LatestMac));
  console.log('📝 Created ARM64 latest-mac.yml template');
}

// Run the build
buildArm64().catch(console.error);
