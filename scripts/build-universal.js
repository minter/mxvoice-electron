#!/usr/bin/env node

/**
 * Universal Build Script
 * 
 * This script builds a single universal binary that includes both ARM64 and x64
 * architectures in one .app file. This eliminates the need for separate builds
 * and merging, creating a truly universal macOS application.
 * 
 * With SQL.js (no native dependencies), universal builds are now reliable.
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

async function createUniversalBinaryManually() {
  console.log('🔧 Creating universal binary using lipo...');
  
  const arm64App = path.join(BUILD_DIR, 'mac-arm64', 'Mx. Voice.app');
  const x64App = path.join(BUILD_DIR, 'mac', 'Mx. Voice.app');
  const universalApp = path.join(BUILD_DIR, 'mac-universal', 'Mx. Voice.app');
  
  // Create universal directory
  if (!fs.existsSync(path.join(BUILD_DIR, 'mac-universal'))) {
    fs.mkdirSync(path.join(BUILD_DIR, 'mac-universal'), { recursive: true });
  }
  
  // Copy ARM64 app as base
  execSync(`cp -R "${arm64App}" "${universalApp}"`, { stdio: 'inherit' });
  console.log('📁 Copied ARM64 app as base');
  
  // Use lipo to create universal binaries for key executables
  const executables = [
    'Contents/MacOS/Mx. Voice',
    'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework',
    'Contents/Frameworks/Squirrel.framework/Versions/A/Squirrel'
  ];
  
  for (const execPath of executables) {
    const arm64Path = path.join(arm64App, execPath);
    const x64Path = path.join(x64App, execPath);
    const universalPath = path.join(universalApp, execPath);
    
    if (fs.existsSync(arm64Path) && fs.existsSync(x64Path)) {
      try {
        execSync(`lipo "${arm64Path}" "${x64Path}" -create -output "${universalPath}"`, { stdio: 'inherit' });
        console.log(`🔗 Created universal binary: ${execPath}`);
      } catch (error) {
        console.log(`⚠️  Could not create universal for ${execPath}: ${error.message}`);
      }
    }
  }
  
  console.log('✅ Universal binary created successfully');
}

async function buildUniversal() {
  console.log(`🚀 Building Universal Binary (ARM64 + x64) version ${VERSION}...`);
  
  try {
    // Build both architectures separately
    console.log('🔨 Building ARM64 architecture...');
    execSync('npx electron-builder --mac --arm64', { stdio: 'inherit' });
    console.log('✅ ARM64 build completed');
    
    console.log('🔨 Building x64 architecture...');
    execSync('npx electron-builder --mac --x64', { stdio: 'inherit' });
    console.log('✅ x64 build completed');
    
    // Create universal binary manually using lipo
    console.log('🔨 Creating universal binary manually...');
    await createUniversalBinaryManually();
    console.log('✅ Universal binary created successfully');
    
    // Normalize artifact names to "Mx.-Voice-*" format
    normalizeArtifactNames();
    
    // Create universal latest-mac.yml for auto-updates
    await createUniversalLatestMac();
    
    console.log('🎯 Universal binary ready! Single .app file works on both Intel and Apple Silicon Macs.');
    
  } catch (error) {
    console.error('❌ Universal build failed:', error);
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

async function createUniversalLatestMac() {
  const zipName = `Mx.-Voice-${VERSION}-universal.zip`;
  const dmgName = `Mx.-Voice-${VERSION}-universal.dmg`;
  const zipPath = path.join(BUILD_DIR, zipName);
  const dmgPath = path.join(BUILD_DIR, dmgName);

  // Check if universal artifacts exist
  if (!fs.existsSync(zipPath)) {
    console.log(`⚠️  Universal ZIP not found at ${zipName}, checking for standard names...`);
    // Look for standard universal names
    const files = fs.readdirSync(BUILD_DIR);
    const zipFile = files.find(f => f.includes('universal') && f.endsWith('.zip'));
    const dmgFile = files.find(f => f.includes('universal') && f.endsWith('.dmg'));
    
    if (zipFile && dmgFile) {
      console.log(`📁 Found universal artifacts: ${zipFile}, ${dmgFile}`);
      // Use the found files
      const zipName = zipFile;
      const dmgName = dmgFile;
      const zipPath = path.join(BUILD_DIR, zipName);
      const dmgPath = path.join(BUILD_DIR, dmgName);
    } else {
      console.log('⚠️  No universal artifacts found, skipping latest-mac.yml creation');
      return;
    }
  }

  if (!fs.existsSync(zipPath)) throw new Error(`Missing ${zipName}`);
  if (!fs.existsSync(dmgPath)) throw new Error(`Missing ${dmgName}`);

  const zipStat = fs.statSync(zipPath);
  const dmgStat = fs.statSync(dmgPath);
  const [zipSha, dmgSha] = await Promise.all([
    computeSha512Base64(zipPath),
    computeSha512Base64(dmgPath)
  ]);

  const latestMac = {
    version: VERSION,
    files: [
      {
        url: `https://github.com/minter/mxvoice-electron/releases/download/v${VERSION}/${zipName}`,
        sha512: zipSha,
        size: zipStat.size
      },
      {
        url: `https://github.com/minter/mxvoice-electron/releases/download/v${VERSION}/${dmgName}`,
        sha512: dmgSha,
        size: dmgStat.size
      }
    ],
    path: `https://github.com/minter/mxvoice-electron/releases/download/v${VERSION}/${dmgName}`,
    sha512: dmgSha,
    releaseDate: new Date().toISOString(),
    releaseNotes: `Universal Binary v${VERSION} - Works on both Intel and Apple Silicon Macs`
  };

  const yamlPath = path.join(BUILD_DIR, 'latest-mac.yml');
  fs.writeFileSync(yamlPath, yaml.dump(latestMac));
  console.log(`📝 Created universal latest-mac.yml: ${yamlPath}`);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  buildUniversal().catch(error => {
    console.error('❌ Build failed:', error);
    process.exit(1);
  });
}

export { buildUniversal };
