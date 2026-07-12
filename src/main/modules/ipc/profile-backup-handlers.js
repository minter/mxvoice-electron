/**
 * Profile backup IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import * as profileManager from '../profile-manager.js';
import * as profileBackupManager from '../profile-backup-manager.js';
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { getCurrentProfile, debugLog } = deps;

  // Profile Backup: Create backup
  ipcMain.handle(IPC.PROFILE_BACKUP.CREATE, async (_event) => {
    try {
      const currentProfile = getCurrentProfile();

      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }

      debugLog?.info('Profile backup create requested', {
        module: 'ipc-handlers',
        function: 'profile:createBackup',
        profileName: currentProfile
      });

      const result = await profileBackupManager.createBackup(currentProfile, { mode: 'manual' });

      if (result.success) {
        debugLog?.info('Profile backup created successfully', {
          module: 'ipc-handlers',
          function: 'profile:createBackup',
          profileName: currentProfile,
          backupId: result.backupId
        });
      } else {
        debugLog?.error('Failed to create profile backup', {
          module: 'ipc-handlers',
          function: 'profile:createBackup',
          profileName: currentProfile,
          error: result.error
        });
      }

      return result;
    } catch (error) {
      debugLog?.error('Profile backup create error:', {
        module: 'ipc-handlers',
        function: 'profile:createBackup',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: List backups
  ipcMain.handle(IPC.PROFILE_BACKUP.LIST, async (_event) => {
    try {
      const currentProfile = getCurrentProfile();

      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }

      debugLog?.info('Profile backup list requested', {
        module: 'ipc-handlers',
        function: 'profile:listBackups',
        profileName: currentProfile
      });

      const result = await profileBackupManager.listBackups(currentProfile);

      return result;
    } catch (error) {
      debugLog?.error('Profile backup list error:', {
        module: 'ipc-handlers',
        function: 'profile:listBackups',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Get backup metadata
  ipcMain.handle(IPC.PROFILE_BACKUP.GET_METADATA, async (_event) => {
    try {
      const currentProfile = getCurrentProfile();

      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }

      const result = await profileBackupManager.getBackupMetadata(currentProfile);

      return result;
    } catch (error) {
      debugLog?.error('Profile backup metadata error:', {
        module: 'ipc-handlers',
        function: 'profile:getBackupMetadata',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Restore from backup
  ipcMain.handle(IPC.PROFILE_BACKUP.RESTORE, async (event, backupId) => {
    try {
      const currentProfile = getCurrentProfile();

      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }

      debugLog?.info('Profile backup restore requested', {
        module: 'ipc-handlers',
        function: 'profile:restoreBackup',
        profileName: currentProfile,
        backupId
      });

      const result = await profileBackupManager.restoreBackup(currentProfile, backupId);

      if (result.success) {
        debugLog?.info('Profile backup restored successfully', {
          module: 'ipc-handlers',
          function: 'profile:restoreBackup',
          profileName: currentProfile,
          backupId
        });
      } else {
        debugLog?.error('Failed to restore profile backup', {
          module: 'ipc-handlers',
          function: 'profile:restoreBackup',
          profileName: currentProfile,
          backupId,
          error: result.error
        });
      }

      return result;
    } catch (error) {
      debugLog?.error('Profile backup restore error:', {
        module: 'ipc-handlers',
        function: 'profile:restoreBackup',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Delete backup
  ipcMain.handle(IPC.PROFILE_BACKUP.DELETE, async (event, backupId) => {
    try {
      const currentProfile = getCurrentProfile();

      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }

      debugLog?.info('Profile backup delete requested', {
        module: 'ipc-handlers',
        function: 'profile:deleteBackup',
        profileName: currentProfile,
        backupId
      });

      const result = await profileBackupManager.deleteBackup(currentProfile, backupId);

      return result;
    } catch (error) {
      debugLog?.error('Profile backup delete error:', {
        module: 'ipc-handlers',
        function: 'profile:deleteBackup',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Get backup settings
  ipcMain.handle(IPC.PROFILE_BACKUP.GET_SETTINGS, async (_event) => {
    try {
      const currentProfile = getCurrentProfile();

      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }

      const preferences = await profileManager.loadProfilePreferences(currentProfile);
      const backupSettings = preferences?.backup_settings || {
        autoBackupEnabled: true,
        backupInterval: 30 * 60 * 1000, // 30 minutes
        maxBackupCount: 25,
        maxBackupAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      };

      return { success: true, settings: backupSettings };
    } catch (error) {
      debugLog?.error('Profile backup settings get error:', {
        module: 'ipc-handlers',
        function: 'profile:getBackupSettings',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Save backup settings
  ipcMain.handle(IPC.PROFILE_BACKUP.SAVE_SETTINGS, async (event, settings) => {
    try {
      const currentProfile = getCurrentProfile();

      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }

      debugLog?.info('Profile backup settings save requested', {
        module: 'ipc-handlers',
        function: 'profile:saveBackupSettings',
        profileName: currentProfile,
        settings
      });

      const preferences = await profileManager.loadProfilePreferences(currentProfile);
      const updatedPreferences = {
        ...preferences,
        backup_settings: settings
      };

      const result = await profileManager.saveProfilePreferences(currentProfile, updatedPreferences);

      if (result) {
        return { success: true };
      } else {
        return { success: false, error: 'Failed to save preferences' };
      }
    } catch (error) {
      debugLog?.error('Profile backup settings save error:', {
        module: 'ipc-handlers',
        function: 'profile:saveBackupSettings',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });
}
