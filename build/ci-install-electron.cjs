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

const electronDir = path.dirname(require.resolve('electron/package.json'));
const { version } = require(path.join(electronDir, 'package.json'));

// --- debug instrumentation (synchronous, truncation-proof) ---
const LOG = path.join(process.cwd(), 'electron-provision.log');
function trace(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG, line); } catch {}
  process.stderr.write(line);
}
try { fs.writeFileSync(LOG, ''); } catch {}
process.on('exit', (code) => trace(`process exit event, code=${code}`));
process.on('beforeExit', (code) => trace(`process beforeExit event, code=${code}`));
process.on('unhandledRejection', (err) => { trace(`unhandledRejection: ${err && err.stack || err}`); process.exitCode = 1; });
process.on('uncaughtException', (err) => { trace(`uncaughtException: ${err && err.stack || err}`); process.exitCode = 1; });
trace(`start: node ${process.version}, platform=${process.platform}, arch=${process.arch}`);

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
  trace('calling downloadArtifact...');
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform,
    arch,
    checksums: require(path.join(electronDir, 'checksums.json'))
  });
  trace(`downloadArtifact resolved: ${zipPath} (exists=${fs.existsSync(zipPath)})`);

  // Extract synchronously. extract-zip's async extraction is silently
  // abandoned on some CI Node builds (the event loop drains mid-extract and
  // the process exits 0 without unzipping), so use a blocking native unzip.
  fs.mkdirSync(distDir, { recursive: true });
  trace('extracting (sync)...');
  if (process.platform === 'win32') {
    // bsdtar ships with Windows 10+ and handles zip archives.
    childProcess.execFileSync('tar', ['-xf', zipPath, '-C', distDir], { stdio: 'inherit' });
  } else if (process.platform === 'darwin') {
    // ditto preserves the symlinks/permissions inside Electron.app.
    childProcess.execFileSync('ditto', ['-x', '-k', zipPath, distDir], { stdio: 'inherit' });
  } else {
    childProcess.execFileSync('unzip', ['-q', '-o', zipPath, '-d', distDir], { stdio: 'inherit' });
  }
  trace('extract complete');

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
