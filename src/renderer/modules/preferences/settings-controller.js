/**
 * Settings Controller
 * 
 * Handles saving and managing application preferences and settings.
 * 
 * @module settings-controller
 */

import { setPreference as setPreferenceViaAdapter } from './profile-preference-adapter.js';

// Import debug logger from global scope (renderer initializes it early)
let debugLog = null;
try {
  if (typeof window !== 'undefined' && window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Fallback to prevent initialization failure
  console.warn('Failed to access window.debugLog during settings controller initialization', { 
    module: 'preferences', 
    function: 'settings-controller-init',
    error: error?.message || 'Unknown error' 
  });
}

/**
 * Initialize the settings controller
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Settings controller interface
 */
function initializeSettingsController(options = {}) {
  // Prefer exposed API; fallback to secure API if only that exists
  const electronAPISource = (typeof window !== 'undefined' && (window.electronAPI || window.secureElectronAPI)) || null;
  const electronAPI = options.electronAPI || electronAPISource;
  const { db, store } = options;
  
  /**
   * Save preferences from the preferences modal
   * @param {Event} event - The form submission event
   */
  async function savePreferences(event) {
    debugLog?.info("[PREFS-SAVE] Saving preferences", { function: "savePreferences" });
    event.preventDefault();
    
    // Use new store API for saving preferences
    if (electronAPI && electronAPI.store) {
      // Get current values from form
      const dbDir = (document.getElementById('preferences-database-directory')?.value) || '';
      const musicDir = (document.getElementById('preferences-song-directory')?.value) || '';
      const hotkeyDir = (document.getElementById('preferences-hotkey-directory')?.value) || '';
      
      // Validate that critical directory preferences are not being cleared
      // Only save if the value is non-empty OR if it was already empty
      const validateDirectory = async (key) => {
        const current = await getPreference(key, electronAPI);
        return current.success ? current.value : '';
      };
      
      const [currentDbDir, currentMusicDir, currentHotkeyDir] = await Promise.all([
        validateDirectory('database_directory'),
        validateDirectory('music_directory'),
        validateDirectory('hotkey_directory')
      ]);
      
      const preferences = {
        // Only update directory if new value is non-empty OR current value is already empty
        database_directory: dbDir || currentDbDir,
        music_directory: musicDir || currentMusicDir,
        hotkey_directory: hotkeyDir || currentHotkeyDir,
        fade_out_seconds: parseInt(document.getElementById('preferences-fadeout-seconds')?.value) || 3,
        debug_log_enabled: !!document.getElementById('preferences-debug-log-enabled')?.checked,
        prerelease_updates: !!document.getElementById('preferences-prerelease-updates')?.checked,
        screen_mode: (document.getElementById('preferences-screen-mode')?.value) || 'auto'
      };
      
      debugLog?.info("[PREFS-SAVE] Preferences to save", { preferences });
      
      // Save all preferences (using adapter to route to profile or global as appropriate)
      // IMPORTANT: Profile preferences must be saved sequentially to avoid race conditions
      // where multiple saves overwrite each other. Global preferences can be saved in parallel.
      try {
        // Import the preference adapter to check which preferences are profile vs global
        const { PROFILE_PREFERENCES } = await import('./profile-preference-adapter.js');
        
        // Separate profile and global preferences
        const profilePrefs = [];
        const globalPrefs = [];
        
        const allPrefs = [
          { key: "database_directory", value: preferences.database_directory },
          { key: "music_directory", value: preferences.music_directory },
          { key: "hotkey_directory", value: preferences.hotkey_directory },
          { key: "fade_out_seconds", value: preferences.fade_out_seconds },
          { key: "debug_log_enabled", value: preferences.debug_log_enabled },
          { key: "prerelease_updates", value: preferences.prerelease_updates },
          { key: "screen_mode", value: preferences.screen_mode }
        ];
        
        allPrefs.forEach(pref => {
          if (PROFILE_PREFERENCES.includes(pref.key)) {
            profilePrefs.push(pref);
          } else {
            globalPrefs.push(pref);
          }
        });
        
        // Save global preferences in parallel (no race condition)
        const globalResults = await Promise.all(
          globalPrefs.map(pref => setPreferenceViaAdapter(pref.key, pref.value, electronAPI))
        );
        
        // Save profile preferences atomically in a single operation to avoid race conditions
        let profileResults = [];
        if (profilePrefs.length > 0 && electronAPI?.profile?.setPreferences) {
          // Use atomic save for all profile preferences at once
          const profilePrefsObject = {};
          profilePrefs.forEach(pref => {
            profilePrefsObject[pref.key] = pref.value;
          });
          debugLog?.info("[PREFS-SAVE] Saving profile preferences atomically", { 
            profilePrefs: profilePrefsObject,
            keys: Object.keys(profilePrefsObject)
          });
          const atomicResult = await electronAPI.profile.setPreferences(profilePrefsObject);
          debugLog?.info("[PREFS-SAVE] Atomic save result", { 
            success: atomicResult?.success,
            error: atomicResult?.error
          });
          // Create individual results for each preference for consistency
          profilePrefs.forEach(() => {
            profileResults.push(atomicResult);
          });
        } else if (profilePrefs.length > 0) {
          debugLog?.warn("[PREFS-SAVE] Atomic save not available, falling back to sequential", {
            hasProfileAPI: !!electronAPI?.profile,
            hasSetPreferences: !!electronAPI?.profile?.setPreferences
          });
          // Fallback: save profile preferences sequentially if atomic save not available
          for (const pref of profilePrefs) {
            const result = await setPreferenceViaAdapter(pref.key, pref.value, electronAPI);
            profileResults.push(result);
          }
        }
        
        const results = [...globalResults, ...profileResults];
        
        debugLog?.info("[PREFS-SAVE] Save results", { results, profileCount: profilePrefs.length, globalCount: globalPrefs.length });
        
        // Update audio module's music directory cache if it changed
        if (preferences.music_directory && window.moduleRegistry?.audio?.updateMusicDirectoryCache) {
          window.moduleRegistry.audio.updateMusicDirectoryCache(preferences.music_directory);
          debugLog?.info("[PREFS-SAVE] Updated audio module music directory cache", { 
            musicDirectory: preferences.music_directory 
          });
        }
        
        // Count successes - handle both boolean true and {success: true} formats
        const successCount = results.filter(result => {
          if (typeof result === 'boolean') return result;
          return result && result.success;
        }).length;
        
        // Apply new theme immediately if screen mode preference changed
        // (do this regardless of other preferences succeeding)
        if (window.moduleRegistry?.themeManagement && window.moduleRegistry.themeManagement.setUserTheme) {
          try {
            const newScreenMode = preferences.screen_mode;
            debugLog?.info('Applying theme after preference change', { newTheme: newScreenMode });
            await window.moduleRegistry.themeManagement.setUserTheme(newScreenMode);
            debugLog?.info('Theme applied successfully', { newTheme: newScreenMode });
          } catch (themeError) {
            debugLog?.warn('Failed to apply theme', { error: themeError });
          }
        } else if (window.setUserTheme) {
          try {
            const newScreenMode = preferences.screen_mode;
            debugLog?.info('Applying theme via global function', { newTheme: newScreenMode });
            await window.setUserTheme(newScreenMode);
            debugLog?.info('Theme applied successfully via global function', { newTheme: newScreenMode });
          } catch (themeError) {
            debugLog?.warn('Failed to apply theme via global function', { error: themeError });
          }
        }
        
        if (successCount === 7) {
          debugLog?.info('[PREFS-SAVE] All preferences saved successfully', { 
            function: "savePreferences",
            data: { successCount, totalPreferences: 7 }
          });
        } else {
          debugLog?.warn('[PREFS-SAVE] Some preferences failed to save', { 
            function: "savePreferences",
            data: { successCount, totalPreferences: 7, results }
          });
        }
        
        // Close modal after save operations complete
        try {
          const { hideModal } = await import('../ui/bootstrap-adapter.js');
          hideModal('#preferencesModal');
        } catch {}
      } catch (error) {
        debugLog?.error('Failed to save preferences', { 
          function: "savePreferences",
          error: error
        });
        // Fallback to legacy store access
        await savePreferencesLegacy(preferences);
        
        // Close modal even if save failed
        try {
          const { hideModal } = await import('../ui/bootstrap-adapter.js');
          hideModal('#preferencesModal');
        } catch {}
      }
    } else {
      // Fallback to legacy store access
      const preferences = {
        database_directory: (document.getElementById('preferences-database-directory')?.value) || '',
        music_directory: (document.getElementById('preferences-song-directory')?.value) || '',
        hotkey_directory: (document.getElementById('preferences-hotkey-directory')?.value) || '',
        fade_out_seconds: (document.getElementById('preferences-fadeout-seconds')?.value) || '',
        debug_log_enabled: !!document.getElementById('preferences-debug-log-enabled')?.checked,
        prerelease_updates: !!document.getElementById('preferences-prerelease-updates')?.checked,
        screen_mode: (document.getElementById('preferences-screen-mode')?.value) || 'auto'
      };
      await savePreferencesLegacy(preferences);
      
      // Close modal after legacy save completes
      try {
        const { hideModal } = await import('../ui/bootstrap-adapter.js');
        hideModal('#preferencesModal');
      } catch {}
    }
  }
  
  /**
   * Save preferences using legacy store access
   * Fallback method when new API is not available
   * @param {Object} preferences - Preferences object to save
   */
  async function savePreferencesLegacy(preferences) {
    try {
      if (store) {
        store.set("database_directory", preferences.database_directory);
        store.set("music_directory", preferences.music_directory);
        store.set("hotkey_directory", preferences.hotkey_directory);
        store.set("fade_out_seconds", preferences.fade_out_seconds);
        store.set("debug_log_enabled", preferences.debug_log_enabled);
        store.set("prerelease_updates", preferences.prerelease_updates);
        store.set("screen_mode", preferences.screen_mode);
        debugLog?.info('Preferences saved using legacy method', { 
          function: "savePreferencesLegacy",
          data: { preferences }
        });
        
        // Apply new theme immediately if screen mode preference changed
        if (window.moduleRegistry?.themeManagement && window.moduleRegistry.themeManagement.setUserTheme) {
          try {
            const newScreenMode = preferences.screen_mode;
            await window.moduleRegistry.themeManagement.setUserTheme(newScreenMode);
            debugLog?.info('Theme applied immediately after legacy preference save', { newTheme: newScreenMode });
          } catch (themeError) {
            debugLog?.warn('Failed to apply theme after legacy preference save', { error: themeError });
          }
        }
      } else {
        // Legacy store not available, use electronAPI.store
        try {
          const ops = [
            ['database_directory', preferences.database_directory],
            ['music_directory', preferences.music_directory],
            ['hotkey_directory', preferences.hotkey_directory],
            ['fade_out_seconds', preferences.fade_out_seconds],
            ['debug_log_enabled', preferences.debug_log_enabled],
            ['prerelease_updates', preferences.prerelease_updates],
            ['screen_mode', preferences.screen_mode]
          ];
          const results = [];
          for (const [key, val] of ops) {
            try {
              const res = await electronAPI.store.set(key, val);
              results.push({ key, ...res });
            } catch (e) {
              results.push({ key, success: false, error: e?.message || 'unknown' });
            }
          }
          
          const successCount = results.filter(result => result.success).length;
          if (successCount === 7) {
            debugLog?.info('All preferences saved successfully using electronAPI.store', { 
              function: "savePreferencesLegacy",
              data: { successCount, totalPreferences: 7 }
            });
            
            // Apply new theme immediately if screen mode preference changed
            if (window.moduleRegistry?.themeManagement && window.moduleRegistry.themeManagement.setUserTheme) {
              try {
                const newScreenMode = preferences.screen_mode;
                await window.moduleRegistry.themeManagement.setUserTheme(newScreenMode);
                debugLog?.info('Theme applied immediately after electronAPI.store save', { newTheme: newScreenMode });
              } catch (themeError) {
                debugLog?.warn('Failed to apply theme after electronAPI.store save', { error: themeError });
              }
            }
          } else {
            debugLog?.warn('Some preferences failed to save', { 
              function: "savePreferencesLegacy",
            data: { successCount, totalPreferences: 7, results }
            });
          }
        } catch (error) {
          debugLog?.error('Failed to save preferences using electronAPI.store', { 
            function: "savePreferencesLegacy",
            error: error
          });
        }
      }
    } catch (error) {
      debugLog?.error('Legacy preference saving failed', { 
        function: "savePreferencesLegacy",
        error: error
      });
    }
  }
  
  /**
   * Get a specific preference value
   * @param {string} key - Preference key
   * @returns {Promise<any>} Preference value
   */
  async function getPreference(key) {
    if (electronAPI && electronAPI.store) {
      try {
        const result = await electronAPI.store.get(key);
        if (result.success) {
          return result.value;
        } else {
          debugLog?.warn(`Failed to get preference ${key}`, { 
            function: "getPreference",
            data: { key, error: result.error }
          });
          return null;
        }
      } catch (error) {
        debugLog?.error(`Preference get error for ${key}`, { 
          function: "getPreference",
          data: { key },
          error: error
        });
        return null;
      }
    } else if (store) {
      // Fallback to legacy store access
      return Promise.resolve(store.get(key));
    } else {
      // No store available
      await debugLog.warn(`No store available for preference ${key}`, { 
        function: "getPreference",
        data: { key }
      });
      return Promise.resolve(null);
    }
  }
  
  // Note: setPreference is imported from profile-preference-adapter.js
  // It routes preferences to either global store or profile-specific storage
  
  return {
    savePreferences,
    getPreference,
    setPreference: (key, value) => setPreferenceViaAdapter(key, value, electronAPI)
  };
}

export {
  initializeSettingsController
};

// Default export for module loading
export default initializeSettingsController; 