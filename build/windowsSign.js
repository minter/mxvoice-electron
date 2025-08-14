import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// TOTP generation function
function generateTOTP(secret, timeStep = 30, digits = 6) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);

  // Convert base64 secret to buffer
  const key = Buffer.from(secret, 'base64');

  // Create counter buffer (8 bytes, big endian)
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter & 0xffffffff, 4);

  // Generate HMAC
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  // Return 6-digit code
  return (code % Math.pow(10, digits)).toString().padStart(digits, '0');
}

async function signWindowsInstaller(context) {
  // Only handle Windows artifacts
  if (process.platform !== 'win32') {
    return;
  }

  // artifactBuildCompleted passes a context object; prefer its file path
  const artifactPathFromContext = context && context.file ? context.file : null;

  // Validate artifact path and ensure it is an NSIS installer (.exe)
  if (!artifactPathFromContext || path.extname(artifactPathFromContext).toLowerCase() !== '.exe') {
    return;
  }

  // For safety, only sign the final NSIS installer (commonly contains "Setup" in name)
  const lower = path.basename(artifactPathFromContext).toLowerCase();
  if (!lower.includes('setup')) {
    return;
  }

  const installerPath = artifactPathFromContext;
  console.log(`Signing Windows installer via SSL.com: ${installerPath}`);

  // Get environment variables
  const username = process.env.SSL_USERNAME;
  const credentialId = process.env.SSL_CREDENTIAL_ID;
  const password = process.env.SSL_PASSWORD;
  const totpSecret = process.env.SSL_TOTP_SECRET;

  if (!username || !credentialId || !password || !totpSecret) {
    console.error('Missing required SSL.com environment variables:');
    console.error(`SSL_USERNAME: ${username ? 'Set' : 'Missing'}`);
    console.error(`SSL_CREDENTIAL_ID: ${credentialId ? 'Set' : 'Missing'}`);
    console.error(`SSL_PASSWORD: ${password ? 'Set' : 'Missing'}`);
    console.error(`SSL_TOTP_SECRET: ${totpSecret ? 'Set' : 'Missing'}`);
    throw new Error('SSL.com environment variables not configured');
  }

  // Generate TOTP
  const totp = generateTOTP(totpSecret);
  console.log(`Generated TOTP: ${totp}`);

  // SSL.com CodeSignTool path
  const codeSignToolDir = 'C:\\tools\\CodeSignTool';
  const jarPath = path.join(codeSignToolDir, 'jar', 'code_sign_tool-1.3.2.jar');

  if (!fs.existsSync(jarPath)) {
    throw new Error(`CodeSignTool not found: ${jarPath}`);
  }

  // Build the signing command
  const command = [
    'java',
    '-jar',
    `"${jarPath}"`,
    'sign',
    `-username="${username}"`,
    `-credential_id="${credentialId}"`,
    `-password="${password}"`,
    `-totp_secret="${totpSecret}"`,
    `-input_file_path="${installerPath}"`,
    '-override'
  ].join(' ');

  console.log('Executing SSL.com CodeSignTool...');

  try {
    // Change to CodeSignTool directory and execute
    execSync(command, {
      cwd: codeSignToolDir,
      stdio: 'inherit',
      timeout: 120000 // 2 minute timeout
    });

    console.log('✅ Windows installer signed successfully!');
    console.log(`Signed file: ${installerPath}`);

    // Also attempt to sign NSIS uninstaller if present alongside
    const distDir = path.dirname(installerPath);
    const entries = fs.readdirSync(distDir).filter(f => f.startsWith('__uninstaller-nsis') && f.endsWith('.exe'));
    for (const name of entries) {
      const uninstallerPath = path.join(distDir, name);
      console.log(`Signing NSIS uninstaller via SSL.com: ${uninstallerPath}`);
      // Reuse the same CodeSignTool command for uninstaller
      const username = process.env.SSL_USERNAME;
      const credentialId = process.env.SSL_CREDENTIAL_ID;
      const password = process.env.SSL_PASSWORD;
      const totpSecret = process.env.SSL_TOTP_SECRET;
      const codeSignToolDir = 'C\\tools\\CodeSignTool';
      const jarPath = path.join(codeSignToolDir, 'jar', 'code_sign_tool-1.3.2.jar');
      const cmd = [
        'java', '-jar', `"${jarPath}"`, 'sign',
        `-username="${username}"`,
        `-credential_id="${credentialId}"`,
        `-password="${password}"`,
        `-totp_secret="${totpSecret}"`,
        `-input_file_path="${uninstallerPath}"`,
        '-override'
      ].join(' ');
      execSync(cmd, { cwd: codeSignToolDir, stdio: 'inherit', timeout: 120000 });
      console.log('✅ NSIS uninstaller signed successfully!');
    }

  } catch (error) {
    console.error('❌ Failed to sign Windows installer:', error.message);
    throw error;
  }
}

export default signWindowsInstaller;
