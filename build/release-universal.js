#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  const existingData = require('js-yaml').load ? require('js-yaml').load(existingLatestMac) : parseYaml(existingLatestMac);

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

  // Merge with existing ARM64 files
  const universalData = {
    version: version,
    files: [...existingData.files, ...x64Files],
    path: `Mx. Voice-${version}-x64.zip`, // Use x64 as default for backward compatibility
    sha512: x64ZipMeta.sha512, // Use x64 SHA512 as default
    releaseDate: new Date().toISOString()
  };

  // Write universal latest-mac.yml
  const yamlContent = generateYaml(universalData);
  fs.writeFileSync('dist/latest-mac-universal.yml', yamlContent);

  console.log('✅ Universal latest-mac.yml generated');
  return universalData;
}

// Simple YAML parser for latest-mac.yml format
function parseYaml(yamlString) {
  const lines = yamlString.split('\n');
  const result = { files: [] };
  let currentFile = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('version:')) {
      result.version = trimmed.split(':')[1].trim();
    } else if (trimmed.startsWith('path:')) {
      result.path = trimmed.split(':')[1].trim();
    } else if (trimmed.startsWith('sha512:') && !currentFile) {
      result.sha512 = trimmed.split(':')[1].trim();
    } else if (trimmed.startsWith('releaseDate:')) {
      result.releaseDate = trimmed.split(':')[1].trim().replace(/'/g, '');
    } else if (trimmed.startsWith('- url:')) {
      if (currentFile) result.files.push(currentFile);
      currentFile = { url: trimmed.split(':')[1].trim() };
    } else if (currentFile && trimmed.startsWith('sha512:')) {
      currentFile.sha512 = trimmed.split(':')[1].trim();
    } else if (currentFile && trimmed.startsWith('size:')) {
      currentFile.size = parseInt(trimmed.split(':')[1].trim());
    } else if (currentFile && trimmed.startsWith('blockMapSize:')) {
      currentFile.blockMapSize = parseInt(trimmed.split(':')[1].trim());
    }
  }

  if (currentFile) result.files.push(currentFile);
  return result;
}

// Simple YAML generator for latest-mac.yml format
function generateYaml(data) {
  let yaml = `version: ${data.version}\n`;
  yaml += `files:\n`;

  for (const file of data.files) {
    yaml += `  - url: ${file.url}\n`;
    yaml += `    sha512: ${file.sha512}\n`;
    yaml += `    size: ${file.size}\n`;
    if (file.blockMapSize) {
      yaml += `    blockMapSize: ${file.blockMapSize}\n`;
    }
  }

  yaml += `path: ${data.path}\n`;
  yaml += `sha512: ${data.sha512}\n`;
  yaml += `releaseDate: '${data.releaseDate}'\n`;

  return yaml;
}

async function createGitHubRelease() {
  console.log('🏷️  Creating GitHub release...');

  try {
    // Check if release already exists
    try {
      const existingRelease = await octokit.rest.repos.getReleaseByTag({
        owner: repoOwner,
        repo: repoName,
        tag: tagName,
      });

      console.log(`⚠️  Release ${tagName} already exists. Updating...`);
      return existingRelease.data;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    // Create new release
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

if (require.main === module) {
  main();
}
