// build/win-sign-utils.cjs
// Shared utilities for Windows code signing with signtool.exe and YubiKey.
const { execSync, spawnSync } = require("child_process");
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

const AUTHENTICODE_INSPECTION = `
$signature = Get-AuthenticodeSignature -LiteralPath $env:MXVOICE_SIGNATURE_PATH
$certificate = $signature.SignerCertificate
$publisher = if ($null -ne $certificate) {
  $certificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
} else {
  $null
}
$subject = if ($null -ne $certificate) { $certificate.Subject } else { $null }
$thumbprint = if ($null -ne $certificate) { $certificate.Thumbprint } else { $null }
[pscustomobject]@{
  Status = $signature.Status.ToString()
  Publisher = $publisher
  Subject = $subject
  Thumbprint = $thumbprint
} | ConvertTo-Json -Compress
`;

/**
 * Read an executable's Authenticode status and signer identity without putting
 * the file path into executable PowerShell source.
 *
 * @param {string} filePath
 * @param {Function} [runPowerShell]
 * @returns {{status: string, publisher: string|null, subject: string|null, thumbprint: string|null}}
 */
function inspectAuthenticodeSignature(filePath, runPowerShell = spawnSync) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("A Windows artifact path is required for signature verification");
  }

  const result = runPowerShell(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", AUTHENTICODE_INSPECTION],
    {
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, MXVOICE_SIGNATURE_PATH: filePath }
    }
  );

  if (result.error) {
    throw new Error(`Could not inspect Authenticode signature: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || "").trim() || `PowerShell exited with status ${result.status}`;
    throw new Error(`Could not inspect Authenticode signature: ${detail}`);
  }

  let signature;
  try {
    signature = JSON.parse(String(result.stdout || "").trim());
  } catch {
    throw new Error("Could not inspect Authenticode signature: PowerShell returned invalid JSON");
  }

  return {
    status: signature.Status,
    publisher: signature.Publisher || null,
    subject: signature.Subject || null,
    thumbprint: signature.Thumbprint || null
  };
}

/**
 * Require a valid Authenticode chain whose simple publisher name exactly
 * matches package.json's updater publisher pin.
 *
 * @param {string} filePath
 * @param {string|string[]} expectedPublishers
 * @param {Function} [runPowerShell]
 * @returns {{status: string, publisher: string, subject: string|null, thumbprint: string|null}}
 */
function verifyExpectedPublisher(filePath, expectedPublishers, runPowerShell = spawnSync) {
  const publishers = (Array.isArray(expectedPublishers) ? expectedPublishers : [expectedPublishers])
    .filter((publisher) => typeof publisher === "string" && publisher.length > 0);
  if (publishers.length === 0) {
    throw new Error("Windows publisherName must pin at least one expected publisher");
  }

  const signature = inspectAuthenticodeSignature(filePath, runPowerShell);
  if (signature.status !== "Valid") {
    throw new Error(`Windows artifact has no valid Authenticode signature (status: ${signature.status || "unknown"})`);
  }
  if (!publishers.includes(signature.publisher)) {
    throw new Error(`Windows artifact publisher ${JSON.stringify(signature.publisher)} does not match ${publishers.map(JSON.stringify).join(", ")}`);
  }
  return signature;
}

module.exports = {
  findSigntool,
  buildSignCommand,
  logCertInfo,
  inspectAuthenticodeSignature,
  verifyExpectedPublisher
};
