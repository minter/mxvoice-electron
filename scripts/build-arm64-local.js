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
import crypto from 'crypto';

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
    
    // Normalize artifact names to "Mx.-Voice-*" to avoid environment-specific sanitization
    normalizeArtifactNames();
    
    // Always regenerate per-arch metadata for ARM64 only
    await createArm64LatestMac();
    
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
      if (/^Mx\. Voice-/.test(file) || /^Mx\.Voice-/.test(file)) {
        const normalized = file.replace(/^Mx\. Voice-/, 'Mx.-Voice-').replace(/^Mx\.Voice-/, 'Mx.-Voice-');
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

function computeSha512Base64(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha512');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('base64')));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function createArm64LatestMac() {
  const zipName = `Mx.-Voice-${VERSION}-arm64.zip`;
  const dmgName = `Mx.-Voice-${VERSION}-arm64.dmg`;
  const zipPath = path.join(BUILD_DIR, zipName);
  const dmgPath = path.join(BUILD_DIR, dmgName);

  if (!fs.existsSync(zipPath)) throw new Error(`Missing ${zipName}`);
  if (!fs.existsSync(dmgPath)) throw new Error(`Missing ${dmgName}`);

  const zipStat = fs.statSync(zipPath);
  const dmgStat = fs.statSync(dmgPath);
  const [zipSha, dmgSha] = await Promise.all([
    computeSha512Base64(zipPath),
    computeSha512Base64(dmgPath)
  ]);

  // IMPORTANT: For GitHub provider, entries must be relative file names, not full URLs
  const arm64LatestMac = {
    version: VERSION,
    files: [
      {
        url: zipName,
        sha512: zipSha,
        size: zipStat.size
      },
      {
        url: dmgName,
        sha512: dmgSha,
        size: dmgStat.size
      }
    ],
    path: zipName,
    sha512: zipSha,
    releaseDate: new Date().toISOString()
  };

  const latestMacArmPath = path.join(BUILD_DIR, 'latest-mac-arm64.yml');
  fs.writeFileSync(latestMacArmPath, yaml.dump(arm64LatestMac));
  console.log('📝 Created ARM64 metadata: dist/latest-mac-arm64.yml');
}

// Run the build
buildArm64().catch(console.error);
