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

export default async function signFile(filePath, options) {
  // electron-builder passes an object with the file path, not just the string
  // Handle both cases for compatibility
  const actualFilePath = typeof filePath === 'string' ? filePath : filePath.path || filePath.file;

  if (!actualFilePath) {
    console.warn('⚠️ No valid file path provided for signing');
    return;
  }

  // Only handle Windows artifacts
  if (process.platform !== 'win32') {
    return;
  }

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

  // Log pre-signing file info
  try {
    const preSignStats = fs.statSync(actualFilePath);
    const preSignBuffer = fs.readFileSync(actualFilePath);
    const preSignSha512 = crypto.createHash('sha512').update(preSignBuffer).digest('base64');     
    console.log(`📁 Pre-signing file info: size=${preSignStats.size}, sha512=${preSignSha512.slice(0,8)}...`);
  } catch (preSignErr) {
    console.warn('⚠️ Could not read pre-signing file info:', preSignErr?.message || preSignErr);  
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
    `-input_file_path="${actualFilePath}"`,
    '-override'
  ].join(' ');

  console.log(`Signing file via SSL.com: ${actualFilePath}`);
  console.log('Executing SSL.com CodeSignTool...');

  try {
    // Change to CodeSignTool directory and execute
    execSync(command, {
      cwd: codeSignToolDir,
      stdio: 'inherit',
      timeout: 120000 // 2 minute timeout
    });

    console.log('✅ File signed successfully!');
    console.log(`Signed file: ${actualFilePath}`);

    // Log post-signing file info for comparison
    try {
      const postSignStats = fs.statSync(actualFilePath);
      const postSignBuffer = fs.readFileSync(actualFilePath);
      const postSignSha512 = crypto.createHash('sha512').update(postSignBuffer).digest('base64'); 
      console.log(`📁 Post-signing file info: size=${postSignStats.size}, sha512=${postSignSha512.slice(0,8)}...`);
    } catch (postSignErr) {
      console.warn('⚠️ Could not read post-signing file info:', postSignErr?.message || postSignErr);
    }

  } catch (error) {
    console.error('❌ Failed to sign file:', error.message);
    throw error;
  }
}
