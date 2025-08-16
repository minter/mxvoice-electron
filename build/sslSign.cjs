// build/sslSign.cjs
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// (same TOTP generator you already have)
function generateTOTP(secret, timeStep = 30, digits = 6) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);
  const key = Buffer.from(secret, "base64");
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = require("crypto").createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binCode % 1_000_000).toString().padStart(digits, "0");
}

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
    const sha = crypto.createHash("sha512").update(buf).digest("base64").slice(0, 8);
    console.log(`[win.sign] pre: ${path.basename(actualPath)} sha512=${sha}... size=${buf.length}`);
  } catch (e) {
    console.warn("[win.sign] pre-sign read failed:", e && e.message);
  }

  const totp = generateTOTP(totpSecret);
  console.log(`[win.sign] TOTP: ${totp}`);

  // Adjust these for your environment
  const toolDir = "C:\\tools\\CodeSignTool";
  const jarPath = path.join(toolDir, "jar", "code_sign_tool-1.3.2.jar");
  if (!fs.existsSync(jarPath)) {
    throw new Error(`[win.sign] CodeSignTool not found at ${jarPath}`);
  }

  // eSigner command
  const cmd = [
    "java",
    "-jar",
    `"${jarPath}"`,
    "sign",
    "--username", `"${username}"`,
    "--password", `"${password}"`,
    "--credential_id", `"${credential}"`,
    "--totp", `"${totp}"`,
    // timestamp server (recommended)
    "--tsa_url", `"https://timestamp.digicert.com"`,
    // input/output in-place
    "--input", `"${actualPath}"`,
    "--output", `"${actualPath}"`,
  ].join(" ");

  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error("[win.sign] signing failed:", e && e.message);
    throw e;
  }

  // Optional: log post-sign info
  try {
    const buf = fs.readFileSync(actualPath);
    const sha = crypto.createHash("sha512").update(buf).digest("base64").slice(0, 8);
    console.log(`[win.sign] post: ${path.basename(actualPath)} sha512=${sha}... size=${buf.length}`);
  } catch (e) {
    console.warn("[win.sign] post-sign read failed:", e && e.message);
  }
};
