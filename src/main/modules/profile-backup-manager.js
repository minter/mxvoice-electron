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
import crypto from 'crypto';
import {
  getBackupBaseDirectory,
  getBackupDirectory,
  getBackupMetadataPath,
  getProfileDirectory
} from './profile-paths.js';
import { createBackupMetadataCoordinator } from './backup-metadata-coordinator.js';
import { createBackupMetadataStore } from './backup-metadata-store.js';
import { createBackupDirectoryScanner } from './backup-directory-scanner.js';
import { createBackupFileOperations } from './backup-file-operations.js';
import { selectBackupsForRetention } from './backup-retention-policy.js';

// Note: __dirname/__filename equivalents removed — not currently needed in this module

let debugLog = null;

// Async replacement for fs.existsSync — does not block the main process
async function pathExists(p) {
  try { await fs.promises.access(p); return true; } catch { return false; }
}

// Backup creation locks per profile to prevent duplicate backups
const backupCreationLocks = new Map();

const metadataCoordinator = createBackupMetadataCoordinator({
  fs,
  getMetadataPath: getBackupMetadataPath,
  pathExists,
  getDebugLog: () => debugLog
});
const directoryScanner = createBackupDirectoryScanner({
  fs,
  path,
  getBackupDirectory,
  getMetadataPath: getBackupMetadataPath,
  pathExists,
  writeMetadata: (metadataPath, data) => metadataCoordinator.writeAtomic(metadataPath, data),
  getDebugLog: () => debugLog
});
const backupFiles = createBackupFileOperations({ fs, path });
const metadataStore = createBackupMetadataStore({
  fs,
  getMetadataPath: getBackupMetadataPath,
  pathExists,
  coordinator: metadataCoordinator,
  rebuildMetadata: (profileName) => rebuildMetadataFromDirectories(profileName),
  getDebugLog: () => debugLog
});

/**
 * Initialize the Profile Backup Manager
 * @param {Object} dependencies - Module dependencies
 */
async function initializeProfileBackupManager(dependencies) {
  debugLog = dependencies.debugLog;
  
  debugLog?.info('Profile Backup Manager initialized', { 
    module: 'profile-backup-manager', 
    function: 'initializeProfileBackupManager' 
  });
  
  // Ensure backup directory exists
  const backupDir = getBackupBaseDirectory();
  if (!await pathExists(backupDir)) {
    await fs.promises.mkdir(backupDir, { recursive: true });
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
  return metadataCoordinator.writeAtomic(metadataPath, data);
}

/**
 * File-based lock for metadata operations
 * @param {string} profileName - Profile name
 * @param {Function} operation - Operation to execute with lock
 * @returns {Promise<any>}
 */
async function withMetadataLock(profileName, operation) {
  return metadataCoordinator.withLock(profileName, operation);
}

/**
 * Queue metadata operation to serialize access
 * @param {string} profileName - Profile name
 * @param {Function} operation - Operation to queue
 * @returns {Promise<any>}
 */
async function queueMetadataOperation(profileName, operation) {
  return metadataCoordinator.queueOperation(profileName, operation);
}

/**
 * Safe read of metadata with recovery mechanisms
 * @param {string} profileName - Profile name
 * @returns {Promise<Object>} Metadata object
 */
async function readMetadataSafe(profileName) {
  return metadataStore.readSafe(profileName);
}

/**
 * Rebuild metadata from backup directories
 * @param {string} profileName - Profile name
 * @returns {Promise<Object>} Rebuilt metadata
 */
async function rebuildMetadataFromDirectories(profileName) {
  return directoryScanner.rebuildMetadata(profileName);
}

/**
 * Calculate backup size and file count
 * @param {string} backupPath - Path to backup directory
 * @returns {Promise<{size: number, fileCount: number}>}
 */
async function calculateBackupSize(backupPath) {
  return directoryScanner.calculateSize(backupPath);
}

/**
 * Update metadata using safe read-modify-write pattern
 * @param {string} profileName - Profile name
 * @param {Function} updateFn - Function to update metadata
 * @returns {Promise<Object>} Updated metadata
 */
async function updateMetadata(profileName, updateFn) {
  return metadataStore.update(profileName, updateFn);
}

/**
 * Copy directory recursively
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @returns {Promise<void>}
 */
async function copyDirectoryRecursive(src, dest) {
  return backupFiles.copyDirectory(src, dest);
}

/**
 * Create a backup of a profile
 * @param {string} profileName - Profile name
 * @param {Object} [options] - Options for backup creation
 * @param {string} [options.mode] - Backup mode: 'manual' | 'auto' | 'pre-restore'
 * @returns {Promise<{success: boolean, backupId?: string, error?: string}>}
 */
async function createBackup(profileName, options = {}) {
  const backupMode = options.mode || 'manual';
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
    
    if (!await pathExists(profileDir)) {
      return { success: false, error: 'Profile directory does not exist' };
    }

    // Generate backup ID
    const backupId = generateBackupId();
    const backupDir = getBackupDirectory(profileName);
    const backupPath = path.join(backupDir, backupId);

    // Ensure backup directory exists (recursive mkdir is idempotent)
    await fs.promises.mkdir(backupDir, { recursive: true });
    
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
        fileCount: fileCount,
        mode: backupMode
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
    
    if (!await pathExists(backupPath)) {
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

    if (await pathExists(profileDir)) {
      await copyDirectoryRecursive(profileDir, preRestorePath);
      const { size, fileCount } = await calculateBackupSize(preRestorePath);
      
      // Add pre-restore backup to metadata (explicit mode)
      await updateMetadata(profileName, (metadata) => {
        metadata.backups.unshift({
          id: preRestoreBackupId,
          timestamp: Date.now(),
          size: size,
          fileCount: fileCount,
          mode: 'pre-restore'
        });
        metadata.backupCount = metadata.backups.length;
        return metadata;
      });
    }
    
    // Remove existing profile directory and restore from backup
    await backupFiles.removeDirectory(profileDir);
    await fs.promises.mkdir(profileDir, { recursive: true });
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
    
    if (!await pathExists(backupPath)) {
      return { success: false, error: 'Backup does not exist' };
    }

    // Remove backup directory
    await backupFiles.removeDirectory(backupPath);
    
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
    const { keep: backupsToKeep, remove: backupsToDelete } = selectBackupsForRetention(
      metadata.backups,
      { maxCount, maxAge }
    );
    
    // Delete old backups
    const backupDir = getBackupDirectory(profileName);
    let deletedCount = 0;
    
    for (const backup of backupsToDelete) {
      const backupPath = path.join(backupDir, backup.id);
      if (await pathExists(backupPath)) {
        await backupFiles.removeDirectory(backupPath);
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
    
    if (!await pathExists(profileDir)) {
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
    
    // Create backup (auto mode)
    const result = await createBackup(profileName, { mode: 'auto' });
    
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
