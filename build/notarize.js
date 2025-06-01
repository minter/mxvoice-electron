const { notarize } = require('@electron/notarize');
const { execSync } = require('child_process');
const path = require('path');
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

function isMachOBinary(filePath) {
  // Use 'file' command to check if file is a Mach-O binary or dylib or .node native module
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.node') {
    return true;
  }
  try {
    const { execSync } = require('child_process');
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

async function signAppBinaries(appPath, identity, entitlements) {
  // Collect all files and directories to sign
  const toSign = [];

  walkDir(appPath, (filePath, isDir) => {
    if (isDir) {
      // Sign .app bundles inside Contents/Frameworks (helper apps)
      if (filePath.endsWith('.app')) {
        toSign.push({ path: filePath, isDir: true });
      }
    } else {
      if (isMachOBinary(filePath)) {
        toSign.push({ path: filePath, isDir: false });
      }
    }
  });

  // Sign all collected binaries and app bundles
  for (const item of toSign) {
    try {
      console.log(`Signing ${item.isDir ? 'app bundle' : 'binary'}: ${item.path}`);
      execSync(
        `codesign --sign "${identity}" --entitlements "${entitlements}" --options runtime --timestamp --force "${item.path}"`,
        { stdio: 'inherit' }
      );
    } catch (error) {
      console.error(`Failed to sign ${item.isDir ? 'app bundle' : 'binary'} ${item.path}:`, error);
      throw error;
    }
  }

  // Finally, sign the main app bundle itself
  try {
    console.log(`Signing main app bundle: ${appPath}`);
    execSync(
      `codesign --sign "${identity}" --entitlements "${entitlements}" --options runtime --timestamp --force "${appPath}"`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error(`Failed to sign app bundle ${appPath}:`, error);
    throw error;
  }
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, packager, buildMetadata } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // Notarization only in afterSign hook
  // So skip signing here to avoid conflicts with electron-builder signing process
  // Just perform notarization

  // Check for environment variables for notarization
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Skipping notarization: Missing required environment variables');
    console.log(`APPLE_ID: ${appleId ? 'Set' : 'Missing'}`);
    console.log(`APPLE_APP_SPECIFIC_PASSWORD/APPLE_ID_PASSWORD: ${appleIdPassword ? 'Set' : 'Missing'}`);
    console.log(`APPLE_TEAM_ID: ${teamId ? 'Set' : 'Missing'}`);
    return;
  }

  console.log(`Notarizing ${appName} with Apple ID: ${appleId}, Team ID: ${teamId}`);

  try {
    await notarize({
      tool: 'notarytool',
      appPath: appPath,
      appleId: appleId,
      appleIdPassword: appleIdPassword,
      teamId: teamId,
    });
    console.log('Notarization completed successfully');
  } catch (error) {
    console.error('Notarization failed:', error);
    // Don't throw the error to allow the build to continue
  }
};
