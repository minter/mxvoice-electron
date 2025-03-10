const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

async function signBinary(binaryPath, identity, entitlements) {
  try {
    console.log(`Signing binary: ${binaryPath}`);
    execSync(
      `codesign --sign "${identity}" --entitlements "${entitlements}" --options runtime --timestamp --force "${binaryPath}"`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error(`Failed to sign binary ${binaryPath}:`, error);
    throw error;
  }
}

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((f) => {
    const fullPath = path.join(dir, f);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      callback(fullPath, true);
      walkDir(fullPath, callback);
    } else if (stats.isFile()) {
      callback(fullPath, false);
    }
  });
}

function isMachOBinary(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.node') {
    return true;
  }
  try {
    const output = execSync(`file -b "${filePath}"`).toString();
    if (
      output.includes('Mach-O') &&
      (output.includes('executable') || output.includes('dynamically linked shared library'))
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function signUnpackedBinaries(appPath, identity, entitlements) {
  const toSign = [];
  walkDir(appPath, (filePath, isDir) => {
    if (!isDir && isMachOBinary(filePath)) {
      toSign.push(filePath);
    }
  });
  for (const filePath of toSign) {
    await signBinary(filePath, identity, entitlements);
  }
}

module.exports = async function afterPack(context) {
  const { appOutDir, packager } = context;

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  // Use SHA-1 fingerprint to avoid ambiguity
  const defaultIdentity = 'E31B13B9566B95D1BC1F46F0C3B2FA6C739356CB';
  let identity = process.env.CSC_NAME || packager.config.mac.identity || defaultIdentity;
  // If CSC_NAME is just the team ID, expand to full identity string
  if (
    process.env.CSC_NAME &&
    /^([A-Z0-9]{10})$/.test(process.env.CSC_NAME)
  ) {
    identity = `Developer ID Application: Fourth Line LLC (${process.env.CSC_NAME})`;
  } else if (!process.env.CSC_NAME && process.env.APPLE_TEAM_ID) {
    identity = `Developer ID Application: Fourth Line LLC (${process.env.APPLE_TEAM_ID})`;
  }
  const entitlements = path.resolve(packager.info.projectDir, packager.config.mac.entitlements);

  if (!identity || !entitlements) {
    console.log('Skipping recursive signing in afterPack: Missing identity or entitlements');
    return;
  }
  console.log(`Using code signing identity: ${identity}`);

  try {
    console.log('Running afterPack hook: recursive signing of unpacked binaries');
    const unpackedPath = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) {
      await signUnpackedBinaries(unpackedPath, identity, entitlements);
    }
  } catch (error) {
    console.error('Error during recursive signing in afterPack:', error);
    throw error;
  }
};
