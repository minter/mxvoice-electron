// build/signAllWindows.cjs
// Post-build script to sign installer and uninstaller after electron-builder completes.
// Unpacked files are already signed by the afterPack hook.
const path = require("path");
const fs = require("fs");
const { resolveWindowsReleaseArtifacts } = require("./release-artifacts.cjs");
const { findSigntool, logCertInfo, signFiles, verifySignedFile } = require("./win-sign-utils.cjs");

if (process.platform !== "win32") {
  console.log("[signAllWindows] Skipping - not Windows platform");
  process.exit(0);
}

const distDir = path.join(process.cwd(), "dist");
if (!fs.existsSync(distDir)) {
  console.error("[signAllWindows] dist/ directory not found");
  process.exit(1);
}

let filesToSign;
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  ({ filesToSign } = resolveWindowsReleaseArtifacts(distDir, packageJson));
} catch (error) {
  console.error(`[signAllWindows] ${error.message}`);
  process.exit(1);
}

console.log(`[signAllWindows] Found ${filesToSign.length} files to sign:`);
filesToSign.forEach((file, idx) => {
  console.log(`[signAllWindows]   ${idx + 1}. ${file}`);
});

const signtoolPath = findSigntool();
if (!signtoolPath) {
  console.error("[signAllWindows] signtool.exe not found. Please install Windows SDK or set SIGNTOOL_PATH environment variable.");
  process.exit(1);
}

console.log(`[signAllWindows] Using signtool: ${signtoolPath}`);
logCertInfo("[signAllWindows]");
console.log(`[signAllWindows] Timestamp server: http://ts.ssl.com`);
console.log(`[signAllWindows] Note: You will be prompted for YubiKey PIN once for all files`);

try {
  signFiles(signtoolPath, filesToSign);

  console.log(`[signAllWindows] Successfully signed ${filesToSign.length} files`);

  // Verify signatures
  console.log(`[signAllWindows] Verifying signatures...`);
  for (const file of filesToSign) {
    verifySignedFile(signtoolPath, file);
  }
  console.log(`[signAllWindows] Verified all ${filesToSign.length} files against the pinned publisher`);

} catch (error) {
  console.error("[signAllWindows] Failed to sign files:", error.message);
  console.error("");
  console.error("[signAllWindows] Troubleshooting:");
  console.error("[signAllWindows]   1. Ensure YubiKey is inserted and certificate is in Windows store");
  console.error("[signAllWindows]   2. Verify the pinned publisher certificate is installed:");
  console.error("[signAllWindows]      Get-ChildItem Cert:\\CurrentUser\\My | Select Thumbprint, Subject");
  console.error("[signAllWindows]   3. Update win-sign-utils.cjs through review before rotating certificates");
  console.error("");
  process.exit(1);
}
