// build/signAllWindows.cjs
// Post-build script to sign installer and uninstaller after electron-builder completes.
// Unpacked files are already signed by the afterPack hook.
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { findSigntool, buildSignCommand, logCertInfo } = require("./win-sign-utils.cjs");

if (process.platform !== "win32") {
  console.log("[signAllWindows] Skipping - not Windows platform");
  process.exit(0);
}

const distDir = path.join(process.cwd(), "dist");
if (!fs.existsSync(distDir)) {
  console.error("[signAllWindows] dist/ directory not found");
  process.exit(1);
}

// Find installer and uninstaller EXEs in dist/
const filesToSign = [];
try {
  for (const entry of fs.readdirSync(distDir)) {
    const fullPath = path.join(distDir, entry);
    try {
      if (fs.statSync(fullPath).isFile()) {
        const lower = entry.toLowerCase();
        if (lower.endsWith(".exe") && (lower.includes("setup") || lower.includes("uninstall"))) {
          filesToSign.push(fullPath);
        }
      }
    } catch {
      // Skip if can't stat
    }
  }
} catch {
  // Ignore errors
}

if (filesToSign.length === 0) {
  console.log("[signAllWindows] No files found to sign");
  process.exit(0);
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
  const cmd = buildSignCommand(signtoolPath, filesToSign);
  execSync(cmd, { stdio: "inherit", timeout: 300000 });

  console.log(`[signAllWindows] Successfully signed ${filesToSign.length} files`);

  // Verify signatures
  console.log(`[signAllWindows] Verifying signatures...`);
  let verifiedCount = 0;
  for (const file of filesToSign) {
    try {
      execSync(`"${signtoolPath}" verify /pa "${file}"`, { stdio: "ignore" });
      verifiedCount++;
    } catch {
      console.warn(`[signAllWindows] Verification failed for: ${file}`);
    }
  }
  console.log(`[signAllWindows] Verified ${verifiedCount}/${filesToSign.length} files`);

} catch (error) {
  console.error("[signAllWindows] Failed to sign files:", error.message);
  console.error("");
  console.error("[signAllWindows] Troubleshooting:");
  console.error("[signAllWindows]   1. Ensure YubiKey is inserted and certificate is in Windows store");
  console.error("[signAllWindows]   2. Set YUBIKEY_CERT_THUMBPRINT environment variable:");
  console.error(`[signAllWindows]      $env:YUBIKEY_CERT_THUMBPRINT="EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9"`);
  console.error("[signAllWindows]   3. Or set YUBIKEY_CERT_NAME with certificate subject name");
  console.error("[signAllWindows]   4. Verify certificate: Get-ChildItem Cert:\\CurrentUser\\My | Select Thumbprint, Subject");
  console.error("");
  process.exit(1);
}
