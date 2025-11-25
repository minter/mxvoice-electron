// build/sslSign.cjs
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Electron-builder will call this for each file to sign.
 * This hook is called during the build process, not after.
 * 
 * Uses Windows native signtool.exe with YubiKey smart card certificate.
 */
module.exports = async function sign(file, context) {
  if (process.platform !== "win32") return;

  const actualPath = typeof file === "string" ? file : (file && (file.path || file.file));
  if (!actualPath) {
    console.warn("[win.sign] No file path provided");
    return;
  }

  // Optional: log pre-sign info
  try {
    const buf = fs.readFileSync(actualPath);
    const sha = require("crypto").createHash("sha512").update(buf).digest("base64").slice(0, 8);
    console.log(`[win.sign] 📁 Pre-signing file info: size=${buf.length}, sha512=${sha}...`);
  } catch (e) {
    console.warn("[win.sign] ⚠️ Could not read pre-signing file info:", e && e.message);
  }

  // Find signtool.exe - check common locations
  const signtoolPaths = [
    process.env.SIGNTOOL_PATH, // Custom path from env
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe",
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe",
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.17763.0\\x64\\signtool.exe",
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe",
    "signtool.exe" // Fallback to PATH
  ].filter(Boolean);

  let signtoolPath = null;
  for (const candidatePath of signtoolPaths) {
    try {
      // Check if file exists (for absolute paths) or try to execute (for PATH)
      if (path.isAbsolute(candidatePath)) {
        if (fs.existsSync(candidatePath)) {
          signtoolPath = candidatePath;
          break;
        }
      } else {
        // Try to find in PATH
        execSync(`where ${candidatePath}`, { stdio: "ignore" });
        signtoolPath = candidatePath;
        break;
      }
    } catch (e) {
      // Continue to next candidate
    }
  }

  if (!signtoolPath) {
    throw new Error(
      "[win.sign] signtool.exe not found. Please install Windows SDK or set SIGNTOOL_PATH environment variable.\n" +
      "Common locations: C:\\Program Files (x86)\\Windows Kits\\10\\bin\\<version>\\x64\\signtool.exe"
    );
  }

  // Certificate configuration
  const certName = process.env.YUBIKEY_CERT_NAME; // Optional: specific certificate name
  const certThumbprint = process.env.YUBIKEY_CERT_THUMBPRINT; // Optional: certificate thumbprint (more reliable)
  const keyContainer = process.env.YUBIKEY_KEY_CONTAINER; // Optional: key container name
  const yubikeyPin = process.env.YUBIKEY_PIN; // Optional: PIN (will prompt if not set)

  // Helper function to list available certificates
  const listCertificates = () => {
    try {
      console.log(`[win.sign] 🔍 Listing available certificates...`);
      const listCmd = `"${signtoolPath}" sign /sm /?`;
      // Try to get certificate info - signtool doesn't have a direct list command
      // But we can try certmgr or use a different approach
      console.log(`[win.sign] 💡 To list certificates, run:`);
      console.log(`[win.sign]    certmgr.msc (open Certificate Manager)`);
      console.log(`[win.sign]    or: signtool sign /sm /?`);
    } catch (e) {
      // Ignore errors in listing
    }
  };

  // Build signtool command
  // /sm = use smart card (YubiKey) - this caches PIN for the session
  // /s = certificate store (My = personal store where smart card certs are)
  // /a = automatically select the best certificate (only works if certName not specified)
  // /tr = timestamp server (RFC 3161)
  // /td = timestamp digest algorithm
  // /fd = file digest algorithm
  // /n = certificate name (required if /a doesn't work)
  // /p = PIN (optional, will prompt if not provided)
  
  // Build signtool command based on the working example from yubikey-sslcom-complete.md
  // Key points:
  // - NO /sm flag - certificate is in Windows store, Windows accesses YubiKey automatically
  // - Use /sha1 with thumbprint (most reliable)
  // - Use /s My to specify certificate store
  // - Use SSL.com timestamp server: http://ts.ssl.com
  const buildSignCommand = () => {
    const cmdParts = [
      `"${signtoolPath}"`,
      "sign",
      "/s", "My" // Certificate store (My = Personal store)
    ];

    // Certificate selection: prefer thumbprint, then name, then auto-select
    if (certThumbprint) {
      cmdParts.push("/sha1", certThumbprint);
    } else if (certName) {
      cmdParts.push("/n", `"${certName}"`);
    } else {
      cmdParts.push("/a"); // Auto-select certificate
    }

    // Add timestamp and digest options (using SSL.com timestamp server)
    cmdParts.push(
      "/fd", "sha256",  // File digest
      "/td", "sha256",  // Timestamp digest
      "/tr", "http://ts.ssl.com" // SSL.com timestamp server (not digicert!)
    );

    // Add file to sign
    cmdParts.push(`"${actualPath}"`);

    return cmdParts.join(" ");
  };

  console.log(`[win.sign] Signing file with YubiKey certificate: ${actualPath}`);
  console.log(`[win.sign] Using signtool: ${signtoolPath}`);
  if (certThumbprint) {
    console.log(`[win.sign] Certificate: thumbprint ${certThumbprint}`);
  } else if (certName) {
    console.log(`[win.sign] Certificate: ${certName}`);
  } else {
    console.log(`[win.sign] Certificate: auto-select`);
  }
  console.log(`[win.sign] Timestamp server: http://ts.ssl.com`);
  console.log(`[win.sign] Note: YubiKey PIN will be prompted if needed (cached per card session)`);

  try {
    const cmd = buildSignCommand();
    execSync(cmd, {
      stdio: "inherit",
      timeout: 120000 // 2 minute timeout
    });
    
    console.log(`[win.sign] ✅ File signed successfully!`);
    console.log(`[win.sign] Signed file: ${actualPath}`);
    
    // Log post-signing file info for comparison
    try {
      const buf = fs.readFileSync(actualPath);
      const sha = require("crypto").createHash("sha512").update(buf).digest("base64").slice(0, 8);
      console.log(`[win.sign] 📁 Post-signing file info: size=${buf.length}, sha512=${sha}...`);
    } catch (e) {
      console.warn("[win.sign] ⚠️ Could not read post-signing file info:", e && e.message);
    }
    
  } catch (error) {
    console.error("[win.sign] ❌ Failed to sign file:", error.message);
    console.error("");
    console.error("[win.sign] 💡 Troubleshooting:");
    console.error("[win.sign]   1. Ensure YubiKey is inserted and certificate is in Windows store");
    console.error("[win.sign]   2. Set YUBIKEY_CERT_THUMBPRINT environment variable:");
    console.error(`[win.sign]      $env:YUBIKEY_CERT_THUMBPRINT="EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9"`);
    console.error("[win.sign]   3. Or set YUBIKEY_CERT_NAME with certificate subject name");
    console.error("[win.sign]   4. Verify certificate: Get-ChildItem Cert:\\CurrentUser\\My | Select Thumbprint, Subject");
    console.error("");
    throw error;
  }
};
