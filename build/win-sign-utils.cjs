// build/win-sign-utils.cjs
// Shared utilities for Windows code signing with signtool.exe and YubiKey.
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Locate signtool.exe by checking common Windows SDK paths and PATH.
 * @returns {string|null} Resolved path to signtool.exe, or null if not found.
 */
function findSigntool() {
  const candidates = [
    process.env.SIGNTOOL_PATH,
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe",
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe",
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.17763.0\\x64\\signtool.exe",
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe",
    "signtool.exe"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (path.isAbsolute(candidate)) {
        if (fs.existsSync(candidate)) return candidate;
      } else {
        execSync(`where ${candidate}`, { stdio: "ignore" });
        return candidate;
      }
    } catch {
      // Continue to next candidate
    }
  }
  return null;
}

/**
 * Build a signtool sign command for one or more files.
 *
 * Certificate selection priority:
 *   1. YUBIKEY_CERT_THUMBPRINT (/sha1)
 *   2. YUBIKEY_CERT_NAME       (/n)
 *   3. Auto-select             (/a)
 *
 * @param {string}   signtoolPath  Absolute path to signtool.exe
 * @param {string[]} filesToSign   Paths of files to sign
 * @returns {string} The assembled command string ready for execSync.
 */
function buildSignCommand(signtoolPath, filesToSign) {
  const certThumbprint = process.env.YUBIKEY_CERT_THUMBPRINT;
  const certName = process.env.YUBIKEY_CERT_NAME;

  const parts = [`"${signtoolPath}"`, "sign", "/s", "My"];

  if (certThumbprint) {
    parts.push("/sha1", certThumbprint);
  } else if (certName) {
    parts.push("/n", `"${certName}"`);
  } else {
    parts.push("/a");
  }

  parts.push("/fd", "sha256", "/td", "sha256", "/tr", "http://ts.ssl.com");

  for (const file of filesToSign) {
    parts.push(`"${file}"`);
  }

  return parts.join(" ");
}

/**
 * Log which certificate selection method is in use.
 * @param {string} prefix  Log prefix, e.g. "[afterPack]"
 */
function logCertInfo(prefix) {
  const certThumbprint = process.env.YUBIKEY_CERT_THUMBPRINT;
  const certName = process.env.YUBIKEY_CERT_NAME;
  if (certThumbprint) {
    console.log(`${prefix} Certificate: thumbprint ${certThumbprint}`);
  } else if (certName) {
    console.log(`${prefix} Certificate: ${certName}`);
  } else {
    console.log(`${prefix} Certificate: auto-select`);
  }
}

module.exports = { findSigntool, buildSignCommand, logCertInfo };
