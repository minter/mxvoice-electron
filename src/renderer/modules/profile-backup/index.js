/**
 * Profile Backup Module
 * 
 * Handles backup restore and settings dialogs for profile backups.
 */

import { info, warn, error } from '../debug-log/index.js';

let electronAPI = null;
let isCreatingBackup = false; // Lock to prevent duplicate backup creation

/**
 * Initialize the Profile Backup module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 */
function initializeProfileBackup(options = {}) {
  electronAPI = options.electronAPI || (typeof window !== 'undefined' && window.secureElectronAPI);
  
  info('Profile Backup module initialized', {
    module: 'profile-backup',
    function: 'initializeProfileBackup',
    hasElectronAPI: !!electronAPI
  });
  
  // Register menu event handlers
  setupMenuHandlers();
}

/**
 * Setup menu event handlers and DOM event handlers
 */
function setupMenuHandlers() {
  // Setup save button handler for backup settings modal
  if (typeof document !== 'undefined') {
    const saveBtn = document.getElementById('backup-settings-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        await saveBackupSettings();
      });
    }
  }
}

/**
 * Open backup restore dialog
 */
async function openBackupRestoreDialog() {
  try {
    if (!electronAPI || !electronAPI.profile) {
      error('Electron API not available', {
        module: 'profile-backup',
        function: 'openBackupRestoreDialog'
      });
      return;
    }
    
    // Load backups
    const result = await electronAPI.profile.listBackups();
    
    if (!result.success) {
      warn('Failed to load backups', {
        module: 'profile-backup',
        function: 'openBackupRestoreDialog',
        error: result.error
      });
      return;
    }
    
    const backups = result.backups || [];
    
    // Populate backup list
    const backupList = document.getElementById('backup-restore-list');
    if (backupList) {
      backupList.innerHTML = '';
      
      if (backups.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'text-muted text-center p-3';
        emptyMsg.textContent = 'No backups available';
        backupList.appendChild(emptyMsg);
      } else {
        backups.forEach(backup => {
          const item = createBackupListItem(backup);
          backupList.appendChild(item);
        });
      }
    }
    
    // Show modal
    const { showModal } = await import('../ui/bootstrap-adapter.js');
    showModal('#backupRestoreModal');
  } catch (err) {
    error('Failed to open backup restore dialog', {
      module: 'profile-backup',
      function: 'openBackupRestoreDialog',
      error: err.message
    });
  }
}

/**
 * Create backup list item element
 * @param {Object} backup - Backup object
 * @returns {HTMLElement} List item element
 */
function createBackupListItem(backup) {
  const item = document.createElement('div');
  item.className = 'list-group-item list-group-item-action';
  item.dataset.backupId = backup.id;
  
  const date = new Date(backup.timestamp);
  const formattedDate = date.toLocaleString();
  const size = formatBytes(backup.size);
  
  // Create structure using DOM methods to prevent XSS
  const container = document.createElement('div');
  container.className = 'd-flex w-100 justify-content-between';
  
  const leftDiv = document.createElement('div');

  const h6 = document.createElement('h6');
  h6.className = 'mb-1 d-flex align-items-center gap-2';
  h6.textContent = formattedDate;

  // Mode pill (manual / auto / pre-restore / unknown)
  const mode = backup.mode || 'unknown';
  const modePill = document.createElement('span');
  modePill.className = 'badge rounded-pill';

  if (mode === 'manual') {
    modePill.classList.add('bg-primary');
    modePill.textContent = 'Manual';
  } else if (mode === 'auto') {
    modePill.classList.add('bg-secondary');
    modePill.textContent = 'Auto';
  } else if (mode === 'pre-restore') {
    modePill.classList.add('bg-warning', 'text-dark');
    modePill.textContent = 'Pre-restore';
  } else {
    modePill.classList.add('bg-dark');
    modePill.textContent = 'Unknown';
  }

  h6.appendChild(modePill);

  const small = document.createElement('small');
  small.className = 'text-muted';
  small.textContent = `${size} • ${backup.fileCount} files`;

  leftDiv.appendChild(h6);
  leftDiv.appendChild(small);
  
  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'btn btn-sm btn-primary restore-btn';
  restoreBtn.dataset.backupId = backup.id;
  restoreBtn.textContent = 'Restore';
  
  container.appendChild(leftDiv);
  container.appendChild(restoreBtn);
  item.appendChild(container);
  
  // Add restore button handler
  restoreBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await restoreBackup(backup.id);
  });
  
  return item;
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Restore from backup
 * @param {string} backupId - Backup ID to restore
 */
async function restoreBackup(backupId) {
  try {
    if (!electronAPI || !electronAPI.profile) {
      error('Electron API not available', {
        module: 'profile-backup',
        function: 'restoreBackup'
      });
      return;
    }
    
    // Confirm restore
    const { customConfirm } = await import('../utils/index.js');
    const confirmed = await customConfirm(
      'This will replace your current profile with the selected backup. A backup of your current profile will be created first. Continue?',
      'Restore Backup'
    );
    
    if (!confirmed) {
      return;
    }
    
    info('Restoring backup', {
      module: 'profile-backup',
      function: 'restoreBackup',
      backupId
    });

    // Restore backup
    const result = await electronAPI.profile.restoreBackup(backupId);
    
    if (result.success) {
      // Show success message
      const { customConfirm } = await import('../utils/index.js');
      await customConfirm(
        'Backup restored successfully. The application will reload to apply changes.',
        'Restore Complete'
      );
      
      // IMPORTANT:
      // Prevent the current window's beforeunload handler from saving profile state
      // after the backup has been restored on disk but before the new window loads.
      // Otherwise, the "old" DOM (pre-restore) could overwrite the restored state.json.
      if (typeof window !== 'undefined') {
        window.isRestoringProfileState = true;
      }

      // Reload the app to pick up restored profile directory
      window.location.reload();
    } else {
      error('Failed to restore backup', {
        module: 'profile-backup',
        function: 'restoreBackup',
        backupId,
        error: result.error
      });
      
      const { customConfirm } = await import('../utils/index.js');
      await customConfirm(
        `Failed to restore backup: ${result.error}`,
        'Restore Failed'
      );
    }
  } catch (err) {
    error('Error restoring backup', {
      module: 'profile-backup',
      function: 'restoreBackup',
      backupId,
      error: err.message
    });
  }
}

/**
 * Open backup settings dialog
 */
async function openBackupSettingsDialog() {
  try {
    if (!electronAPI || !electronAPI.profile) {
      error('Electron API not available', {
        module: 'profile-backup',
        function: 'openBackupSettingsDialog'
      });
      return;
    }
    
    // Load settings
    const result = await electronAPI.profile.getBackupSettings();
    
    if (!result.success) {
      warn('Failed to load backup settings', {
        module: 'profile-backup',
        function: 'openBackupSettingsDialog',
        error: result.error
      });
      return;
    }
    
    const settings = result.settings || {
      autoBackupEnabled: true,
      backupInterval: 30 * 60 * 1000,
      maxBackupCount: 25,
      maxBackupAge: 30 * 24 * 60 * 60 * 1000
    };
    
    // Populate form
    const enabledCheckbox = document.getElementById('backup-settings-enabled');
    if (enabledCheckbox) {
      enabledCheckbox.checked = settings.autoBackupEnabled !== false;
    }
    
    const intervalSelect = document.getElementById('backup-settings-interval');
    if (intervalSelect) {
      intervalSelect.value = settings.backupInterval.toString();
    }
    
    const maxCountInput = document.getElementById('backup-settings-max-count');
    if (maxCountInput) {
      maxCountInput.value = settings.maxBackupCount || 25;
    }
    
    const maxAgeSelect = document.getElementById('backup-settings-max-age');
    if (maxAgeSelect) {
      maxAgeSelect.value = settings.maxBackupAge.toString();
    }
    
    // Show modal
    const { showModal } = await import('../ui/bootstrap-adapter.js');
    showModal('#backupSettingsModal');
  } catch (err) {
    error('Failed to open backup settings dialog', {
      module: 'profile-backup',
      function: 'openBackupSettingsDialog',
      error: err.message
    });
  }
}

/**
 * Save backup settings
 */
async function saveBackupSettings() {
  try {
    if (!electronAPI || !electronAPI.profile) {
      error('Electron API not available', {
        module: 'profile-backup',
        function: 'saveBackupSettings'
      });
      return;
    }
    
    // Get form values
    const enabledCheckbox = document.getElementById('backup-settings-enabled');
    const intervalSelect = document.getElementById('backup-settings-interval');
    const maxCountInput = document.getElementById('backup-settings-max-count');
    const maxAgeSelect = document.getElementById('backup-settings-max-age');
    
    const settings = {
      autoBackupEnabled: enabledCheckbox ? enabledCheckbox.checked : true,
      backupInterval: intervalSelect ? parseInt(intervalSelect.value, 10) : 30 * 60 * 1000,
      maxBackupCount: maxCountInput ? parseInt(maxCountInput.value, 10) : 25,
      maxBackupAge: maxAgeSelect ? parseInt(maxAgeSelect.value, 10) : 30 * 24 * 60 * 60 * 1000
    };
    
    info('Saving backup settings', {
      module: 'profile-backup',
      function: 'saveBackupSettings',
      settings
    });
    
    // Save settings
    const result = await electronAPI.profile.saveBackupSettings(settings);
    
    if (result.success) {
      // Close modal
      const { hideModal } = await import('../ui/bootstrap-adapter.js');
      hideModal('#backupSettingsModal');
    } else {
      error('Failed to save backup settings', {
        module: 'profile-backup',
        function: 'saveBackupSettings',
        error: result.error
      });
    }
  } catch (err) {
    error('Error saving backup settings', {
      module: 'profile-backup',
      function: 'saveBackupSettings',
      error: err.message
    });
  }
}

/**
 * Create backup manually
 */
async function createBackupNow() {
  // Prevent duplicate backup creation
  if (isCreatingBackup) {
    warn('Backup creation already in progress', {
      module: 'profile-backup',
      function: 'createBackupNow'
    });
    return;
  }
  
  try {
    if (!electronAPI || !electronAPI.profile) {
      error('Electron API not available', {
        module: 'profile-backup',
        function: 'createBackupNow'
      });
      return;
    }

    // First, ensure the current profile state (hotkeys, holding tank, etc.) is flushed to disk
    // so that the backup represents the exact current UI state.
    if (typeof window !== 'undefined' && !window.isRestoringProfileState) {
      const hasProfileStateModule =
        window.moduleRegistry &&
        window.moduleRegistry.profileState &&
        typeof window.moduleRegistry.profileState.saveProfileState === 'function';

      if (hasProfileStateModule) {
        info('Saving profile state before manual backup', {
          module: 'profile-backup',
          function: 'createBackupNow'
        });

        let saveResult = null;
        try {
          saveResult = await window.moduleRegistry.profileState.saveProfileState();
        } catch (err) {
          error('Error saving profile state before backup', {
            module: 'profile-backup',
            function: 'createBackupNow',
            error: err.message
          });
        }

        // If state save failed or was skipped, do NOT proceed with backup
        if (!saveResult || saveResult.success === false || saveResult.skipped) {
          const reason =
            (saveResult && saveResult.error) ||
            (saveResult && saveResult.skipped && 'Profile state save was skipped') ||
            'Unknown error';

          // More specific message when restoration lock is active
          const message =
            saveResult && saveResult.skipped
              ? 'Cannot create a backup while your profile is still being restored. Please wait for the app to finish loading and then try again.'
              : `Failed to save the current profile state before creating a backup: ${reason}`;

          error('Aborting manual backup because profile state could not be saved', {
            module: 'profile-backup',
            function: 'createBackupNow',
            reason
          });

          const { customConfirm } = await import('../utils/index.js');
          await customConfirm(message, 'Backup Not Created');
          return;
        }
      } else {
        // When profile state module is not available (legacy/edge cases), we still allow
        // the backup to proceed, but log a warning since we cannot guarantee exact UI state.
        warn('Profile state module not available - proceeding with backup without explicit state save', {
          module: 'profile-backup',
          function: 'createBackupNow'
        });
      }
    } else if (typeof window !== 'undefined' && window.isRestoringProfileState) {
      // If a restoration is currently in progress, we should not attempt a backup at all
      // because the on-disk state is in flux and not a reliable snapshot.
      warn('Refusing to create backup while profile restoration is in progress', {
        module: 'profile-backup',
        function: 'createBackupNow'
      });

      const { customConfirm } = await import('../utils/index.js');
      await customConfirm(
        'Cannot create a backup while your profile is still being restored. Please wait for the app to finish loading and then try again.',
        'Backup Not Created'
      );
      return;
    }
    
    // Set lock
    isCreatingBackup = true;
    
    info('Creating backup manually', {
      module: 'profile-backup',
      function: 'createBackupNow'
    });
    
    const result = await electronAPI.profile.createBackup();
    
    if (result.success) {
      info('Backup created successfully', {
        module: 'profile-backup',
        function: 'createBackupNow',
        backupId: result.backupId
      });
      
      // Show success notification
      const { customAlert } = await import('../utils/index.js');
      await customAlert(
        'Backup created successfully.',
        'Backup Complete'
      );
    } else {
      error('Failed to create backup', {
        module: 'profile-backup',
        function: 'createBackupNow',
        error: result.error
      });
      
      // Show error modal for failures
      const { customConfirm } = await import('../utils/index.js');
      await customConfirm(
        `Failed to create backup: ${result.error}`,
        'Backup Failed'
      );
    }
  } catch (err) {
    error('Error creating backup', {
      module: 'profile-backup',
      function: 'createBackupNow',
      error: err.message
    });
    
    // Show error modal for exceptions
    const { customConfirm } = await import('../utils/index.js');
    await customConfirm(
      `Error creating backup: ${err.message}`,
      'Backup Error'
    );
  } finally {
    // Release lock
    isCreatingBackup = false;
  }
}

/**
 * Reinitialize with dependencies
 * @param {Object} deps - Dependencies
 */
function reinitializeProfileBackup(deps) {
  electronAPI = deps.electronAPI || (typeof window !== 'undefined' && window.secureElectronAPI);
}

export {
  initializeProfileBackup,
  openBackupRestoreDialog,
  openBackupSettingsDialog,
  saveBackupSettings,
  createBackupNow,
  restoreBackup,
  reinitializeProfileBackup
};

export default {
  initializeProfileBackup,
  openBackupRestoreDialog,
  openBackupSettingsDialog,
  saveBackupSettings,
  createBackupNow,
  restoreBackup,
  reinitializeProfileBackup
};

