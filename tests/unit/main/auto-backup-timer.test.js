import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const loadProfilePreferences = vi.fn();
const createBackupIfChanged = vi.fn();

vi.mock('../../../src/main/modules/profile-manager.js', () => ({ loadProfilePreferences }));
vi.mock('../../../src/main/modules/profile-backup-manager.js', () => ({ createBackupIfChanged }));

const timer = await import('../../../src/main/modules/auto-backup-timer.js');

describe('auto-backup timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    timer.stopAutoBackupTimer();
    timer.initializeAutoBackupTimer({
      debugLog: { info: vi.fn(), debug: vi.fn(), error: vi.fn() }
    });
  });

  afterEach(() => {
    timer.stopAutoBackupTimer();
    vi.useRealTimers();
  });

  it('does not schedule when automatic backups are disabled', async () => {
    loadProfilePreferences.mockResolvedValue({ backup_settings: { autoBackupEnabled: false } });
    await timer.startAutoBackupTimer('Quiet Profile');
    expect(timer.getCurrentProfile()).toBe('Quiet Profile');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('runs at the configured interval and reschedules', async () => {
    const settings = { autoBackupEnabled: true, backupInterval: 1000 };
    loadProfilePreferences.mockResolvedValue({ backup_settings: settings });
    createBackupIfChanged.mockResolvedValue({ success: true, created: true, backupId: 'backup-1' });

    await timer.startAutoBackupTimer('Default User');
    await vi.advanceTimersByTimeAsync(1000);

    expect(createBackupIfChanged).toHaveBeenCalledWith('Default User', settings);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('continues scheduling after a backup error', async () => {
    loadProfilePreferences.mockResolvedValue({
      backup_settings: { autoBackupEnabled: true, backupInterval: 250 }
    });
    createBackupIfChanged.mockRejectedValueOnce(new Error('disk full')).mockResolvedValue({ created: false });

    await timer.startAutoBackupTimer('Default User');
    await vi.advanceTimersByTimeAsync(250);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(createBackupIfChanged).toHaveBeenCalledTimes(2);
  });

  it('switching profiles cancels the previous schedule', async () => {
    loadProfilePreferences.mockResolvedValue({
      backup_settings: { autoBackupEnabled: true, backupInterval: 1000 }
    });
    createBackupIfChanged.mockResolvedValue({ created: false });

    await timer.startAutoBackupTimer('One');
    await timer.startAutoBackupTimer('Two');
    await vi.advanceTimersByTimeAsync(1000);

    expect(createBackupIfChanged).toHaveBeenCalledOnce();
    expect(createBackupIfChanged).toHaveBeenCalledWith('Two', expect.any(Object));
    expect(timer.getCurrentProfile()).toBe('Two');
  });
});
