import { beforeEach, describe, expect, it, vi } from 'vitest';
const bind = vi.fn(); const unbind = vi.fn();
globalThis.Mousetrap = Object.assign(vi.fn(() => ({ bind, unbind })), { bind, unbind });
globalThis.window = { debugLog: { warn: vi.fn() } };
const { ShortcutRegistry } = await import('../../../src/renderer/modules/keyboard-manager/shortcut-registry.js');
const nav = await import('../../../src/renderer/modules/navigation/navigation-functions.js');

describe('shortcut registry', () => {
  beforeEach(() => vi.clearAllMocks());
  it('registers, detects conflicts, enables, executes, and removes shortcuts', () => {
    const registry = new ShortcutRegistry({ debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } });
    expect(registry.initialize()).toBe(true); const handler = vi.fn(() => true);
    expect(registry.registerShortcut('ctrl+s', handler, { category: 'file' })).toBe(true);
    expect(registry.registerShortcut('ctrl+s', vi.fn())).toBe(false); expect(registry.getConflicts()).toEqual(['ctrl+s']);
    const config = registry.getShortcut('ctrl+s'); expect(registry.executeHandler('ctrl+s', {}, config)).toBe(false); expect(handler).toHaveBeenCalled();
    expect(registry.setShortcutEnabled('ctrl+s', false)).toBe(true); expect(registry.executeHandler('ctrl+s', {}, config)).toBe(true);
    expect(registry.getStats()).toMatchObject({ totalShortcuts: 1, disabledShortcuts: 1, conflicts: 1 });
    expect(registry.unregisterShortcut('ctrl+s')).toBe(true); expect(unbind).toHaveBeenCalledWith('ctrl+s');
  });
});

describe('navigation functions', () => {
  it('routes selected songs to hotkeys and holding tank', async () => {
    const selected = { tagName: 'TR', getAttribute: () => '42' }; const target = { getAttribute: () => null };
    globalThis.document = { getElementById: () => selected, querySelectorAll: () => [target], querySelector: (s) => s.includes('songid=') ? null : {} };
    const setLabelFromSongId = vi.fn(); const addToHoldingTank = vi.fn(async () => ({ success: true })); const requestProfileStateSave = vi.fn();
    nav.configureNavigationDependencies({ moduleRegistry: { hotkeys: { setLabelFromSongId }, holdingTank: { addToHoldingTank, requestProfileStateSave } } });
    nav.sendToHotkeys(); nav.sendToHoldingTank(); await Promise.resolve();
    expect(setLabelFromSongId).toHaveBeenCalledWith('42', target); expect(addToHoldingTank).toHaveBeenCalledWith('42', expect.anything()); expect(requestProfileStateSave).toHaveBeenCalled();
  });
});
