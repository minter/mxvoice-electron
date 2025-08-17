// build/sslSign.cjs
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Electron-builder will call this for each file to sign.
 * It passes either a string (path) or an object with { path }.
 */
module.exports = async function sign(file, context) {
  if (process.platform !== "win32") return;

  const actualPath = typeof file === "string" ? file : (file && (file.path || file.file));
  if (!actualPath) {
    console.warn("[win.sign] No file path provided");
    return;
  }

  const username    = process.env.SSL_USERNAME;
  const credential  = process.env.SSL_CREDENTIAL_ID;
  const password    = process.env.SSL_PASSWORD;
  const totpSecret  = process.env.SSL_TOTP_SECRET;

  if (!username || !credential || !password || !totpSecret) {
    throw new Error("[win.sign] Missing SSL.com env: SSL_USERNAME, SSL_CREDENTIAL_ID, SSL_PASSWORD, SSL_TOTP_SECRET");
  }

  // Optional: log pre-sign info
  try {
    const buf = fs.readFileSync(actualPath);
    const sha = require("crypto").createHash("sha512").update(buf).digest("base64").slice(0, 8);
    console.log(`[win.sign] 📁 Pre-signing file info: size=${buf.length}, sha512=${sha}...`);
  } catch (e) {
    console.warn("[win.sign] ⚠️ Could not read pre-signing file info:", e && e.message);
  }

  // SSL.com CodeSignTool path
  const toolDir = "C:\\tools\\CodeSignTool";
  const jarPath = path.join(toolDir, "jar", "code_sign_tool-1.3.2.jar");
  if (!fs.existsSync(jarPath)) {
    throw new Error(`[win.sign] CodeSignTool not found at ${jarPath}`);
  }

  // Build the signing command - using the working format from previous version
  const cmd = [
    "java",
    "-jar",
    `"${jarPath}"`,
    "sign",
    `-username="${username}"`,
    `-credential_id="${credential}"`,
    `-password="${password}"`,
    `-totp_secret="${totpSecret}"`,
    `-input_file_path="${actualPath}"`,
    "-override"
  ].join(" ");

  console.log(`[win.sign] Signing file via SSL.com: ${actualPath}`);
  console.log(`[win.sign] Executing SSL.com CodeSignTool...`);

  try {
    // Change to CodeSignTool directory and execute
    execSync(cmd, { 
      cwd: toolDir,
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
    throw error;
  }
};
