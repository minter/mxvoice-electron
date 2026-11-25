// build/win-sign-utils.cjs
// Shared utilities for Windows code signing with signtool.exe and YubiKey.
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const WINDOWS_PUBLISHER_THUMBPRINT = "EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9";

/**
 * Locate signtool.exe by checking common Windows SDK paths and PATH.
 * @returns {string|null} Resolved path to signtool.exe, or null if not found.
 */
function findSigntool(fileSystem = fs, runFile = execFileSync) {
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
        if (fileSystem.existsSync(candidate)) return candidate;
      } else {
        runFile("where.exe", [candidate], { stdio: "ignore" });
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
 * @param {string[]} filesToSign   Paths of files to sign
 * @returns {string[]} Arguments for signtool.exe.
 */
function buildSignArgs(filesToSign) {
  return [
    "sign",
    "/s", "My",
    "/sha1", WINDOWS_PUBLISHER_THUMBPRINT,
    "/fd", "sha256",
    "/td", "sha256",
    "/tr", "http://ts.ssl.com",
    ...filesToSign
  ];
}

function signFiles(signtoolPath, filesToSign, runFile = execFileSync) {
  runFile(signtoolPath, buildSignArgs(filesToSign), { stdio: "inherit", timeout: 300000 });
}

function normalizeThumbprint(value) {
  return String(value ?? "").replace(/\s/g, "").toUpperCase();
}

function verifySignedFile(signtoolPath, file, runFile = execFileSync) {
  runFile(signtoolPath, ["verify", "/pa", "/all", file], { stdio: "ignore" });

  // The path travels in the environment, never in PowerShell's command text:
  // -Command re-joins its extra arguments without their quotes, which would
  // cut a path with a space (C:\Users\Some Name\...) at the space
  const script = [
    "$signature = Get-AuthenticodeSignature -LiteralPath $env:MXVOICE_SIGNATURE_PATH",
    "if ($null -eq $signature.SignerCertificate) { exit 2 }",
    "Write-Output ($signature.Status.ToString() + '|' + $signature.SignerCertificate.Thumbprint)"
  ].join("; ");
  const output = runFile(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, MXVOICE_SIGNATURE_PATH: file }
    }
  ).trim();
  const result = output.split(/\r?\n/).filter(Boolean).at(-1) ?? "";
  const separator = result.indexOf("|");
  const status = separator === -1 ? result : result.slice(0, separator);
  const thumbprint = separator === -1 ? "" : normalizeThumbprint(result.slice(separator + 1));

  if (status !== "Valid") {
    throw new Error(`Authenticode status for ${file} is ${status || "missing"}`);
  }
  if (thumbprint !== WINDOWS_PUBLISHER_THUMBPRINT) {
    throw new Error(`Signer thumbprint for ${file} is ${thumbprint || "missing"}, expected pinned publisher`);
  }
}

/**
 * Log which certificate selection method is in use.
 * @param {string} prefix  Log prefix, e.g. "[afterPack]"
 */
function logCertInfo(prefix) {
  console.log(`${prefix} Certificate: pinned thumbprint ${WINDOWS_PUBLISHER_THUMBPRINT}`);
}

module.exports = {
  WINDOWS_PUBLISHER_THUMBPRINT,
  buildSignArgs,
  findSigntool,
  logCertInfo,
  signFiles,
  verifySignedFile
};
