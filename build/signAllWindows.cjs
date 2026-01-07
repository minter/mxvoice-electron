// build/signAllWindows.cjs
// Standalone script to sign all Windows files after electron-builder completes
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

if (process.platform !== "win32") {
  console.log("[signAllWindows] Skipping - not Windows platform");
  process.exit(0);
}

const distDir = path.join(process.cwd(), "dist");
if (!fs.existsSync(distDir)) {
  console.error("[signAllWindows] dist/ directory not found");
  process.exit(1);
}

// Find all files that need signing
const filesToSign = [];

// Note: Files in win-unpacked are already signed by afterPack hook before installer creation
// We only need to sign the installer and uninstaller here

// 3. Installer and uninstaller in dist
try {
  const entries = fs.readdirSync(distDir);
  for (const entry of entries) {
    const fullPath = path.join(distDir, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const lower = entry.toLowerCase();
        if (lower.endsWith(".exe") && (lower.includes("setup") || lower.includes("uninstall"))) {
          filesToSign.push(fullPath);
        }
      }
    } catch (e) {
      // Skip if can't stat
    }
  }
} catch (e) {
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

// Find signtool.exe
const signtoolPaths = [
  process.env.SIGNTOOL_PATH,
  "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe",
  "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe",
  "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.17763.0\\x64\\signtool.exe",
  "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe",
  "signtool.exe"
].filter(Boolean);

let signtoolPath = null;
for (const candidatePath of signtoolPaths) {
  try {
    if (path.isAbsolute(candidatePath)) {
      if (fs.existsSync(candidatePath)) {
        signtoolPath = candidatePath;
        break;
      }
    } else {
      execSync(`where ${candidatePath}`, { stdio: "ignore" });
      signtoolPath = candidatePath;
      break;
    }
  } catch (e) {
    // Continue to next candidate
  }
}

if (!signtoolPath) {
  console.error("[signAllWindows] signtool.exe not found. Please install Windows SDK or set SIGNTOOL_PATH environment variable.");
  process.exit(1);
}

// Certificate configuration
const certName = process.env.YUBIKEY_CERT_NAME;
const certThumbprint = process.env.YUBIKEY_CERT_THUMBPRINT;

// Build signtool command - sign ALL files in one command
const cmdParts = [
  `"${signtoolPath}"`,
  "sign",
  "/s", "My"
];

if (certThumbprint) {
  cmdParts.push("/sha1", certThumbprint);
} else if (certName) {
  cmdParts.push("/n", `"${certName}"`);
} else {
  cmdParts.push("/a");
}

cmdParts.push(
  "/fd", "sha256",
  "/td", "sha256",
  "/tr", "http://ts.ssl.com"
);

filesToSign.forEach(file => {
  cmdParts.push(`"${file}"`);
});

const cmd = cmdParts.join(" ");

console.log(`[signAllWindows] Signing ${filesToSign.length} files in one command...`);
console.log(`[signAllWindows] Using signtool: ${signtoolPath}`);
if (certThumbprint) {
  console.log(`[signAllWindows] Certificate: thumbprint ${certThumbprint}`);
} else if (certName) {
  console.log(`[signAllWindows] Certificate: ${certName}`);
} else {
  console.log(`[signAllWindows] Certificate: auto-select`);
}
console.log(`[signAllWindows] Timestamp server: http://ts.ssl.com`);
console.log(`[signAllWindows] Note: You will be prompted for YubiKey PIN once for all files`);

try {
  execSync(cmd, {
    stdio: "inherit",
    timeout: 300000
  });
  
  console.log(`[signAllWindows] ✅ Successfully signed ${filesToSign.length} files!`);
  
  // Verify signatures
  console.log(`[signAllWindows] Verifying signatures...`);
  let verifiedCount = 0;
  for (const file of filesToSign) {
    try {
      execSync(`"${signtoolPath}" verify /pa "${file}"`, { stdio: "ignore" });
      verifiedCount++;
    } catch (e) {
      console.warn(`[signAllWindows] ⚠️ Verification failed for: ${file}`);
    }
  }
  console.log(`[signAllWindows] Verified ${verifiedCount}/${filesToSign.length} files`);
  
} catch (error) {
  console.error("[signAllWindows] ❌ Failed to sign files:", error.message);
  console.error("");
  console.error("[signAllWindows] 💡 Troubleshooting:");
  console.error("[signAllWindows]   1. Ensure YubiKey is inserted and certificate is in Windows store");
  console.error("[signAllWindows]   2. Set YUBIKEY_CERT_THUMBPRINT environment variable:");
  console.error(`[signAllWindows]      $env:YUBIKEY_CERT_THUMBPRINT="EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9"`);
  console.error("[signAllWindows]   3. Or set YUBIKEY_CERT_NAME with certificate subject name");
  console.error("[signAllWindows]   4. Verify certificate: Get-ChildItem Cert:\\CurrentUser\\My | Select Thumbprint, Subject");
  console.error("");
  process.exit(1);
}

