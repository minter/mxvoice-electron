import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };
const backup = {
  createBackup: vi.fn(), listBackups: vi.fn(), getBackupMetadata: vi.fn(),
  restoreBackup: vi.fn(), deleteBackup: vi.fn()
};
const profiles = {
  loadProfilePreferences: vi.fn(), saveProfilePreferences: vi.fn()
};

vi.mock('electron', () => ({ default: { ipcMain }, ipcMain }));
vi.mock('../../../src/main/modules/profile-backup-manager.js', () => backup);
vi.mock('../../../src/main/modules/profile-manager.js', () => profiles);

const { register } = await import('../../../src/main/modules/ipc/profile-backup-handlers.js');
const debugLog = { info: vi.fn(), error: vi.fn() };
let activeProfile;

function invoke(channel, ...args) {
  return handlers[channel]({}, ...args);
}

beforeEach(() => {
  vi.clearAllMocks();
  activeProfile = 'Default User';
  register({ getCurrentProfile: () => activeProfile, debugLog });
});

describe('profile backup IPC handlers', () => {
  it('rejects every operation when there is no active profile', async () => {
    activeProfile = null;
    for (const channel of [
      'profile:createBackup', 'profile:listBackups', 'profile:getBackupMetadata',
      'profile:restoreBackup', 'profile:deleteBackup', 'profile:getBackupSettings',
      'profile:saveBackupSettings'
    ]) {
      await expect(invoke(channel, 'backup-1')).resolves.toEqual({
        success: false, error: 'No active profile'
      });
    }
  });

  it('delegates create, list, metadata, restore, and delete with the active profile', async () => {
    backup.createBackup.mockResolvedValue({ success: true, backupId: 'backup-1' });
    backup.listBackups.mockResolvedValue({ success: true, backups: [] });
    backup.getBackupMetadata.mockResolvedValue({ success: true, metadata: {} });
    backup.restoreBackup.mockResolvedValue({ success: true });
    backup.deleteBackup.mockResolvedValue({ success: true });

    await invoke('profile:createBackup');
    await invoke('profile:listBackups');
    await invoke('profile:getBackupMetadata');
    await invoke('profile:restoreBackup', 'backup-1');
    await invoke('profile:deleteBackup', 'backup-1');

    expect(backup.createBackup).toHaveBeenCalledWith('Default User', { mode: 'manual' });
    expect(backup.listBackups).toHaveBeenCalledWith('Default User');
    expect(backup.getBackupMetadata).toHaveBeenCalledWith('Default User');
    expect(backup.restoreBackup).toHaveBeenCalledWith('Default User', 'backup-1');
    expect(backup.deleteBackup).toHaveBeenCalledWith('Default User', 'backup-1');
  });

  it('returns default settings when the profile has none', async () => {
    profiles.loadProfilePreferences.mockResolvedValue({ screen_mode: 'dark' });
    const result = await invoke('profile:getBackupSettings');
    expect(result).toMatchObject({
      success: true,
      settings: { autoBackupEnabled: true, backupInterval: 1800000, maxBackupCount: 25 }
    });
  });

  it('merges backup settings without losing other preferences', async () => {
    const settings = { autoBackupEnabled: false, maxBackupCount: 3 };
    profiles.loadProfilePreferences.mockResolvedValue({ screen_mode: 'dark' });
    profiles.saveProfilePreferences.mockResolvedValue(true);

    await expect(invoke('profile:saveBackupSettings', settings)).resolves.toEqual({ success: true });
    expect(profiles.saveProfilePreferences).toHaveBeenCalledWith('Default User', {
      screen_mode: 'dark', backup_settings: settings
    });
  });

  it('wraps manager exceptions instead of rejecting IPC calls', async () => {
    backup.createBackup.mockRejectedValue(new Error('disk unavailable'));
    await expect(invoke('profile:createBackup')).resolves.toEqual({
      success: false, error: 'disk unavailable'
    });
  });
});
