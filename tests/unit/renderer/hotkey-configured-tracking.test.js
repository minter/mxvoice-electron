import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();
globalThis.window = { secureElectronAPI: { analytics: { trackEvent } } };
// hotkey-ui.js wires highlight delegation at import time
globalThis.document = { querySelectorAll: () => [] };

const { hotkeyDrop } = await import('../../../src/renderer/modules/hotkeys/hotkey-ui.js');

function dropEvent(songId) {
  return {
    preventDefault: vi.fn(),
    dataTransfer: { getData: () => songId },
    currentTarget: { id: 'f1_hotkey' },
  };
}

describe('hotkey_configured tracking on drop', () => {
  let hotkeys;

  beforeEach(() => {
    trackEvent.mockClear();
    hotkeys = {
      assignHotkey: vi.fn(() => true),
      setLabelFromSongId: vi.fn(() => Promise.resolve()),
      requestProfileStateSave: vi.fn(),
    };
  });

  it('tracks a drop that changes the hotkey assignment', () => {
    hotkeyDrop.call(hotkeys, dropEvent('42'));

    expect(trackEvent).toHaveBeenCalledWith('hotkey_configured', { method: 'drag_drop' });
    expect(hotkeys.setLabelFromSongId).toHaveBeenCalledWith('42', expect.anything());
  });

  it('does not track a drop that leaves the assignment unchanged', () => {
    hotkeys.assignHotkey.mockReturnValue(false);

    hotkeyDrop.call(hotkeys, dropEvent('42'));

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does not track a drop without a song', () => {
    hotkeyDrop.call(hotkeys, dropEvent(''));

    expect(hotkeys.assignHotkey).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
