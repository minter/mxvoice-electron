// build/winSignInstaller.cjs
const signOne = require("./sslSign.cjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = async function artifactBuildCompleted(context) {
  console.log(`[artifactBuildCompleted] 🔍 Hook called with context:`, {
    platform: process.platform,
    file: context?.file,
    target: context?.target?.name,
    hasFile: !!context?.file,
    hasTarget: !!context?.target
  });

  if (process.platform !== "win32") {
    console.log(`[artifactBuildCompleted] ⏭️ Skipping - not Windows platform`);
    return;
  }
  
  const { file, target } = context;
  if (!file) {
    console.log(`[artifactBuildCompleted] ⏭️ Skipping - no file provided`);
    return;
  }

  const t = target?.name;
  const isWinInstaller = file.toLowerCase().endsWith(".exe") &&
    (t === "nsis" || t === "squirrel" || t === "portable");

  console.log(`[artifactBuildCompleted] 📋 Installer check:`, {
    file: file,
    target: t,
    isExe: file.toLowerCase().endsWith(".exe"),
    isWinInstaller: isWinInstaller
  });

  if (!isWinInstaller) {
    console.log(`[artifactBuildCompleted] ⏭️ Skipping - not a Windows installer`);
    return;
  }

  console.log(`[artifactBuildCompleted] 🚀 Starting installer signing process for: ${file}`);
  
  // Check if file exists and is readable
  if (!fs.existsSync(file)) {
    console.error(`[artifactBuildCompleted] ❌ File does not exist: ${file}`);
    return;
  }

  try {
    // Get file stats before signing
    const beforeStats = fs.statSync(file);
    console.log(`[artifactBuildCompleted] 📁 File stats before signing:`, {
      size: beforeStats.size,
      exists: true,
      readable: true
    });

    // Sign the installer
    console.log(`[artifactBuildCompleted] ✍️ Signing installer...`);
    await signOne(file, context);
    
    // Wait a moment for file system to settle
    console.log(`[artifactBuildCompleted] ⏳ Waiting for file system to settle...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check file stats after signing
    const afterStats = fs.statSync(file);
    console.log(`[artifactBuildCompleted] 📁 File stats after signing:`, {
      size: afterStats.size,
      exists: true,
      readable: true,
      sizeChanged: afterStats.size !== beforeStats.size
    });
    
    // After signing, regenerate the latest.yml file with correct checksums
    console.log(`[artifactBuildCompleted] 🔄 Regenerating latest.yml with correct checksums`);
    await regenerateLatestYml(file, context);
    
  } catch (error) {
    console.error(`[artifactBuildCompleted] ❌ Error during signing process:`, error.message);
    console.error(`[artifactBuildCompleted] Stack trace:`, error.stack);
  }
};

async function regenerateLatestYml(installerPath, context) {
  try {
    console.log(`[regenerateLatestYml] 🔍 Starting checksum regeneration for: ${installerPath}`);
    
    // Verify file still exists and is readable
    if (!fs.existsSync(installerPath)) {
      console.error(`[regenerateLatestYml] ❌ Installer file no longer exists: ${installerPath}`);
      return;
    }

    // Read the installer file and calculate its SHA512 hash
    console.log(`[regenerateLatestYml] 📖 Reading installer file...`);
    const installerBuffer = fs.readFileSync(installerPath);
    const installerHash = crypto.createHash('sha512').update(installerBuffer).digest('base64');
    const installerSize = installerBuffer.length;
    
    console.log(`[regenerateLatestYml] 📊 Calculated checksums:`, {
      size: installerSize,
      hash: installerHash.substring(0, 32) + '...'
    });
    
    // Get the installer filename
    const installerName = path.basename(installerPath);
    
    // Read the existing latest.yml
    const latestYmlPath = path.join(path.dirname(installerPath), 'latest.yml');
    console.log(`[regenerateLatestYml] 📍 Looking for latest.yml at: ${latestYmlPath}`);
    
    if (!fs.existsSync(latestYmlPath)) {
      console.warn(`[regenerateLatestYml] ⚠️ latest.yml not found at ${latestYmlPath}`);
      return;
    }
    
    console.log(`[regenerateLatestYml] 📖 Reading latest.yml...`);
    let latestYml = fs.readFileSync(latestYmlPath, 'utf8');
    console.log(`[regenerateLatestYml] 📄 Current latest.yml content (first 200 chars):`, latestYml.substring(0, 200));
    
    // Update the checksums in the latest.yml file
    // Replace the old hash with the new one
    const oldHashPattern = /sha512:\s*[A-Za-z0-9+/=]+/g;
    const newHash = `sha512: ${installerHash}`;
    
    // Count how many hash entries we need to replace
    const hashMatches = latestYml.match(oldHashPattern);
    console.log(`[regenerateLatestYml] 🔍 Found ${hashMatches ? hashMatches.length : 0} hash patterns to replace`);
    
    if (hashMatches && hashMatches.length > 0) {
      console.log(`[regenerateLatestYml] 🔍 Old hashes found:`, hashMatches.map(h => h.substring(0, 32) + '...'));
      
      // Replace all hash entries
      const beforeReplacement = latestYml;
      latestYml = latestYml.replace(oldHashPattern, newHash);
      
      // Also update the size if it changed
      const sizePattern = /size:\s*\d+/g;
      const newSize = `size: ${installerSize}`;
      latestYml = latestYml.replace(sizePattern, newSize);
      
      // Check if anything actually changed
      if (beforeReplacement === latestYml) {
        console.warn(`[regenerateLatestYml] ⚠️ No changes made to latest.yml content`);
      } else {
        console.log(`[regenerateLatestYml] ✏️ Content updated, writing to file...`);
        
        // Write the updated latest.yml
        fs.writeFileSync(latestYmlPath, latestYml, 'utf8');
        
        console.log(`[regenerateLatestYml] ✅ Updated latest.yml with correct checksums:`);
        console.log(`[regenerateLatestYml]   File: ${installerName}`);
        console.log(`[regenerateLatestYml]   Size: ${installerSize}`);
        console.log(`[regenerateLatestYml]   SHA512: ${installerHash.substring(0, 32)}...`);
        
        // Verify the file was written
        const verifyContent = fs.readFileSync(latestYmlPath, 'utf8');
        console.log(`[regenerateLatestYml] ✅ Verification - latest.yml updated successfully`);
      }
    } else {
      console.warn(`[regenerateLatestYml] ⚠️ No hash patterns found in latest.yml`);
      console.log(`[regenerateLatestYml] 📄 Full latest.yml content:`, latestYml);
    }
    
  } catch (error) {
    console.error(`[regenerateLatestYml] ❌ Failed to regenerate latest.yml:`, error.message);
    console.error(`[regenerateLatestYml] Stack trace:`, error.stack);
    // Don't throw - this is not critical for the build
  }
}
