const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

async function signWindowsInstaller() {
  // Determine project and dist directory
  const projectDir = process.cwd();
  const distDir = path.join(projectDir, 'dist');

  // Find the most recent Windows installer .exe in dist/
  const files = fs.readdirSync(distDir)
    .filter(f => f.endsWith('.exe') && f.toLowerCase().includes('setup'))
    .map(f => ({
      name: f,
      time: fs.statSync(path.join(distDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.log('No Windows installer (.exe) found in dist/. Skipping Windows signing.');
    return;
  }

  const installerName = files[0].name;
  const installerPath = path.join(distDir, installerName);

  console.log(`Found installer: ${installerPath}`);

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
  console.log(`Command: ${command.replace(/-password="[^"]*"/, '-password="***"').replace(/-totp_secret="[^"]*"/, '-totp_secret="***"')}`);

  try {
    // Change to CodeSignTool directory and execute
    execSync(command, {
      cwd: codeSignToolDir,
      stdio: 'inherit',
      timeout: 120000 // 2 minute timeout
    });

    console.log('✅ Windows installer signed successfully!');
    console.log(`Signed file: ${installerPath}`);

  } catch (error) {
    console.error('❌ Failed to sign Windows installer:', error.message);
    throw error;
  }
}

module.exports = signWindowsInstaller;
