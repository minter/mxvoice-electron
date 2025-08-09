#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Read package.json to get version and repository info
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
const tagName = `v${version}`;
const repoOwner = 'minter';
const repoName = 'mxvoice-electron';

console.log(`🚀 Creating universal release for ${tagName}`);

// GitHub API client will be initialized in main()
let octokit;

// Expected files in dist/
const expectedFiles = [
  `Mx. Voice-${version}-arm64.dmg`,
  `Mx. Voice-${version}-arm64.zip`,
  `Mx. Voice-${version}-arm64.dmg.blockmap`,
  `Mx. Voice-${version}-arm64.zip.blockmap`,
  `Mx. Voice-${version}-x64.dmg`,
  `Mx. Voice-${version}-x64.zip`,
  `Mx. Voice-${version}-x64.dmg.blockmap`,
  `Mx. Voice-${version}-x64.zip.blockmap`,
  'latest-mac.yml'
];

function validateFiles() {
  console.log('📋 Validating required files...');
  const missingFiles = [];

  for (const file of expectedFiles) {
    const filePath = path.join('dist', file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    console.error('❌ Missing required files:');
    missingFiles.forEach(file => console.error(`   - ${file}`));
    process.exit(1);
  }

  console.log('✅ All required files found');
}

function calculateFileMetadata(filePath) {
  const stats = fs.statSync(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha512').update(fileBuffer).digest('base64');

  return {
    size: stats.size,
    sha512: hash
  };
}

function calculateBlockMapSize(zipPath) {
  const blockMapPath = `${zipPath}.blockmap`;
  if (fs.existsSync(blockMapPath)) {
    const stats = fs.statSync(blockMapPath);
    return stats.size;
  }
  return undefined;
}

function generateUniversalLatestMac() {
  console.log('🔧 Generating universal latest-mac.yml...');

  // Read existing latest-mac.yml (contains ARM64 data)
  const existingLatestMac = fs.readFileSync('dist/latest-mac.yml', 'utf8');
  const existingData = parseYaml(existingLatestMac);

  // Calculate x64 file metadata
  const x64DmgPath = path.join('dist', `Mx. Voice-${version}-x64.dmg`);
  const x64ZipPath = path.join('dist', `Mx. Voice-${version}-x64.zip`);

  const x64DmgMeta = calculateFileMetadata(x64DmgPath);
  const x64ZipMeta = calculateFileMetadata(x64ZipPath);
  const x64ZipBlockMapSize = calculateBlockMapSize(x64ZipPath);

  // Create x64 file entries
  const x64Files = [
    {
      url: `Mx. Voice-${version}-x64.zip`,
      sha512: x64ZipMeta.sha512,
      size: x64ZipMeta.size,
      ...(x64ZipBlockMapSize && { blockMapSize: x64ZipBlockMapSize })
    },
    {
      url: `Mx. Voice-${version}-x64.dmg`,
      sha512: x64DmgMeta.sha512,
      size: x64DmgMeta.size
    }
  ];

  // Merge ARM64 and x64 files
  const universalFiles = [...existingData.files, ...x64Files];

  // Create universal latest-mac.yml
  const universalData = {
    ...existingData,
    files: universalFiles
  };

  const universalYaml = generateYaml(universalData);
  fs.writeFileSync('dist/latest-mac-universal.yml', universalYaml);

  console.log('✅ Universal latest-mac.yml generated');
}

// Simple YAML parser for basic key-value pairs
function parseYaml(yamlString) {
  const lines = yamlString.split('\n');
  const result = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ')) {
      // Array item
      if (currentArray) {
        currentArray.push(trimmed.substring(2));
      }
    } else if (trimmed.includes(':')) {
      // Key-value pair
      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      if (value === '') {
        // Start of object or array
        currentKey = key;
        if (key === 'files') {
          result[key] = [];
          currentArray = result[key];
        } else {
          result[key] = {};
        }
      } else {
        // Simple key-value
        result[key] = value;
      }
    }
  }

  return result;
}

function generateYaml(data) {
  let yaml = '';
  
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      yaml += `${key}:\n`;
      for (const item of value) {
        yaml += `  - ${JSON.stringify(item)}\n`;
      }
    } else if (typeof value === 'object') {
      yaml += `${key}:\n`;
      for (const [subKey, subValue] of Object.entries(value)) {
        yaml += `  ${subKey}: ${subValue}\n`;
      }
    } else {
      yaml += `${key}: ${value}\n`;
    }
  }
  
  return yaml;
}

async function createGitHubRelease() {
  console.log('🏷️  Creating GitHub release...');

  try {
    const release = await octokit.rest.repos.createRelease({
      owner: repoOwner,
      repo: repoName,
      tag_name: tagName,
      name: `Mx. Voice ${version}`,
      body: `Release ${version}\n\nUniversal macOS build supporting both Apple Silicon (ARM64) and Intel (x64) architectures.`,
      draft: true,
      prerelease: false,
    });

    console.log(`✅ Draft release created: ${release.data.html_url}`);
    return release.data;
  } catch (error) {
    console.error('❌ Failed to create release:', error.message);
    process.exit(1);
  }
}

async function uploadAssets(release) {
  console.log('📤 Uploading release assets...');

  // Upload all binary files
  const binaryFiles = expectedFiles.filter(f => f !== 'latest-mac.yml');

  for (const fileName of binaryFiles) {
    const filePath = path.join('dist', fileName);
    const fileContent = fs.readFileSync(filePath);

    console.log(`   Uploading ${fileName}...`);

    try {
      await octokit.rest.repos.uploadReleaseAsset({
        owner: repoOwner,
        repo: repoName,
        release_id: release.id,
        name: fileName,
        data: fileContent,
      });
    } catch (error) {
      console.error(`❌ Failed to upload ${fileName}:`, error.message);
      process.exit(1);
    }
  }

  // Upload universal latest-mac.yml
  const latestMacContent = fs.readFileSync('dist/latest-mac-universal.yml');
  console.log('   Uploading latest-mac.yml...');

  try {
    await octokit.rest.repos.uploadReleaseAsset({
      owner: repoOwner,
      repo: repoName,
      release_id: release.id,
      name: 'latest-mac.yml',
      data: latestMacContent,
    });
  } catch (error) {
    console.error('❌ Failed to upload latest-mac.yml:', error.message);
    process.exit(1);
  }

  console.log('✅ All assets uploaded successfully');
}

async function main() {
  // Check for GitHub token
  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    console.error('   Create a personal access token at: https://github.com/settings/tokens');
    console.error('   Then run: export GITHUB_TOKEN=your_token_here');
    process.exit(1);
  }

  try {
    // Initialize GitHub API client with dynamic import
    const { Octokit } = await import('@octokit/rest');
    octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    validateFiles();
    generateUniversalLatestMac();
    const release = await createGitHubRelease();
    await uploadAssets(release);

    console.log('\n🎉 Universal release created successfully!');
    console.log(`📋 Release URL: ${release.html_url}`);
    console.log(`🏷️  Tag: ${tagName}`);
    console.log('📝 The release is currently in DRAFT mode. Review and publish when ready.');

  } catch (error) {
    console.error('❌ Release creation failed:', error.message);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
