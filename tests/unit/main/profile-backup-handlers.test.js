import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };
const backup = {
  createBackup: vi.fn(), listBackups: vi.fn(), getBackupMetadata: vi.fn(),
  restoreBackup: vi.fn(), deleteBackup: vi.fn(), checkBackupRestorable: vi.fn()
};
const profiles = {
  loadProfilePreferences: vi.fn(), saveProfilePreferences: vi.fn()
};

vi.mock('electron', () => ({ default: { ipcMain }, ipcMain }));
vi.mock('../../../src/main/modules/profile-backup-manager.js', () => backup);
vi.mock('../../../src/main/modules/profile-manager.js', () => profiles);

const { register } = await import('../../../src/main/modules/ipc/profile-backup-handlers.js');
const debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
let activeProfile;
let showSession;
let recoveryStore;

function invoke(channel, ...args) {
  return handlers[channel]({}, ...args);
}

beforeEach(() => {
  vi.clearAllMocks();
  activeProfile = 'Default User';
  showSession = { end: vi.fn(async () => {}) };
  recoveryStore = { retirePlayed: vi.fn(async () => {}) };
  backup.checkBackupRestorable.mockResolvedValue({ success: true });
  register({ getCurrentProfile: () => activeProfile, debugLog, showSession, recoveryStore });
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

  it('restoreBackup retires the current recovery, and the played counts once the restore succeeds', async () => {
    const order = [];
    showSession.end.mockImplementation(async (reason) => { order.push(`end:${reason}`); });
    backup.restoreBackup.mockImplementation(async () => { order.push('restore'); return { success: true }; });
    recoveryStore.retirePlayed.mockImplementation(async (name) => { order.push(`retirePlayed:${name}`); });

    await expect(invoke('profile:restoreBackup', 'backup-1')).resolves.toEqual({ success: true });
    expect(order).toEqual(['end:backup-restore', 'restore', 'retirePlayed:Default User']);
  });

  it('a failed restore keeps the played counts', async () => {
    backup.restoreBackup.mockResolvedValue({ success: false, error: 'EBUSY' });
    await invoke('profile:restoreBackup', 'backup-1');
    backup.restoreBackup.mockRejectedValue(new Error('EPERM'));
    await invoke('profile:restoreBackup', 'backup-1');
    expect(recoveryStore.retirePlayed).not.toHaveBeenCalled();
  });

  it('a failed played retire after a successful restore is only logged', async () => {
    backup.restoreBackup.mockResolvedValue({ success: true });
    recoveryStore.retirePlayed.mockRejectedValue(new Error('EPERM'));
    await expect(invoke('profile:restoreBackup', 'backup-1')).resolves.toEqual({ success: true });
    expect(debugLog.warn).toHaveBeenCalledWith('Could not retire the played counts after restoring a backup', expect.objectContaining({ error: 'EPERM' }));
  });

  it('restores even if retiring the recovery fails', async () => {
    showSession.end.mockRejectedValue(new Error('recovery dir locked'));
    backup.restoreBackup.mockResolvedValue({ success: true });
    await expect(invoke('profile:restoreBackup', 'backup-1')).resolves.toEqual({ success: true });
    expect(backup.restoreBackup).toHaveBeenCalledWith('Default User', 'backup-1');
  });

  it('restore of a missing backup fails before ending the session', async () => {
    backup.checkBackupRestorable.mockResolvedValue({ success: false, error: 'Backup does not exist' });

    await expect(invoke('profile:restoreBackup', 'backup-1')).resolves.toEqual({
      success: false, error: 'Backup does not exist'
    });
    expect(backup.checkBackupRestorable).toHaveBeenCalledWith('Default User', 'backup-1');
    expect(showSession.end).not.toHaveBeenCalled();
    expect(backup.restoreBackup).not.toHaveBeenCalled();
  });

  it('a pre-check that throws fails before ending the session', async () => {
    backup.checkBackupRestorable.mockRejectedValue(new Error('metadata unreadable'));
    await expect(invoke('profile:restoreBackup', 'backup-1')).resolves.toEqual({
      success: false, error: 'metadata unreadable'
    });
    expect(showSession.end).not.toHaveBeenCalled();
  });

  it('a restore that fails after end returns sessionEnded', async () => {
    backup.restoreBackup.mockResolvedValue({ success: false, error: 'EBUSY: resource busy or locked' });
    await expect(invoke('profile:restoreBackup', 'backup-1')).resolves.toEqual({
      success: false, error: 'EBUSY: resource busy or locked', sessionEnded: true
    });
    expect(showSession.end).toHaveBeenCalledWith('backup-restore');

    // A throw after end is the same, and so is a failed end
    backup.restoreBackup.mockRejectedValue(new Error('EPERM'));
    await expect(invoke('profile:restoreBackup', 'backup-1')).resolves.toEqual({
      success: false, error: 'EPERM', sessionEnded: true
    });
    showSession.end.mockRejectedValue(new Error('recovery dir locked'));
    backup.restoreBackup.mockResolvedValue({ success: false, error: 'EBUSY' });
    await expect(invoke('profile:restoreBackup', 'backup-1')).resolves.toEqual({
      success: false, error: 'EBUSY', sessionEnded: true
    });
  });

  it('touches no session without an active profile', async () => {
    activeProfile = null;
    await invoke('profile:restoreBackup', 'backup-1');
    expect(showSession.end).not.toHaveBeenCalled();
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
