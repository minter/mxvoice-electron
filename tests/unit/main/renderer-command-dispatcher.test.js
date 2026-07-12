import { describe, expect, it, vi } from 'vitest';
import { createRendererCommandDispatcher } from '../../../src/main/modules/renderer-command-dispatcher.js';

describe('renderer command dispatcher', () => {
  it('sends named commands to the current window', () => {
    const send = vi.fn();
    const window = { isDestroyed: () => false, webContents: { send } };
    const commands = createRendererCommandDispatcher({ getWindow: () => window });

    expect(commands.toggleWaveform()).toBe(true);
    expect(commands.manageCategories()).toBe(true);
    expect(send).toHaveBeenNthCalledWith(1, 'toggle_wave_form');
    expect(send).toHaveBeenNthCalledWith(2, 'manage_categories');
  });

  it('resolves the current window for every command', () => {
    const firstSend = vi.fn();
    const secondSend = vi.fn();
    let currentWindow = { webContents: { send: firstSend } };
    const commands = createRendererCommandDispatcher({ getWindow: () => currentWindow });

    commands.closeAllTabs();
    currentWindow = { webContents: { send: secondSend } };
    commands.closeAllTabs();

    expect(firstSend).toHaveBeenCalledOnce();
    expect(secondSend).toHaveBeenCalledOnce();
  });

  it('does not send to a missing or destroyed window', () => {
    let currentWindow = null;
    const commands = createRendererCommandDispatcher({ getWindow: () => currentWindow });
    expect(commands.send('event')).toBe(false);

    currentWindow = { isDestroyed: () => true, webContents: { send: vi.fn() } };
    expect(commands.send('event')).toBe(false);
    expect(currentWindow.webContents.send).not.toHaveBeenCalled();
  });

  it('forwards command arguments', () => {
    const send = vi.fn();
    const commands = createRendererCommandDispatcher({
      getWindow: () => ({ webContents: { send } })
    });
    commands.send('custom', 1, { ready: true });
    expect(send).toHaveBeenCalledWith('custom', 1, { ready: true });
  });
});
