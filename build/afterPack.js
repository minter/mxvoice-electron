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


}
