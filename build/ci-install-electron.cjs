#!/usr/bin/env node
/**
 * Deterministically provision the Electron binary for CI.
 *
 * Electron's own postinstall (node_modules/electron/install.js) downloads and
 * extracts the binary via an UNAWAITED top-level promise:
 *
 *   downloadArtifact(...).then(extractFile).catch(...)
 *
 * On GitHub's runners the node process exits as soon as the download resolves —
 * before extractFile() unzips the binary and writes path.txt. The result is an
 * install that "succeeds" (exit 0) but leaves node_modules/electron/path.txt
 * missing, so require('electron') throws ENOENT at test time. Under Playwright's
 * parallel workers each worker then races the lazy re-download and the E2E suite
 * dies before any test runs.
 *
 * This script performs the same download + extract, but AWAITS every step, so
 * the process cannot exit until path.txt is written. It then verifies the result
 * and exits non-zero if provisioning failed.
 */
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');

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

  await extract(zipPath, { dir: distDir });

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
