/**
 * Auto-Backup Timer Module
 * 
 * Manages automatic backup scheduling with change detection.
 * Creates backups at configured intervals only when profile data has changed.
 */

import * as profileManager from './profile-manager.js';
import * as profileBackupManager from './profile-backup-manager.js';

let debugLog = null;
let backupTimer = null;
let currentProfile = null;

/**
 * Initialize the Auto-Backup Timer
 * @param {Object} dependencies - Module dependencies
 */
function initializeAutoBackupTimer(dependencies) {
  debugLog = dependencies.debugLog;
  
  debugLog?.info('Auto-Backup Timer initialized', { 
    module: 'auto-backup-timer', 
    function: 'initializeAutoBackupTimer' 
  });
}

/**
 * Start auto-backup timer for a profile
 * @param {string} profileName - Profile name
 */
async function startAutoBackupTimer(profileName) {
  // Clear any existing timer
  stopAutoBackupTimer();
  
  currentProfile = profileName;
  
  // Load backup settings
  const preferences = await profileManager.loadProfilePreferences(profileName);
  const settings = preferences?.backup_settings || {
    autoBackupEnabled: true,
    backupInterval: 30 * 60 * 1000, // 30 minutes default
    maxBackupCount: 25,
    maxBackupAge: 30 * 24 * 60 * 60 * 1000 // 30 days default
  };
  
  if (!settings.autoBackupEnabled) {
    debugLog?.info('Auto-backup disabled for profile', {
      module: 'auto-backup-timer',
      function: 'startAutoBackupTimer',
      profileName
    });
    return;
  }
  
  const interval = settings.backupInterval || 30 * 60 * 1000;
  
  debugLog?.info('Starting auto-backup timer', {
    module: 'auto-backup-timer',
    function: 'startAutoBackupTimer',
    profileName,
    intervalMs: interval,
    intervalMinutes: Math.round(interval / 60000)
  });
  
  // Schedule first backup check
  scheduleNextBackup(profileName, settings, interval);
}

/**
 * Schedule the next backup
 * @param {string} profileName - Profile name
 * @param {Object} settings - Backup settings
 * @param {number} interval - Interval in milliseconds
 */
function scheduleNextBackup(profileName, settings, interval) {
  backupTimer = setTimeout(async () => {
    try {
      debugLog?.info('Auto-backup timer triggered', {
        module: 'auto-backup-timer',
        function: 'scheduleNextBackup',
        profileName
      });
      
      // Create backup if changed (auto mode)
      const result = await profileBackupManager.createBackupIfChanged(profileName, settings);
      
      if (result.created) {
        debugLog?.info('Auto-backup created', {
          module: 'auto-backup-timer',
          function: 'scheduleNextBackup',
          profileName,
          backupId: result.backupId
        });
      } else {
        debugLog?.debug('Auto-backup skipped', {
          module: 'auto-backup-timer',
          function: 'scheduleNextBackup',
          profileName,
          reason: result.reason
        });
      }
      
      // Schedule next backup
      if (currentProfile === profileName) {
        scheduleNextBackup(profileName, settings, interval);
      }
    } catch (error) {
      debugLog?.error('Auto-backup timer error', {
        module: 'auto-backup-timer',
        function: 'scheduleNextBackup',
        profileName,
        error: error.message
      });
      
      // Continue scheduling even on error
      if (currentProfile === profileName) {
        scheduleNextBackup(profileName, settings, interval);
      }
    }
  }, interval);
}

/**
 * Stop auto-backup timer
 */
function stopAutoBackupTimer() {
  if (backupTimer) {
    clearTimeout(backupTimer);
    backupTimer = null;
    
    debugLog?.info('Auto-backup timer stopped', {
      module: 'auto-backup-timer',
      function: 'stopAutoBackupTimer',
      profileName: currentProfile
    });
  }
  
  currentProfile = null;
}

/**
 * Get current profile being monitored
 * @returns {string|null} Current profile name
 */
function getCurrentProfile() {
  return currentProfile;
}

export {
  initializeAutoBackupTimer,
  startAutoBackupTimer,
  stopAutoBackupTimer,
  getCurrentProfile
};

