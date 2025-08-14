// build/afterPack.js
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import crypto from 'crypto';

function isMachO(p) {
  try {
    const out = execSync(`file "${p}"`).toString();
    return /Mach-O/.test(out);
  } catch {
    return false;
  }
}

function sign(binaryPath, identity, entitlements) {
  execSync(
    `codesign --sign "${identity}" --entitlements "${entitlements}" ` +
    `--options runtime --timestamp --force "${binaryPath}"`,
    { stdio: 'inherit' }
  );
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

// ---------- Windows signing helpers (SSL.com) ----------
function generateTOTP(secret, timeStep = 30, digits = 6) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);
  const key = Buffer.from(secret, 'base64');
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (code % Math.pow(10, digits)).toString().padStart(digits, '0');
}

function signWithSSLCom(installerOrExePath) {
  const username = process.env.SSL_USERNAME;
  const credentialId = process.env.SSL_CREDENTIAL_ID;
  const password = process.env.SSL_PASSWORD;
  const totpSecret = process.env.SSL_TOTP_SECRET;

  if (!username || !credentialId || !password || !totpSecret) {
    console.warn('Skipping SSL.com signing (env not set) for', installerOrExePath);
    return;
  }

  const totp = generateTOTP(totpSecret);

  const codeSignToolDir = 'C\\tools\\CodeSignTool';
  const jarPath = path.join(codeSignToolDir, 'jar', 'code_sign_tool-1.3.2.jar');
  if (!fs.existsSync(jarPath)) {
    console.warn('CodeSignTool jar not found, skipping SSL.com signing:', jarPath);
    return;
  }

  const command = [
    'java',
    '-jar',
    `"${jarPath}"`,
    'sign',
    `-username="${username}"`,
    `-credential_id="${credentialId}"`,
    `-password="${password}"`,
    `-totp_secret="${totpSecret}"`,
    `-input_file_path="${installerOrExePath}"`,
    '-override'
  ].join(' ');

  try {
    execSync(command, {
      cwd: codeSignToolDir,
      stdio: 'inherit',
      timeout: 120000
    });
  } catch (e) {
    console.error('Failed SSL.com signing for', installerOrExePath, e);
    throw e;
  }
}

export default async function afterPack(context) {
  const { appOutDir, packager } = context;

  // macOS payload signing (Mach-O inside asar.unpacked)
  if (process.platform === 'darwin') {
    const appPath = path.join(appOutDir, `${packager.appInfo.productFilename}.app`);
    const identity = packager.codeSigningInfo?.keychainName
      ? packager.codeSigningInfo.identity
      : packager.platformSpecificBuildOptions.identity || process.env.CSC_NAME || 'Developer ID Application';
    const entitlements = packager.platformSpecificBuildOptions.entitlements || 'build/entitlements.mac.plist';
    const unpacked = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked');
    if (!fs.existsSync(unpacked)) return;
    const files = walk(unpacked).filter(isMachO);
    for (const f of files) {
      try {
        sign(f, identity, entitlements);
      } catch (e) {
        console.error('Failed signing', f, e);
        throw e;
      }
    }
    return;
  }

  // Windows: sign main exe and helper before NSIS packages them
  if (process.platform === 'win32') {
    const mainExe = path.join(appOutDir, `${packager.appInfo.productFilename}.exe`);
    const elevateExe = path.join(appOutDir, 'resources', 'elevate.exe');

    if (fs.existsSync(mainExe)) {
      console.log(`SSL.com signing (pre-NSIS): ${mainExe}`);
      signWithSSLCom(mainExe);
    }

    if (fs.existsSync(elevateExe)) {
      console.log(`SSL.com signing (pre-NSIS): ${elevateExe}`);
      signWithSSLCom(elevateExe);
    }
  }
}
