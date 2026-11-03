import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = { getSongById: vi.fn() };
const confirm = vi.fn();
vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({
  secureDatabase: db, secureFileSystem: {}, securePath: {}, secureStore: {}, secureAnalytics: {}
}));
vi.mock('../../../src/renderer/modules/utils/index.js', () => ({ customConfirm: confirm }));

globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };

// No DOM library: elements with ids and attributes, and a document that finds them
function makeEl(id, attrs = {}) {
  const a = { ...attrs };
  const node = {
    id,
    getAttribute: (name) => (name in a ? a[name] : null),
    setAttribute: (name, value) => { a[name] = String(value); },
    removeAttribute: (name) => {
      if (name === 'id') node.id = '';
      else delete a[name];
    }
  };
  return node;
}
let elements = [];
globalThis.document = {
  getElementById: (id) => elements.find((node) => node.id === id) || null,
  querySelector: (selector) => {
    if (selector !== '[data-context-target="true"]') throw new Error(`unexpected selector ${selector}`);
    return elements.find((node) => node.getAttribute('data-context-target') === 'true') || null;
  },
  querySelectorAll: (selector) => {
    if (selector !== '[data-context-target]') throw new Error(`unexpected selector ${selector}`);
    return elements.filter((node) => node.getAttribute('data-context-target') !== null);
  }
};

const target = await import('../../../src/renderer/modules/ui/song-action-target.js');
const removal = await import('../../../src/renderer/modules/song-management/song-removal.js');

describe('song action target', () => {
  let searchRow; let f3; let f2;
  beforeEach(() => {
    vi.clearAllMocks();
    searchRow = makeEl('selected_row', { songid: '1004' });
    f3 = makeEl('f3_hotkey', { songid: '1005' });
    f2 = makeEl('f2_hotkey', { songid: '1001' });
    elements = [searchRow, f3, f2];
  });

  it('is #selected_row when no hotkey is marked', () => {
    expect(target.getSongActionTarget()).toBe(searchRow);
  });

  it('is the marked hotkey, which keeps its id, while one is marked', () => {
    target.markContextTarget(f3);
    expect(target.getSongActionTarget()).toBe(f3);
    expect(f3.id).toBe('f3_hotkey');
    expect(f3.getAttribute('data-context-target')).toBe('true');
  });

  it('marks one hotkey at a time', () => {
    target.markContextTarget(f3);
    target.markContextTarget(f2);
    expect(f3.getAttribute('data-context-target')).toBeNull();
    expect(target.getSongActionTarget()).toBe(f2);
  });

  it('falls back to #selected_row once the mark is cleared', () => {
    target.markContextTarget(f3);
    target.clearContextTarget();
    expect(f3.getAttribute('data-context-target')).toBeNull();
    expect(target.getSongActionTarget()).toBe(searchRow);
  });

  it('is null with nothing selected or marked', () => {
    elements = [f3];
    expect(target.getSongActionTarget()).toBeNull();
    target.markContextTarget(null);
    expect(target.getSongActionTarget()).toBeNull();
  });

  it('Remove from Hotkey clears the marked slot even after the confirm drops the mark', async () => {
    elements = [f3, f2];
    target.markContextTarget(f3);
    db.getSongById.mockResolvedValue({ success: true, data: [{ title: 'Eat It' }] });
    // Clicking the confirm dismisses the context menu, which clears the mark
    confirm.mockImplementation(async () => { target.clearContextTarget(); return true; });
    const hotkeys = { clearHotkeyElement: vi.fn(), requestProfileStateSave: vi.fn(async () => ({ success: true })) };
    removal.configureSongRemovalDependencies({ moduleRegistry: { hotkeys } });

    await expect(removal.removeFromHotkey()).resolves.toMatchObject({ success: true, songId: '1005' });
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to remove Eat It from this hotkey?');
    expect(hotkeys.clearHotkeyElement).toHaveBeenCalledWith(f3);
    expect(f3.id).toBe('f3_hotkey');
  });

  it('Remove from Hotkey clears nothing if the slot changed songs while the confirm was open', async () => {
    elements = [f3, f2];
    target.markContextTarget(f3);
    db.getSongById.mockResolvedValue({ success: true, data: [{ title: 'Eat It' }] });
    // A show switch lands while the confirm is open: F3 now holds another song
    confirm.mockImplementation(async () => { f3.setAttribute('songid', '1004'); return true; });
    const hotkeys = { clearHotkeyElement: vi.fn(), requestProfileStateSave: vi.fn(async () => ({ success: true })) };
    removal.configureSongRemovalDependencies({ moduleRegistry: { hotkeys } });

    await expect(removal.removeFromHotkey()).resolves.toMatchObject({ success: false });
    expect(hotkeys.clearHotkeyElement).not.toHaveBeenCalled();
    expect(hotkeys.requestProfileStateSave).not.toHaveBeenCalled();
    expect(f3.getAttribute('songid')).toBe('1004');
  });
});
