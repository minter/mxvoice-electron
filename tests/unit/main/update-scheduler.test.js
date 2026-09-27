import { describe, expect, it, vi } from 'vitest';
import {
  BACKGROUND_UPDATE_INTERVAL_MS,
  decideUpdateNotice,
  runBackgroundCheck,
  startBackgroundUpdateChecks,
} from '../../../src/main/modules/update-scheduler.js';

describe('decideUpdateNotice', () => {
  it('opens the release-notes modal for launch and user-initiated checks', () => {
    expect(decideUpdateNotice({ version: '4.3.3', background: false, lastQuietVersion: null })).toBe('modal');
  });

  it('shows the quiet indicator for a background check', () => {
    expect(decideUpdateNotice({ version: '4.3.3', background: true, lastQuietVersion: null })).toBe('quiet');
  });

  it('does nothing when a background check finds a version already announced quietly', () => {
    expect(decideUpdateNotice({ version: '4.3.3', background: true, lastQuietVersion: '4.3.3' })).toBe('none');
  });

  it('announces a newer version found by a later background check', () => {
    expect(decideUpdateNotice({ version: '4.3.4', background: true, lastQuietVersion: '4.3.3' })).toBe('quiet');
  });

  it('leaves the version unannounced when there is no live window (macOS window closed)', () => {
    expect(decideUpdateNotice({ version: '4.3.3', background: true, lastQuietVersion: null, windowAvailable: false })).toBe('none');
    expect(decideUpdateNotice({ version: '4.3.3', background: false, lastQuietVersion: null, windowAvailable: false })).toBe('none');
  });
});

describe('runBackgroundCheck', () => {
  it('marks the check as background while it runs, then clears the flag', async () => {
    const updateState = { downloaded: false };
    let flagDuringCheck;
    const autoUpdater = { checkForUpdates: vi.fn(async () => { flagDuringCheck = updateState.backgroundCheck; }) };

    await expect(runBackgroundCheck({ autoUpdater, updateState })).resolves.toBe(true);

    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    expect(flagDuringCheck).toBe(true);
    expect(updateState.backgroundCheck).toBe(false);
  });

  it('swallows a failed check (the updater error handler reports it)', async () => {
    const updateState = { downloaded: false };
    const autoUpdater = { checkForUpdates: vi.fn(async () => { throw new Error('offline'); }) };

    await expect(runBackgroundCheck({ autoUpdater, updateState })).resolves.toBe(true);
    expect(updateState.backgroundCheck).toBe(false);
  });

  it.each([
    ['an update is downloading', { downloading: true }],
    ['an update is already downloaded', { downloaded: true }],
    ['a background check is already running', { backgroundCheck: true }],
  ])('skips when %s', async (_label, state) => {
    const autoUpdater = { checkForUpdates: vi.fn() };

    await expect(runBackgroundCheck({ autoUpdater, updateState: { downloaded: false, ...state } })).resolves.toBe(false);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('runs again once a download has hung for 30 minutes without settling', async () => {
    const autoUpdater = { checkForUpdates: vi.fn(async () => {}) };
    const updateState = { downloaded: false, downloading: true, downloadStartedAt: 0 };

    await expect(runBackgroundCheck({ autoUpdater, updateState, now: () => 30 * 60 * 1000 })).resolves.toBe(true);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });

  it('skips when there is no updater', async () => {
    await expect(runBackgroundCheck({ autoUpdater: null, updateState: {} })).resolves.toBe(false);
  });
});

describe('startBackgroundUpdateChecks', () => {
  it('re-checks every 12 hours without keeping the process alive, and can be stopped', async () => {
    const timer = { unref: vi.fn() };
    const setIntervalFn = vi.fn(() => timer);
    const clearIntervalFn = vi.fn();
    const autoUpdater = { checkForUpdates: vi.fn(async () => {}) };

    const stop = startBackgroundUpdateChecks({ autoUpdater, updateState: {}, setIntervalFn, clearIntervalFn });

    expect(BACKGROUND_UPDATE_INTERVAL_MS).toBe(12 * 60 * 60 * 1000);
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), BACKGROUND_UPDATE_INTERVAL_MS);
    expect(timer.unref).toHaveBeenCalled();

    await setIntervalFn.mock.calls[0][0]();
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();

    stop();
    expect(clearIntervalFn).toHaveBeenCalledWith(timer);
  });
});
