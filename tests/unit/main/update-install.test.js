import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUpdateInstaller } from '../../../src/main/modules/update-install.js';

function setup({ timeoutMs = 15000, prepareError = null, quitThrows = null } = {}) {
  const updater = new EventEmitter();
  // The app's own error handler (index-modular.js) is always attached
  updater.on('error', () => {});
  updater.quitAndInstall = vi.fn(() => {
    if (quitThrows) throw quitThrows;
  });
  const app = new EventEmitter();
  const order = [];
  const prepareForUpdateInstall = vi.fn(async () => {
    order.push('prepare');
    if (prepareError) throw prepareError;
  });
  updater.quitAndInstall.mockImplementation(() => {
    order.push('quitAndInstall');
    if (quitThrows) throw quitThrows;
  });
  const cancelHandoff = vi.fn(async () => {});
  const notifyInstallFailed = vi.fn();
  const debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const installUpdateNow = createUpdateInstaller({
    prepareForUpdateInstall,
    getAutoUpdater: () => updater,
    cancelHandoff,
    onQuitStarted: (listener) => {
      app.on('before-quit', listener);
      return () => app.removeListener('before-quit', listener);
    },
    notifyInstallFailed,
    debugLog,
    timeoutMs,
  });
  return { installUpdateNow, updater, app, order, prepareForUpdateInstall, cancelHandoff, notifyInstallFailed, debugLog };
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
