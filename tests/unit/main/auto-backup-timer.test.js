import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const loadProfilePreferences = vi.fn();
const createBackupIfChanged = vi.fn();
const SAFE_INTERVAL = 15 * 60 * 1000;

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
    const settings = { autoBackupEnabled: true, backupInterval: SAFE_INTERVAL };
    loadProfilePreferences.mockResolvedValue({ backup_settings: settings });
    createBackupIfChanged.mockResolvedValue({ success: true, created: true, backupId: 'backup-1' });

    await timer.startAutoBackupTimer('Default User');
    await vi.advanceTimersByTimeAsync(SAFE_INTERVAL);

    expect(createBackupIfChanged).toHaveBeenCalledWith('Default User', expect.objectContaining(settings));
    expect(vi.getTimerCount()).toBe(1);
  });

  it('continues scheduling after a backup error', async () => {
    loadProfilePreferences.mockResolvedValue({
      backup_settings: { autoBackupEnabled: true, backupInterval: SAFE_INTERVAL }
    });
    createBackupIfChanged.mockRejectedValueOnce(new Error('disk full')).mockResolvedValue({ created: false });

    await timer.startAutoBackupTimer('Default User');
    await vi.advanceTimersByTimeAsync(SAFE_INTERVAL);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(SAFE_INTERVAL);
    expect(createBackupIfChanged).toHaveBeenCalledTimes(2);
  });

  it('switching profiles cancels the previous schedule', async () => {
    loadProfilePreferences.mockResolvedValue({
      backup_settings: { autoBackupEnabled: true, backupInterval: SAFE_INTERVAL }
    });
    createBackupIfChanged.mockResolvedValue({ created: false });

    await timer.startAutoBackupTimer('One');
    await timer.startAutoBackupTimer('Two');
    await vi.advanceTimersByTimeAsync(SAFE_INTERVAL);

    expect(createBackupIfChanged).toHaveBeenCalledOnce();
    expect(createBackupIfChanged).toHaveBeenCalledWith('Two', expect.any(Object));
    expect(timer.getCurrentProfile()).toBe('Two');
  });

  it('a backup still running when the same profile restarts does not leave a second timer', async () => {
    loadProfilePreferences.mockResolvedValue({
      backup_settings: { autoBackupEnabled: true, backupInterval: SAFE_INTERVAL }
    });
    let finishBackup;
    createBackupIfChanged.mockImplementationOnce(() => new Promise((resolve) => { finishBackup = resolve; }));

    await timer.startAutoBackupTimer('A');
    await vi.advanceTimersByTimeAsync(SAFE_INTERVAL); // A's backup starts and is still running
    await timer.startAutoBackupTimer('B'); // switch away...
    await timer.startAutoBackupTimer('A'); // ...and back
    finishBackup({ created: false });
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(1);
  });

  it('a start overtaken while its settings load schedules nothing', async () => {
    let releaseSettings;
    loadProfilePreferences
      .mockImplementationOnce(() => new Promise((resolve) => { releaseSettings = resolve; }))
      .mockResolvedValue({ backup_settings: { autoBackupEnabled: true, backupInterval: SAFE_INTERVAL } });

    const slowStart = timer.startAutoBackupTimer('Old');
    await timer.startAutoBackupTimer('New');
    releaseSettings({ backup_settings: { autoBackupEnabled: true, backupInterval: SAFE_INTERVAL } });
    await slowStart;

    expect(vi.getTimerCount()).toBe(1);
    createBackupIfChanged.mockResolvedValue({ created: false });
    await vi.advanceTimersByTimeAsync(SAFE_INTERVAL);
    expect(createBackupIfChanged).toHaveBeenCalledWith('New', expect.any(Object));
    expect(createBackupIfChanged).not.toHaveBeenCalledWith('Old', expect.any(Object));
  });

  it('does not honor a rapid interval from malformed profile settings', async () => {
    loadProfilePreferences.mockResolvedValue({
      backup_settings: {
        autoBackupEnabled: true,
        backupInterval: 1,
        maxBackupCount: -1,
        maxBackupAge: -1
      }
    });
    createBackupIfChanged.mockResolvedValue({ created: false });

    await timer.startAutoBackupTimer('Imported');
    await vi.advanceTimersByTimeAsync(1);
    expect(createBackupIfChanged).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync((30 * 60 * 1000) - 1);
    expect(createBackupIfChanged).toHaveBeenCalledWith('Imported', expect.objectContaining({
      backupInterval: 30 * 60 * 1000,
      maxBackupCount: 25,
      maxBackupAge: 30 * 24 * 60 * 60 * 1000
    }));
  });
});
