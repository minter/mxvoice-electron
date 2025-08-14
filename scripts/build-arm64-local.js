#!/usr/bin/env node

/**
 * ARM64 Build Script with Release Metadata Preparation
 * 
 * This script builds the ARM64 version locally and prepares the latest-mac.yml
 * file with correct GitHub URLs for the auto-updater.
 * 
 * It does NOT build multiple architectures - it only builds ARM64 and prepares
 * the metadata needed for the multi-architecture merge workflow.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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

const VERSION = getVersion();
const BUILD_DIR = 'dist';

async function buildArm64() {
  console.log(`🚀 Building ARM64 version ${VERSION} with release metadata preparation...`);
  
  try {
    // Build ARM64 version
    execSync('yarn build:mac:arm64', { stdio: 'inherit' });
    console.log('✅ ARM64 build completed successfully');
    
    // Normalize artifact names to "Mx. Voice-*" to avoid environment-specific sanitization
    normalizeArtifactNames();
    
    // Check if latest-mac.yml was created
    const latestMacPath = path.join(BUILD_DIR, 'latest-mac.yml');
    if (!fs.existsSync(latestMacPath)) {
      console.log('⚠️  No latest-mac.yml found, creating one for ARM64...');
      await createArm64LatestMac();
    } else {
      console.log('✅ latest-mac.yml found');
    }
    // Ensure yml references use "Mx. Voice-*"
    normalizeLatestMacYml();
    
    console.log('🎯 ARM64 build ready for merging with x64 GitHub Actions build');
    
  } catch (error) {
    console.error('❌ ARM64 build failed:', error);
    process.exit(1);
  }
}

function normalizeArtifactNames() {
  try {
    const files = fs.readdirSync(BUILD_DIR);
    files.forEach((file) => {
      if (/^Mx\.-Voice-/.test(file) || /^Mx\.Voice-/.test(file)) {
        const normalized = file.replace(/^Mx\.-Voice-/, 'Mx. Voice-').replace(/^Mx\.Voice-/, 'Mx. Voice-');
        if (normalized !== file) {
          fs.renameSync(path.join(BUILD_DIR, file), path.join(BUILD_DIR, normalized));
          console.log(`🔤 Renamed artifact: ${file} -> ${normalized}`);
        }
      }
    });
  } catch (e) {
    console.warn('⚠️  Could not normalize artifact names:', e?.message || e);
  }
}

function normalizeLatestMacYml() {
  try {
    const latestMacPath = path.join(BUILD_DIR, 'latest-mac.yml');
    if (!fs.existsSync(latestMacPath)) return;
    let yml = fs.readFileSync(latestMacPath, 'utf8');
    const updated = yml.replace(/Mx\.-Voice-/g, 'Mx. Voice-').replace(/Mx\.Voice-/g, 'Mx. Voice-');
    if (updated !== yml) {
      fs.writeFileSync(latestMacPath, updated);
      console.log('🔤 Normalized names inside latest-mac.yml');
    }
  } catch (e) {
    console.warn('⚠️  Could not normalize latest-mac.yml:', e?.message || e);
  }
}

async function createArm64LatestMac() {
  // IMPORTANT: For GitHub provider, entries must be relative file names, not full URLs
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
  console.log('📝 Created ARM64 latest-mac.yml template with relative file names');
}

// Run the build
buildArm64().catch(console.error);
