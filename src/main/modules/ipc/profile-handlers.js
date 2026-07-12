/**
 * Profile IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain, app } = electron;
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as profileManager from '../profile-manager.js';
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { getCurrentProfile, getProfileDirectory, store, debugLog, mainWindow } = deps;

  // Profile handlers
  ipcMain.handle(IPC.PROFILE.GET_CURRENT, async () => {
    try {
      // Import the main module to get current profile
      const profile = getCurrentProfile();
      return { success: true, profile: profile || null };
    } catch (error) {
      debugLog?.error('Get current profile error:', { module: 'ipc-handlers', function: 'profile:get-current', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PROFILE.GET_DIRECTORY, async (event, type) => {
    try {
      // Import the main module to get profile directory
      const directory = getProfileDirectory(type);
      return { success: true, directory };
    } catch (error) {
      debugLog?.error('Get profile directory error:', { module: 'ipc-handlers', function: 'profile:get-directory', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PROFILE.LOAD_STATE, async () => {
    try {
      const stateFile = path.join(getProfileDirectory('state'), 'state.json');
      try {
        const data = await fsPromises.readFile(stateFile, 'utf8');
        return { success: true, loaded: true, data };
      } catch (error) {
        if (error.code === 'ENOENT') return { success: true, loaded: false };
        throw error;
      }
    } catch (error) {
      debugLog?.error('Load profile state error', {
        module: 'ipc-handlers',
        function: 'profile:load-state',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PROFILE.GET_LEGACY_MIGRATION_DATA, async () => {
    try {
      const stateFile = path.join(getProfileDirectory('state'), 'state.json');
      const configFile = path.join(app.getPath('userData'), 'config.json');
      const stateExists = fs.existsSync(stateFile);
      if (!fs.existsSync(configFile)) {
        return { success: true, stateExists, configExists: false, hotkeys: null, holdingTank: null };
      }
      const config = JSON.parse(await fsPromises.readFile(configFile, 'utf8'));
      return {
        success: true,
        stateExists,
        configExists: true,
        hotkeys: typeof config.hotkeys === 'string' ? config.hotkeys : null,
        holdingTank: typeof config.holding_tank === 'string' ? config.holding_tank : null
      };
    } catch (error) {
      debugLog?.error('Legacy migration data error', {
        module: 'ipc-handlers',
        function: 'profile:get-legacy-migration-data',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Save state (called on window close)
  ipcMain.handle(IPC.PROFILE.SAVE_STATE, async (event, state, profileName) => {
    try {
      const name = profileName || getCurrentProfile();
      return await profileManager.saveProfileState(name, state, { reason: 'window-close' });
    } catch (error) {
      debugLog?.error('Error saving profile state', {
        module: 'ipc-handlers',
        function: 'profile:save-state',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });


  // Profile: Get preference value
  ipcMain.handle(IPC.PROFILE.GET_PREFERENCE, async (event, key) => {
    try {
      const profileName = getCurrentProfile();
      const preferences = await profileManager.loadProfilePreferences(profileName);

      return { success: true, value: preferences[key] };
    } catch (error) {
      debugLog?.error('Error getting profile preference', {
        module: 'ipc-handlers',
        function: 'profile:get-preference',
        key: key,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Set preference value
  ipcMain.handle(IPC.PROFILE.SET_PREFERENCE, async (event, key, value) => {
    try {
      const profileName = getCurrentProfile();

      debugLog?.info('[PROFILE-PREF] Loading preferences for profile', {
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        profileName,
        key
      });

      const preferences = await profileManager.loadProfilePreferences(profileName);

      debugLog?.info('[PROFILE-PREF] Current preferences loaded', {
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        profileName,
        key,
        hasPreferences: !!preferences
      });

      preferences[key] = value;

      debugLog?.info('[PROFILE-PREF] Saving updated preferences', {
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        profileName,
        key,
        valueType: typeof value,
        valueLength: Array.isArray(value) ? value.length : undefined
      });

      await profileManager.saveProfilePreferences(profileName, preferences);

      debugLog?.info('[PROFILE-PREF] Profile preference saved successfully', {
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        profileName,
        key
      });

      return { success: true };
    } catch (error) {
      debugLog?.error('[PROFILE-PREF] Error setting profile preference', {
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        key: key,
        error: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Set multiple preferences atomically (prevents race conditions)
  ipcMain.handle(IPC.PROFILE.SET_PREFERENCES, async (event, preferencesObject) => {
    try {
      const profileName = getCurrentProfile();

      debugLog?.info('[PROFILE-PREF] Setting multiple preferences atomically', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName,
        keys: Object.keys(preferencesObject || {})
      });

      const currentPreferences = await profileManager.loadProfilePreferences(profileName);

      debugLog?.info('[PROFILE-PREF] Current preferences before update', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName,
        currentFadeOut: currentPreferences?.fade_out_seconds,
        currentKeys: Object.keys(currentPreferences || {})
      });

      // Merge new preferences into current preferences
      const updatedPreferences = {
        ...currentPreferences,
        ...preferencesObject
      };

      debugLog?.info('[PROFILE-PREF] Saving updated preferences atomically', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName,
        preferenceCount: Object.keys(preferencesObject || {}).length,
        newFadeOut: updatedPreferences.fade_out_seconds,
        allNewValues: preferencesObject
      });

      const saveResult = await profileManager.saveProfilePreferences(profileName, updatedPreferences);

      // Sync prerelease_updates to the global store so the auto-updater picks it up
      // (auto-updater reads from store.get('prerelease_updates'), not profile preferences)
      if ('prerelease_updates' in preferencesObject) {
        store.set('prerelease_updates', preferencesObject.prerelease_updates);
      }

      debugLog?.info('[PROFILE-PREF] Save completed', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName,
        saveSuccess: saveResult,
        savedFadeOut: updatedPreferences.fade_out_seconds
      });

      debugLog?.info('[PROFILE-PREF] Multiple preferences saved successfully', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName
      });

      return { success: true };
    } catch (error) {
      debugLog?.error('[PROFILE-PREF] Error setting multiple profile preferences', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        error: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Get all preferences
  ipcMain.handle(IPC.PROFILE.GET_ALL_PREFERENCES, async () => {
    try {
      const profileName = getCurrentProfile();
      const preferences = await profileManager.loadProfilePreferences(profileName);

      return { success: true, preferences: preferences };
    } catch (error) {
      debugLog?.error('Error getting all profile preferences', {
        module: 'ipc-handlers',
        function: 'profile:get-all-preferences',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PROFILE.SWITCH, async () => {
    try {
      debugLog?.info('Profile switch requested, will save state and relaunch', {
        module: 'ipc-handlers',
        function: 'profile:switch'
      });

      // Note: State must be saved BEFORE we tell the renderer we're switching
      // The renderer should call profile:save-state-before-switch first

      // Save current profile name for fallback if launcher is closed without selection
      const currentProfile = getCurrentProfile();
      if (currentProfile) {
        // Store the current profile as the fallback profile
        store.set('fallback-profile', currentProfile);
        debugLog?.info('Saved fallback profile for launcher close scenario', {
          module: 'ipc-handlers',
          function: 'profile:switch',
          fallbackProfile: currentProfile
        });
      }

      // Close main window and relaunch launcher
      if (mainWindow) {
        mainWindow.close();
      }

      // Relaunch the app without profile argument to show launcher
      app.relaunch({ args: process.argv.slice(1).filter(arg => !arg.startsWith('--profile=')) });
      app.exit(0);

      return { success: true };
    } catch (error) {
      debugLog?.error('Profile switch error:', { module: 'ipc-handlers', function: 'profile:switch', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Profile: Save state before switch (explicit save, not relying on beforeunload)
  ipcMain.handle(IPC.PROFILE.SAVE_STATE_BEFORE_SWITCH, async (event, state, profileName) => {
    try {
      const name = profileName || getCurrentProfile();
      return await profileManager.saveProfileState(name, state, { reason: 'profile-switch' });
    } catch (error) {
      debugLog?.error('Error saving profile state before switch', {
        module: 'ipc-handlers',
        function: 'profile:save-state-before-switch',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Create profile
  ipcMain.handle(IPC.PROFILE.CREATE, async (event, profileName, description) => {
    try {
      debugLog?.info('Profile create requested', {
        module: 'ipc-handlers',
        function: 'profile:create',
        profileName,
        description
      });

      // Create the profile using the imported profile manager
      const result = await profileManager.createProfile(profileName, description);

      if (result.success) {
        debugLog?.info('Profile created successfully', {
          module: 'ipc-handlers',
          function: 'profile:create',
          profileName
        });
      } else {
        debugLog?.error('Failed to create profile', {
          module: 'ipc-handlers',
          function: 'profile:create',
          profileName,
          error: result.error
        });
      }

      return result;
    } catch (error) {
      debugLog?.error('Profile create error:', {
        module: 'ipc-handlers',
        function: 'profile:create',
        profileName,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Duplicate profile
        ipcMain.handle(IPC.PROFILE.DUPLICATE, async (event, sourceProfileName, targetProfileName, description) => {
          try {
            debugLog?.info('Profile duplicate requested', {
              module: 'ipc-handlers',
              function: 'profile:duplicate',
              sourceProfileName,
              targetProfileName,
              description
            });

            const result = await profileManager.duplicateProfile(sourceProfileName, targetProfileName, description);

            if (result.success) {
              debugLog?.info('Profile duplicated successfully', {
                module: 'ipc-handlers',
                function: 'profile:duplicate',
                sourceProfileName,
                targetProfileName
              });
            } else {
              debugLog?.error('Failed to duplicate profile', {
                module: 'ipc-handlers',
                function: 'profile:duplicate',
                sourceProfileName,
                targetProfileName,
                error: result.error
              });
            }

            return result;
          } catch (error) {
            debugLog?.error('Profile duplicate error:', {
              module: 'ipc-handlers',
              function: 'profile:duplicate',
              sourceProfileName,
              targetProfileName,
              error: error.message
            });
            return { success: false, error: error.message };
          }
        });

  // Profile: Switch to specific profile
  ipcMain.handle(IPC.PROFILE.SWITCH_TO, async (event, profileName) => {
    try {
      debugLog?.info('Profile switch to specific profile requested', {
        module: 'ipc-handlers',
        function: 'profile:switch-to',
        profileName
      });

      // Save current profile name for fallback if launcher is closed without selection
      const currentProfile = getCurrentProfile();
      if (currentProfile) {
        store.set('fallback-profile', currentProfile);
        debugLog?.info('Saved fallback profile before switch', {
          module: 'ipc-handlers',
          function: 'profile:switch-to',
          fallbackProfile: currentProfile
        });
      }

      // Set the target profile as the fallback so launcher will auto-select it
      store.set('auto-select-profile', profileName);

      // Close main window and relaunch launcher
      if (mainWindow) {
        mainWindow.close();
      }
      app.relaunch({ args: [...process.argv.slice(1).filter(arg => !arg.startsWith('--profile=')), `--profile=${profileName}`] });
      app.exit(0);

      return { success: true };
    } catch (error) {
      debugLog?.error('Profile switch to specific profile error:', {
        module: 'ipc-handlers',
        function: 'profile:switch-to',
        profileName,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Delete profile
  ipcMain.handle(IPC.PROFILE.DELETE, async (event, profileName) => {
    try {
      debugLog?.info('Profile delete requested', {
        module: 'ipc-handlers',
        function: 'profile:delete',
        profileName
      });

      // Delete the profile using the imported profile manager
      const result = await profileManager.deleteProfile(profileName);

      if (result.success) {
        debugLog?.info('Profile deleted successfully', {
          module: 'ipc-handlers',
          function: 'profile:delete',
          profileName
        });
      } else {
        debugLog?.error('Failed to delete profile', {
          module: 'ipc-handlers',
          function: 'profile:delete',
          profileName,
          error: result.error
        });
      }

      return result;
    } catch (error) {
      debugLog?.error('Profile delete error:', {
        module: 'ipc-handlers',
        function: 'profile:delete',
        profileName,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });
}
