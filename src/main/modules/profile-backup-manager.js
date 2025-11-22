/**
 * Profile Backup Manager Module
 * 
 * Handles automatic and manual backups of user profiles with restore functionality.
 * Includes comprehensive safety mechanisms to prevent metadata corruption and race conditions.
 * 
 * Architecture:
 * - Backups stored in userData/profile-backups/{profileName}/
 * - Each backup is a timestamped snapshot of the profile directory
 * - Metadata tracked in backup-metadata.json with atomic write operations
 * - Automatic cleanup based on count and age limits
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import electron from 'electron';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Destructure app from electron (handles both named and default exports)
const { app } = electron;

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let debugLog = null;

// Operation queue per profile to serialize metadata operations
const metadataOperationQueue = new Map();

// Backup creation locks per profile to prevent duplicate backups
const backupCreationLocks = new Map();

/**
 * Initialize the Profile Backup Manager
 * @param {Object} dependencies - Module dependencies
 */
function initializeProfileBackupManager(dependencies) {
  debugLog = dependencies.debugLog;
  
  debugLog?.info('Profile Backup Manager initialized', { 
    module: 'profile-backup-manager', 
    function: 'initializeProfileBackupManager' 
  });
  
  // Ensure backup directory exists
  const backupDir = getBackupBaseDirectory();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    debugLog?.info('Created backup base directory', { 
      module: 'profile-backup-manager',
      path: backupDir 
    });
  }
}

/**
 * Get the base backup directory path
 * @returns {string} Path to profile-backups directory
 */
function getBackupBaseDirectory() {
  return path.join(app.getPath('userData'), 'profile-backups');
}

/**
 * Get the backup directory for a specific profile
 * @param {string} profileName - Profile name
 * @returns {string} Path to profile's backup directory
 */
function getBackupDirectory(profileName) {
  const sanitizedName = sanitizeProfileName(profileName);
  return path.join(getBackupBaseDirectory(), sanitizedName);
}

/**
 * Get the backup metadata file path for a profile
 * @param {string} profileName - Profile name
 * @returns {string} Path to backup-metadata.json
 */
function getBackupMetadataPath(profileName) {
  return path.join(getBackupDirectory(profileName), 'backup-metadata.json');
}

/**
 * Sanitize profile name for filesystem safety
 * @param {string} name - Profile name
 * @returns {string} Sanitized name
 */
function sanitizeProfileName(name) {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
}

/**
 * Generate backup ID from timestamp
 * @returns {string} Backup ID in format backup-YYYY-MM-DDTHH-MM-SS-sssZ
 */
function generateBackupId() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(now.getUTCMilliseconds()).padStart(3, '0');
  
  return `backup-${year}-${month}-${day}T${hours}-${minutes}-${seconds}-${milliseconds}Z`;
}

/**
 * Atomic write operation for metadata file
 * @param {string} metadataPath - Path to metadata file
 * @param {Object} data - Data to write
 * @returns {Promise<void>}
 */
async function writeMetadataAtomic(metadataPath, data) {
  const tempPath = metadataPath + '.tmp';
  
  try {
    // Write to temp file
    await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    
    // Verify temp file exists and is readable
    await fs.promises.access(tempPath, fs.constants.F_OK | fs.constants.R_OK);
    
    // Atomic rename (this is atomic on most filesystems)
    await fs.promises.rename(tempPath, metadataPath);
    
    // Verify final file exists
    await fs.promises.access(metadataPath, fs.constants.F_OK | fs.constants.R_OK);
    
    debugLog?.debug('Metadata written atomically', {
      module: 'profile-backup-manager',
      function: 'writeMetadataAtomic',
      metadataPath
    });
  } catch (error) {
    // Cleanup temp file on failure
    try {
      await fs.promises.unlink(tempPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * File-based lock for metadata operations
 * @param {string} profileName - Profile name
 * @param {Function} operation - Operation to execute with lock
 * @returns {Promise<any>}
 */
async function withMetadataLock(profileName, operation) {
  const lockPath = getBackupMetadataPath(profileName) + '.lock';
  const maxWait = 5000; // 5 seconds max wait
  const checkInterval = 100; // Check every 100ms
  const startTime = Date.now();
  
  // Wait for lock to be released
  while (fs.existsSync(lockPath)) {
    if (Date.now() - startTime > maxWait) {
      throw new Error('Timeout waiting for metadata lock');
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  // Create lock file
  try {
    await fs.promises.writeFile(lockPath, process.pid.toString(), 'utf8');
    
    try {
      // Execute operation
      return await operation();
    } finally {
      // Always remove lock
      try {
        await fs.promises.unlink(lockPath);
      } catch (error) {
        // Log but don't throw - lock cleanup failure is non-critical
        debugLog?.warn('Failed to remove metadata lock', { 
          module: 'profile-backup-manager',
          function: 'withMetadataLock',
          error: error.message 
        });
      }
    }
  } catch (error) {
    // Remove lock on error
    try {
      await fs.promises.unlink(lockPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Queue metadata operation to serialize access
 * @param {string} profileName - Profile name
 * @param {Function} operation - Operation to queue
 * @returns {Promise<any>}
 */
async function queueMetadataOperation(profileName, operation) {
  if (!metadataOperationQueue.has(profileName)) {
    metadataOperationQueue.set(profileName, []);
  }
  
  const queue = metadataOperationQueue.get(profileName);
  
  return new Promise((resolve, reject) => {
    queue.push({ operation, resolve, reject });
    
    // Process queue if this is the first item
    if (queue.length === 1) {
      processMetadataQueue(profileName);
    }
  });
}

/**
 * Process metadata operation queue
 * @param {string} profileName - Profile name
 */
async function processMetadataQueue(profileName) {
  const queue = metadataOperationQueue.get(profileName);
  
  while (queue.length > 0) {
    const { operation, resolve, reject } = queue[0];
    
    try {
      const result = await withMetadataLock(profileName, operation);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      queue.shift();
    }
  }
  
  // Clean up empty queue
  if (queue.length === 0) {
    metadataOperationQueue.delete(profileName);
  }
}

/**
 * Safe read of metadata with recovery mechanisms
 * @param {string} profileName - Profile name
 * @returns {Promise<Object>} Metadata object
 */
async function readMetadataSafe(profileName) {
  const metadataPath = getBackupMetadataPath(profileName);
  const backupPath = metadataPath + '.bak';
  
  try {
    // Try to read primary file
    const data = await fs.promises.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(data);
    
    // Validate structure
    if (!metadata.backups || !Array.isArray(metadata.backups)) {
      throw new Error('Invalid metadata structure');
    }
    
    // Backup is valid, create/update .bak file
    await fs.promises.writeFile(backupPath, data, 'utf8');
    
    return metadata;
  } catch (error) {
    // Primary file is corrupted or missing, try backup
    if (fs.existsSync(backupPath)) {
      try {
        const backupData = await fs.promises.readFile(backupPath, 'utf8');
        const metadata = JSON.parse(backupData);
        
        // Validate backup structure
        if (!metadata.backups || !Array.isArray(metadata.backups)) {
          throw new Error('Backup metadata also corrupted');
        }
        
        // Restore from backup
        await fs.promises.writeFile(metadataPath, backupData, 'utf8');
        debugLog?.warn('Restored metadata from backup file', { 
          module: 'profile-backup-manager',
          function: 'readMetadataSafe',
          profileName 
        });
        
        return metadata;
      } catch (backupError) {
        debugLog?.error('Both metadata and backup are corrupted', { 
          module: 'profile-backup-manager',
          function: 'readMetadataSafe',
          profileName, 
          error: backupError.message 
        });
      }
    }
    
    // Last resort: rebuild from backup directories
    debugLog?.warn('Rebuilding metadata from backup directories', { 
      module: 'profile-backup-manager',
      function: 'readMetadataSafe',
      profileName 
    });
    return await rebuildMetadataFromDirectories(profileName);
  }
}

/**
 * Rebuild metadata from backup directories
 * @param {string} profileName - Profile name
 * @returns {Promise<Object>} Rebuilt metadata
 */
async function rebuildMetadataFromDirectories(profileName) {
  const backupDir = getBackupDirectory(profileName);
  const metadata = {
    profileName: profileName,
    backups: [],
    lastBackup: null,
    backupCount: 0
  };
  
  if (!fs.existsSync(backupDir)) {
    return metadata;
  }
  
  try {
    const entries = await fs.promises.readdir(backupDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('backup-')) {
        const backupPath = path.join(backupDir, entry.name);
        const stats = await fs.promises.stat(backupPath);
        
        // Extract timestamp from backup ID
        const timestampMatch = entry.name.match(/backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/);
        let timestamp = stats.mtimeMs;
        
        if (timestampMatch) {
          const [, year, month, day, hours, minutes, seconds, milliseconds] = timestampMatch;
          const date = new Date(Date.UTC(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hours),
            parseInt(minutes),
            parseInt(seconds),
            parseInt(milliseconds)
          ));
          timestamp = date.getTime();
        }
        
        // Calculate size and file count
        const { size, fileCount } = await calculateBackupSize(backupPath);
        
        metadata.backups.push({
          id: entry.name,
          timestamp: timestamp,
          size: size,
          fileCount: fileCount
        });
      }
    }
    
    // Sort by timestamp (newest first)
    metadata.backups.sort((a, b) => b.timestamp - a.timestamp);
    metadata.backupCount = metadata.backups.length;
    metadata.lastBackup = metadata.backups.length > 0 ? metadata.backups[0].timestamp : null;
    
    // Save rebuilt metadata
    const metadataPath = getBackupMetadataPath(profileName);
    await writeMetadataAtomic(metadataPath, metadata);
    
    debugLog?.info('Rebuilt metadata from directories', {
      module: 'profile-backup-manager',
      function: 'rebuildMetadataFromDirectories',
      profileName,
      backupCount: metadata.backupCount
    });
    
    return metadata;
  } catch (error) {
    debugLog?.error('Failed to rebuild metadata', {
      module: 'profile-backup-manager',
      function: 'rebuildMetadataFromDirectories',
      profileName,
      error: error.message
    });
    return metadata;
  }
}

/**
 * Calculate backup size and file count
 * @param {string} backupPath - Path to backup directory
 * @returns {Promise<{size: number, fileCount: number}>}
 */
async function calculateBackupSize(backupPath) {
  let totalSize = 0;
  let fileCount = 0;
  
  async function calculateRecursive(dirPath) {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await calculateRecursive(entryPath);
      } else {
        const stats = await fs.promises.stat(entryPath);
        totalSize += stats.size;
        fileCount++;
      }
    }
  }
  
  await calculateRecursive(backupPath);
  
  return { size: totalSize, fileCount };
}

/**
 * Update metadata using safe read-modify-write pattern
 * @param {string} profileName - Profile name
 * @param {Function} updateFn - Function to update metadata
 * @returns {Promise<Object>} Updated metadata
 */
async function updateMetadata(profileName, updateFn) {
  return queueMetadataOperation(profileName, async () => {
    let retries = 3;
    
    while (retries > 0) {
      try {
        // Read current metadata
        const metadata = await readMetadataSafe(profileName);
        
        // Apply update function
        const updated = updateFn(metadata);
        
        // Validate updated metadata
        if (!updated.backups || !Array.isArray(updated.backups)) {
          throw new Error('Updated metadata has invalid structure');
        }
        
        // Atomic write
        const metadataPath = getBackupMetadataPath(profileName);
        const backupPath = metadataPath + '.bak';
        
        // Create backup before write
        if (fs.existsSync(metadataPath)) {
          const currentData = await fs.promises.readFile(metadataPath, 'utf8');
          await fs.promises.writeFile(backupPath, currentData, 'utf8');
        }
        
        await writeMetadataAtomic(metadataPath, updated);
        
        return updated;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to update metadata after retries: ${error.message}`);
        }
        
        // Exponential backoff on retry
        await new Promise(resolve => setTimeout(resolve, 100 * (4 - retries)));
      }
    }
  });
}

/**
 * Copy directory recursively
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @returns {Promise<void>}
 */
async function copyDirectoryRecursive(src, dest) {
  // Ensure destination directory exists
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = await promisify(fs.readdir)(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectoryRecursive(srcPath, destPath);
    } else {
      await promisify(fs.copyFile)(srcPath, destPath);
    }
  }
}

/**
 * Get profile directory path (import from profile-manager or use direct path)
 * @param {string} profileName - Profile name
 * @returns {string} Profile directory path
 */
function getProfileDirectory(profileName) {
  const sanitizedName = sanitizeProfileName(profileName);
  return path.join(app.getPath('userData'), 'profiles', sanitizedName);
}

/**
 * Create a backup of a profile
 * @param {string} profileName - Profile name
 * @returns {Promise<{success: boolean, backupId?: string, error?: string}>}
 */
async function createBackup(profileName) {
  // Check if backup creation is already in progress for this profile
  if (backupCreationLocks.has(profileName)) {
    debugLog?.warn('Backup creation already in progress for profile', {
      module: 'profile-backup-manager',
      function: 'createBackup',
      profileName
    });
    return { success: false, error: 'Backup creation already in progress' };
  }
  
  // Set lock
  backupCreationLocks.set(profileName, true);
  
  try {
    const profileDir = getProfileDirectory(profileName);
    
    if (!fs.existsSync(profileDir)) {
      return { success: false, error: 'Profile directory does not exist' };
    }
    
    // Generate backup ID
    const backupId = generateBackupId();
    const backupDir = getBackupDirectory(profileName);
    const backupPath = path.join(backupDir, backupId);
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    debugLog?.info('Creating backup', {
      module: 'profile-backup-manager',
      function: 'createBackup',
      profileName,
      backupId,
      profileDir,
      backupPath
    });
    
    // Copy profile directory to backup location
    await copyDirectoryRecursive(profileDir, backupPath);
    
    // Calculate backup size and file count
    const { size, fileCount } = await calculateBackupSize(backupPath);
    
    // Calculate and store hash for change detection
    const profileHash = await calculateProfileHash(profileName);
    
    // Update metadata atomically
    await updateMetadata(profileName, (metadata) => {
      // Add new backup
      metadata.backups.unshift({
        id: backupId,
        timestamp: Date.now(),
        size: size,
        fileCount: fileCount
      });
      
      // Update counts and hash
      metadata.backupCount = metadata.backups.length;
      metadata.lastBackup = Date.now();
      metadata.profileName = profileName;
      if (profileHash) {
        metadata.lastBackupHash = profileHash;
      }
      
      return metadata;
    });
    
    debugLog?.info('Backup created successfully', {
      module: 'profile-backup-manager',
      function: 'createBackup',
      profileName,
      backupId,
      size,
      fileCount
    });
    
    return { success: true, backupId };
  } catch (error) {
    debugLog?.error('Failed to create backup', {
      module: 'profile-backup-manager',
      function: 'createBackup',
      profileName,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  } finally {
    // Release lock
    backupCreationLocks.delete(profileName);
  }
}

/**
 * List all backups for a profile
 * @param {string} profileName - Profile name
 * @returns {Promise<{success: boolean, backups?: Array, error?: string}>}
 */
async function listBackups(profileName) {
  try {
    const metadata = await readMetadataSafe(profileName);
    
    return {
      success: true,
      backups: metadata.backups || []
    };
  } catch (error) {
    debugLog?.error('Failed to list backups', {
      module: 'profile-backup-manager',
      function: 'listBackups',
      profileName,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Get backup metadata
 * @param {string} profileName - Profile name
 * @returns {Promise<{success: boolean, metadata?: Object, error?: string}>}
 */
async function getBackupMetadata(profileName) {
  try {
    const metadata = await readMetadataSafe(profileName);
    
    return {
      success: true,
      metadata: metadata
    };
  } catch (error) {
    debugLog?.error('Failed to get backup metadata', {
      module: 'profile-backup-manager',
      function: 'getBackupMetadata',
      profileName,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Restore a profile from a backup
 * @param {string} profileName - Profile name
 * @param {string} backupId - Backup ID to restore from
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function restoreBackup(profileName, backupId) {
  try {
    const backupDir = getBackupDirectory(profileName);
    const backupPath = path.join(backupDir, backupId);
    const profileDir = getProfileDirectory(profileName);
    
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup does not exist' };
    }
    
    debugLog?.info('Restoring backup', {
      module: 'profile-backup-manager',
      function: 'restoreBackup',
      profileName,
      backupId,
      backupPath,
      profileDir
    });
    
    // Create pre-restore backup first (safety measure)
    const preRestoreBackupId = `pre-restore-${generateBackupId()}`;
    const preRestorePath = path.join(backupDir, preRestoreBackupId);
    
    if (fs.existsSync(profileDir)) {
      await copyDirectoryRecursive(profileDir, preRestorePath);
      const { size, fileCount } = await calculateBackupSize(preRestorePath);
      
      // Add pre-restore backup to metadata
      await updateMetadata(profileName, (metadata) => {
        metadata.backups.unshift({
          id: preRestoreBackupId,
          timestamp: Date.now(),
          size: size,
          fileCount: fileCount
        });
        metadata.backupCount = metadata.backups.length;
        return metadata;
      });
    }
    
    // Remove existing profile directory
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
    
    // Restore from backup
    fs.mkdirSync(profileDir, { recursive: true });
    await copyDirectoryRecursive(backupPath, profileDir);
    
    debugLog?.info('Backup restored successfully', {
      module: 'profile-backup-manager',
      function: 'restoreBackup',
      profileName,
      backupId,
      preRestoreBackupId
    });
    
    return { success: true };
  } catch (error) {
    debugLog?.error('Failed to restore backup', {
      module: 'profile-backup-manager',
      function: 'restoreBackup',
      profileName,
      backupId,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

/**
 * Delete a backup
 * @param {string} profileName - Profile name
 * @param {string} backupId - Backup ID to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteBackup(profileName, backupId) {
  try {
    const backupDir = getBackupDirectory(profileName);
    const backupPath = path.join(backupDir, backupId);
    
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup does not exist' };
    }
    
    // Remove backup directory
    fs.rmSync(backupPath, { recursive: true, force: true });
    
    // Update metadata
    await updateMetadata(profileName, (metadata) => {
      metadata.backups = metadata.backups.filter(b => b.id !== backupId);
      metadata.backupCount = metadata.backups.length;
      if (metadata.backups.length > 0) {
        metadata.lastBackup = metadata.backups[0].timestamp;
      } else {
        metadata.lastBackup = null;
      }
      return metadata;
    });
    
    debugLog?.info('Backup deleted successfully', {
      module: 'profile-backup-manager',
      function: 'deleteBackup',
      profileName,
      backupId
    });
    
    return { success: true };
  } catch (error) {
    debugLog?.error('Failed to delete backup', {
      module: 'profile-backup-manager',
      function: 'deleteBackup',
      profileName,
      backupId,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Clean up old backups based on count and age limits
 * @param {string} profileName - Profile name
 * @param {number} maxCount - Maximum number of backups to keep
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {Promise<{success: boolean, deletedCount?: number, error?: string}>}
 */
async function cleanupOldBackups(profileName, maxCount, maxAge) {
  try {
    const metadata = await readMetadataSafe(profileName);
    const now = Date.now();
    
    // Filter backups by age and sort by timestamp (newest first)
    const backupsToKeep = metadata.backups
      .filter(backup => {
        return (now - backup.timestamp) <= maxAge;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxCount);
    
    const backupsToDelete = metadata.backups.filter(backup => {
      return !backupsToKeep.find(b => b.id === backup.id);
    });
    
    // Delete old backups
    const backupDir = getBackupDirectory(profileName);
    let deletedCount = 0;
    
    for (const backup of backupsToDelete) {
      const backupPath = path.join(backupDir, backup.id);
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
        deletedCount++;
      }
    }
    
    // Update metadata
    await updateMetadata(profileName, (metadata) => {
      metadata.backups = backupsToKeep;
      metadata.backupCount = backupsToKeep.length;
      if (backupsToKeep.length > 0) {
        metadata.lastBackup = backupsToKeep[0].timestamp;
      } else {
        metadata.lastBackup = null;
      }
      return metadata;
    });
    
    debugLog?.info('Cleanup completed', {
      module: 'profile-backup-manager',
      function: 'cleanupOldBackups',
      profileName,
      deletedCount,
      remainingCount: backupsToKeep.length
    });
    
    return { success: true, deletedCount };
  } catch (error) {
    debugLog?.error('Failed to cleanup old backups', {
      module: 'profile-backup-manager',
      function: 'cleanupOldBackups',
      profileName,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Calculate hash of profile directory for change detection
 * @param {string} profileName - Profile name
 * @returns {Promise<string>} Hash of profile contents
 */
async function calculateProfileHash(profileName) {
  try {
    const profileDir = getProfileDirectory(profileName);
    
    if (!fs.existsSync(profileDir)) {
      return null;
    }
    
    const hash = crypto.createHash('sha256');
    
    async function hashDirectory(dirPath) {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      // Sort entries for consistent hashing
      entries.sort((a, b) => a.name.localeCompare(b.name));
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        
        // Skip backup directories and temp files
        if (entry.name.startsWith('.') || entry.name.includes('backup')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await hashDirectory(entryPath);
        } else {
          const stats = await fs.promises.stat(entryPath);
          const content = await fs.promises.readFile(entryPath);
          
          // Include file path, size, and content in hash
          hash.update(entryPath);
          hash.update(stats.size.toString());
          hash.update(stats.mtimeMs.toString());
          hash.update(content);
        }
      }
    }
    
    await hashDirectory(profileDir);
    
    return hash.digest('hex');
  } catch (error) {
    debugLog?.error('Failed to calculate profile hash', {
      module: 'profile-backup-manager',
      function: 'calculateProfileHash',
      profileName,
      error: error.message
    });
    return null;
  }
}

/**
 * Check if profile has changed since last backup
 * @param {string} profileName - Profile name
 * @returns {Promise<{changed: boolean, currentHash?: string, lastHash?: string}>}
 */
async function hasProfileChanged(profileName) {
  try {
    const currentHash = await calculateProfileHash(profileName);
    
    if (!currentHash) {
      return { changed: true }; // If we can't calculate hash, assume changed
    }
    
    const metadata = await readMetadataSafe(profileName);
    const lastHash = metadata.lastBackupHash || null;
    
    if (!lastHash) {
      return { changed: true, currentHash }; // No previous backup
    }
    
    return {
      changed: currentHash !== lastHash,
      currentHash,
      lastHash
    };
  } catch (error) {
    debugLog?.error('Failed to check profile changes', {
      module: 'profile-backup-manager',
      function: 'hasProfileChanged',
      profileName,
      error: error.message
    });
    return { changed: true }; // On error, assume changed
  }
}

/**
 * Create backup with change detection and cleanup
 * @param {string} profileName - Profile name
 * @param {Object} settings - Backup settings
 * @returns {Promise<{success: boolean, backupId?: string, created?: boolean, error?: string}>}
 */
async function createBackupIfChanged(profileName, settings = {}) {
  try {
    // Check if auto-backup is enabled
    if (settings.autoBackupEnabled === false) {
      return { success: true, created: false, reason: 'auto-backup disabled' };
    }
    
    // Check if profile has changed
    const changeCheck = await hasProfileChanged(profileName);
    
    if (!changeCheck.changed) {
      debugLog?.debug('Profile unchanged, skipping backup', {
        module: 'profile-backup-manager',
        function: 'createBackupIfChanged',
        profileName
      });
      return { success: true, created: false, reason: 'no changes' };
    }
    
    // Create backup
    const result = await createBackup(profileName);
    
    if (result.success && result.backupId) {
      // Update metadata with new hash
      await updateMetadata(profileName, (metadata) => {
        metadata.lastBackupHash = changeCheck.currentHash;
        return metadata;
      });
      
      // Run cleanup if settings provided
      if (settings.maxBackupCount && settings.maxBackupAge) {
        await cleanupOldBackups(profileName, settings.maxBackupCount, settings.maxBackupAge);
      }
    }
    
    return { ...result, created: result.success };
  } catch (error) {
    debugLog?.error('Failed to create backup with change detection', {
      module: 'profile-backup-manager',
      function: 'createBackupIfChanged',
      profileName,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

export {
  initializeProfileBackupManager,
  createBackup,
  listBackups,
  getBackupMetadata,
  restoreBackup,
  deleteBackup,
  cleanupOldBackups,
  getBackupDirectory,
  readMetadataSafe,
  writeMetadataAtomic,
  withMetadataLock,
  queueMetadataOperation,
  rebuildMetadataFromDirectories,
  calculateProfileHash,
  hasProfileChanged,
  createBackupIfChanged
};

