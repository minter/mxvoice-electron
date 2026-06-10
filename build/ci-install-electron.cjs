#!/usr/bin/env node
/**
 * Deterministically provision the Electron binary for CI.
 *
 * Electron's own postinstall (node_modules/electron/install.js) downloads and
 * extracts the binary with extract-zip. On the GitHub runners' Node build the
 * async extraction is silently abandoned: the event loop drains mid-extract and
 * the process exits 0 without unzipping, so node_modules/electron/path.txt is
 * never written and require('electron') throws ENOENT at test time. Under
 * Playwright's parallel workers each worker then races the lazy re-download and
 * the E2E suite dies before any test runs.
 *
 * This script downloads via @electron/get (which works), then extracts with a
 * blocking native unzip so there is no event loop to abandon. It verifies the
 * binary and path.txt exist and exits non-zero if provisioning failed.
 */
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { downloadArtifact } = require('@electron/get');

const electronDir = path.dirname(require.resolve('electron/package.json'));
const { version } = require(path.join(electronDir, 'package.json'));

function getPlatformPath(platform) {
  switch (platform) {
    case 'mas':
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron';
    case 'freebsd':
    case 'openbsd':
    case 'linux':
      return 'electron';
    case 'win32':
      return 'electron.exe';
    default:
      throw new Error('Electron builds are not available on platform: ' + platform);
  }
}

const platform = process.env.ELECTRON_INSTALL_PLATFORM || process.platform;
let arch = process.env.ELECTRON_INSTALL_ARCH || process.arch;

// Mirror electron/install.js: on Apple Silicon running an x64 node under Rosetta,
// download the arm64 build instead.
if (platform === 'darwin' && process.platform === 'darwin' && arch === 'x64') {
  try {
    if (childProcess.execSync('sysctl -in sysctl.proc_translated').toString().trim() === '1') {
      arch = 'arm64';
    }
  } catch {
    // ignore
  }
}

const platformPath = getPlatformPath(platform);
const pathFile = path.join(electronDir, 'path.txt');
const distDir = path.join(electronDir, 'dist');

async function main() {
  if (fs.existsSync(pathFile) && fs.existsSync(path.join(distDir, platformPath))) {
    console.log(`Electron ${version} already provisioned (${platformPath}).`);
    return;
  }

  console.log(`Provisioning Electron ${version} for ${platform}-${arch}...`);
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform,
    arch,
    checksums: require(path.join(electronDir, 'checksums.json'))
  });

  // Extract synchronously (see file header for why extract-zip is avoided here).
  fs.mkdirSync(distDir, { recursive: true });
  if (process.platform === 'win32') {
    // bsdtar ships with Windows 10+ and handles zip archives.
    childProcess.execFileSync('tar', ['-xf', zipPath, '-C', distDir], { stdio: 'inherit' });
  } else if (process.platform === 'darwin') {
    // ditto preserves the symlinks/permissions inside Electron.app.
    childProcess.execFileSync('ditto', ['-x', '-k', zipPath, distDir], { stdio: 'inherit' });
  } else {
    childProcess.execFileSync('unzip', ['-q', '-o', zipPath, '-d', distDir], { stdio: 'inherit' });
  }

  // Move bundled type definitions up, mirroring electron/install.js.
  const srcTypeDef = path.join(distDir, 'electron.d.ts');
  if (fs.existsSync(srcTypeDef)) {
    fs.renameSync(srcTypeDef, path.join(electronDir, 'electron.d.ts'));
  }

  fs.writeFileSync(pathFile, platformPath);
}

main()
  .then(() => {
    if (!fs.existsSync(pathFile) || !fs.existsSync(path.join(distDir, platformPath))) {
      console.error('Electron provisioning failed: path.txt or binary missing after install.');
      process.exit(1);
    }
    console.log(`Electron provisioned: ${fs.readFileSync(pathFile, 'utf-8')}`);
  })
  .catch((err) => {
    console.error(err.stack || err);
    process.exit(1);
  });
