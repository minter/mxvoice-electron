import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSquirrelReadiness, createUpdateInstaller } from '../../../src/main/modules/update-install.js';

function setup({ timeoutMs = 15000, installReadyTimeoutMs, prepareError = null, quitThrows = null, squirrel = false } = {}) {
  const updater = new EventEmitter();
  // The app's own error handler (index-modular.js) is always attached
  updater.on('error', () => {});
  // Electron's native autoUpdater
  const native = new EventEmitter();
  native.on('error', () => {});
  const app = new EventEmitter();
  const order = [];
  const prepareForUpdateInstall = vi.fn(async () => {
    order.push('prepare');
    if (prepareError) throw prepareError;
  });
  updater.quitAndInstall = vi.fn(() => {
    order.push('quitAndInstall');
    if (quitThrows) throw quitThrows;
  });
  const readiness = squirrel ? createSquirrelReadiness({ nativeUpdater: native, updater }) : null;
  const cancelHandoff = vi.fn(async () => {});
  const handOffAgain = vi.fn(async () => {});
  const notifyInstallFailed = vi.fn();
  const debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const onNative = (listener) => {
    native.on('before-quit-for-update', listener);
    return () => native.removeListener('before-quit-for-update', listener);
  };
  const installUpdateNow = createUpdateInstaller({
    prepareForUpdateInstall,
    getAutoUpdater: () => updater,
    waitForInstallReady: readiness ? () => readiness.waitUntilReady() : undefined,
    cancelHandoff,
    handOffAgain,
    onQuitStarted: (listener) => {
      app.on('before-quit', listener);
      const off = onNative(listener);
      return () => {
        app.removeListener('before-quit', listener);
        off();
      };
    },
    onQuitForUpdate: onNative,
    notifyInstallFailed,
    debugLog,
    timeoutMs,
    ...(installReadyTimeoutMs === undefined ? {} : { installReadyTimeoutMs }),
  });
  // The persistent backstop listener is always there
  const nativeQuitBaseline = native.listenerCount('before-quit-for-update');
  return {
    installUpdateNow, updater, native, app, order, prepareForUpdateInstall, cancelHandoff, handOffAgain,
    notifyInstallFailed, debugLog, nativeQuitBaseline,
  };
}

describe('update install', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('saves and hands off before quitting to install', async () => {
    const ctx = setup();
    await ctx.installUpdateNow();
    expect(ctx.order).toEqual(['prepare', 'quitAndInstall']);
  });

  it('still installs when the save before it fails', async () => {
    const ctx = setup({ prepareError: new Error('flush failed') });
    await ctx.installUpdateNow();
    expect(ctx.updater.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(ctx.debugLog.warn).toHaveBeenCalled();
  });

  it('installUpdateNow cancels the handoff on an updater error', async () => {
    const ctx = setup();
    await ctx.installUpdateNow();
    ctx.updater.emit('error', new Error('signature mismatch'));
    await vi.runAllTimersAsync();

    expect(ctx.cancelHandoff).toHaveBeenCalledTimes(1);
    expect(ctx.notifyInstallFailed).toHaveBeenCalledTimes(1);
    expect(ctx.debugLog.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ module: 'update-install', error: 'signature mismatch' })
    );
    // The attempt's listeners are gone
    expect(ctx.updater.listenerCount('error')).toBe(1);
    expect(ctx.app.listenerCount('before-quit')).toBe(0);
  });

  it('installUpdateNow cancels the handoff when no quit starts within the timeout', async () => {
    const ctx = setup({ timeoutMs: 1000 });
    await ctx.installUpdateNow();
    await vi.advanceTimersByTimeAsync(999);
    expect(ctx.cancelHandoff).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(ctx.cancelHandoff).toHaveBeenCalledTimes(1);
    expect(ctx.notifyInstallFailed).toHaveBeenCalledTimes(1);
    expect(ctx.debugLog.warn).toHaveBeenCalled();
    expect(ctx.updater.listenerCount('error')).toBe(1);
    expect(ctx.app.listenerCount('before-quit')).toBe(0);

    // A later error from the same updater doesn't cancel again
    ctx.updater.emit('error', new Error('late'));
    await vi.runAllTimersAsync();
    expect(ctx.cancelHandoff).toHaveBeenCalledTimes(1);
  });

  it('installUpdateNow cancels the handoff when quitAndInstall throws', async () => {
    const ctx = setup({ quitThrows: new Error('no update downloaded') });
    await ctx.installUpdateNow();
    await vi.runAllTimersAsync();
    expect(ctx.cancelHandoff).toHaveBeenCalledTimes(1);
    expect(ctx.notifyInstallFailed).toHaveBeenCalledTimes(1);
    expect(ctx.updater.listenerCount('error')).toBe(1);
  });

  it('installUpdateNow does not cancel once before-quit has fired', async () => {
    const ctx = setup({ timeoutMs: 1000 });
    await ctx.installUpdateNow();
    ctx.app.emit('before-quit');
    ctx.updater.emit('error', new Error('after quit began'));
    await vi.advanceTimersByTimeAsync(5000);

    expect(ctx.cancelHandoff).not.toHaveBeenCalled();
    expect(ctx.notifyInstallFailed).not.toHaveBeenCalled();
    expect(ctx.updater.listenerCount('error')).toBe(1);
    expect(ctx.app.listenerCount('before-quit')).toBe(0);
  });

  it('a second attempt after a failed one does not stack listeners', async () => {
    const ctx = setup({ timeoutMs: 1000 });
    await ctx.installUpdateNow();
    await vi.advanceTimersByTimeAsync(1000);
    await ctx.installUpdateNow();
    expect(ctx.updater.listenerCount('error')).toBe(2);
    expect(ctx.app.listenerCount('before-quit')).toBe(1);

    ctx.updater.emit('error', new Error('again'));
    await vi.runAllTimersAsync();
    expect(ctx.cancelHandoff).toHaveBeenCalledTimes(2);
    expect(ctx.updater.listenerCount('error')).toBe(1);
    expect(ctx.app.listenerCount('before-quit')).toBe(0);
  });

  it('a second call while an attempt is waiting reuses it', async () => {
    const ctx = setup({ timeoutMs: 1000 });
    await Promise.all([ctx.installUpdateNow(), ctx.installUpdateNow()]);
    expect(ctx.prepareForUpdateInstall).toHaveBeenCalledTimes(1);
    expect(ctx.updater.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(ctx.updater.listenerCount('error')).toBe(2);
  });

  it('a failing cancelHandoff or notice is logged, not thrown', async () => {
    const ctx = setup({ timeoutMs: 1000 });
    ctx.cancelHandoff.mockRejectedValueOnce(new Error('disk full'));
    ctx.notifyInstallFailed.mockImplementationOnce(() => { throw new Error('no window'); });
    await ctx.installUpdateNow();
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.debugLog.error).toHaveBeenCalledTimes(2);
  });
});

describe('update install on macOS (Squirrel.Mac)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not hand off or quit until Squirrel has the update, then starts the quit timer', async () => {
    const ctx = setup({ squirrel: true, timeoutMs: 1000 });
    const install = ctx.installUpdateNow();
    // Long past the quit timeout, short of the wait's ceiling: still waiting, session still live
    await vi.advanceTimersByTimeAsync(119_999);
    expect(ctx.prepareForUpdateInstall).not.toHaveBeenCalled();
    expect(ctx.updater.quitAndInstall).not.toHaveBeenCalled();
    expect(ctx.cancelHandoff).not.toHaveBeenCalled();
    expect(ctx.notifyInstallFailed).not.toHaveBeenCalled();
    // A second request while waiting reuses the wait
    expect(ctx.installUpdateNow()).toBe(install);

    ctx.native.emit('update-downloaded');
    await install;
    expect(ctx.order).toEqual(['prepare', 'quitAndInstall']);
    ctx.native.emit('before-quit-for-update');
    await vi.advanceTimersByTimeAsync(5000);
    expect(ctx.cancelHandoff).not.toHaveBeenCalled();
  });

  it('a Squirrel wait past 120000 ms drops the attempt, notifies, and a later Squirrel download does not quit', async () => {
    const ctx = setup({ squirrel: true, timeoutMs: 1000 });
    const install = ctx.installUpdateNow();
    await vi.advanceTimersByTimeAsync(119_999);
    expect(ctx.notifyInstallFailed).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await install;
    expect(ctx.notifyInstallFailed).toHaveBeenCalledTimes(1);
    expect(ctx.debugLog.warn).toHaveBeenCalledWith(
      'Squirrel did not have the update in time; the install is dropped', expect.objectContaining({ waitedMs: 120000 })
    );
    // Nothing was handed off, so nothing is given back
    expect(ctx.prepareForUpdateInstall).not.toHaveBeenCalled();
    expect(ctx.cancelHandoff).not.toHaveBeenCalled();

    // Squirrel finishes afterwards: the dropped attempt never quits
    ctx.native.emit('update-downloaded');
    await vi.advanceTimersByTimeAsync(5000);
    expect(ctx.prepareForUpdateInstall).not.toHaveBeenCalled();
    expect(ctx.updater.quitAndInstall).not.toHaveBeenCalled();
    expect(ctx.notifyInstallFailed).toHaveBeenCalledTimes(1);

    // A new request now that Squirrel has it installs at once
    await ctx.installUpdateNow();
    expect(ctx.order).toEqual(['prepare', 'quitAndInstall']);
  });

  it('the ceiling can be set', async () => {
    const ctx = setup({ squirrel: true, installReadyTimeoutMs: 500 });
    const install = ctx.installUpdateNow();
    await vi.advanceTimersByTimeAsync(500);
    await install;
    expect(ctx.notifyInstallFailed).toHaveBeenCalledTimes(1);
  });

  it('installs at once when Squirrel already has the update', async () => {
    const ctx = setup({ squirrel: true });
    ctx.native.emit('update-downloaded');
    await ctx.installUpdateNow();
    expect(ctx.order).toEqual(['prepare', 'quitAndInstall']);
  });

  it('an updater error while waiting for Squirrel does not hand off', async () => {
    const ctx = setup({ squirrel: true, timeoutMs: 1000 });
    const install = ctx.installUpdateNow();
    // A background check fails meanwhile
    ctx.updater.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(ctx.prepareForUpdateInstall).not.toHaveBeenCalled();
    expect(ctx.cancelHandoff).not.toHaveBeenCalled();
    expect(ctx.notifyInstallFailed).not.toHaveBeenCalled();

    ctx.native.emit('update-downloaded');
    await install;
    expect(ctx.updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('a Squirrel error while waiting only tells the user', async () => {
    const ctx = setup({ squirrel: true });
    const install = ctx.installUpdateNow();
    ctx.native.emit('error', new Error('Code signature did not pass validation'));
    await install;
    expect(ctx.notifyInstallFailed).toHaveBeenCalledTimes(1);
    expect(ctx.prepareForUpdateInstall).not.toHaveBeenCalled();
    expect(ctx.updater.quitAndInstall).not.toHaveBeenCalled();
    expect(ctx.cancelHandoff).not.toHaveBeenCalled();
    expect(ctx.debugLog.warn).toHaveBeenCalled();

    // Retrying the same fetch fails at once; a new download fetches again
    await ctx.installUpdateNow();
    expect(ctx.notifyInstallFailed).toHaveBeenCalledTimes(2);
    ctx.updater.emit('update-downloaded', { version: '9.9.9' });
    const retry = ctx.installUpdateNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.prepareForUpdateInstall).not.toHaveBeenCalled();
    ctx.native.emit('update-downloaded');
    await retry;
    expect(ctx.updater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('the native before-quit-for-update counts as the quit starting', async () => {
    const ctx = setup({ timeoutMs: 1000 });
    await ctx.installUpdateNow();
    ctx.native.emit('before-quit-for-update');
    await vi.advanceTimersByTimeAsync(5000);
    expect(ctx.cancelHandoff).not.toHaveBeenCalled();
    expect(ctx.app.listenerCount('before-quit')).toBe(0);
    expect(ctx.native.listenerCount('before-quit-for-update')).toBe(ctx.nativeQuitBaseline);
  });

  it('hands the session off again if the updater quits after it was given back', async () => {
    const ctx = setup({ timeoutMs: 1000 });
    // Not given back: the backstop does nothing
    await ctx.installUpdateNow();
    ctx.native.emit('before-quit-for-update');
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.handOffAgain).not.toHaveBeenCalled();

    await ctx.installUpdateNow();
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctx.cancelHandoff).toHaveBeenCalledTimes(1);
    ctx.native.emit('before-quit-for-update');
    // Synchronously, within the event: handoff() fences before its first await
    expect(ctx.handOffAgain).toHaveBeenCalledTimes(1);
    // Once
    ctx.native.emit('before-quit-for-update');
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.handOffAgain).toHaveBeenCalledTimes(1);
  });

  it('a failing hand-off-again is logged, not thrown', async () => {
    const ctx = setup({ timeoutMs: 1000 });
    ctx.handOffAgain.mockRejectedValueOnce(new Error('disk full'));
    await ctx.installUpdateNow();
    await vi.advanceTimersByTimeAsync(1000);
    ctx.native.emit('before-quit-for-update');
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.debugLog.error).toHaveBeenCalledWith('Could not hand the show session off again', expect.objectContaining({ error: 'disk full' }));
  });

  it('a hand-off-again that throws synchronously is logged, not thrown', async () => {
    const ctx = setup({ timeoutMs: 1000 });
    ctx.handOffAgain.mockImplementationOnce(() => { throw new Error('no session'); });
    await ctx.installUpdateNow();
    await vi.advanceTimersByTimeAsync(1000);
    expect(() => ctx.native.emit('before-quit-for-update')).not.toThrow();
    expect(ctx.debugLog.error).toHaveBeenCalledWith('Could not hand the show session off again', expect.objectContaining({ error: 'no session' }));
  });
});
