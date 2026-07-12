import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.attributes = new Map();
    this.children = [];
    this.textContent = '';
    this.style = {};
    this.className = '';
    this.draggable = false;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener() {}
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren() { this.children = []; }
  querySelector(selector) {
    if (selector === 'span.song') return this.span || null;
    const match = selector.match(/^\[id\^="(.+)_hotkey"\]$/);
    return match ? this.hotkeys?.[match[1]] || null : null;
  }
}

function createFakeDocument() {
  const ids = new Map();
  const hotkeyLinks = Array.from({ length: 5 }, () => new FakeElement());
  const holdingLinks = Array.from({ length: 5 }, () => new FakeElement());
  for (let tabNumber = 1; tabNumber <= 5; tabNumber++) {
    const hotkeyTab = new FakeElement(`hotkeys_list_${tabNumber}`);
    hotkeyTab.hotkeys = {};
    for (let keyNumber = 1; keyNumber <= 12; keyNumber++) {
      const key = `f${keyNumber}`;
      const slot = new FakeElement(`${key}_hotkey_t${tabNumber}`);
      slot.span = new FakeElement();
      hotkeyTab.hotkeys[key] = slot;
    }
    ids.set(hotkeyTab.id, hotkeyTab);
    ids.set(`holding_tank_${tabNumber}`, new FakeElement(`holding_tank_${tabNumber}`));
  }
  return {
    ids,
    hotkeyLinks,
    holdingLinks,
    getElementById: id => ids.get(id) || null,
    createElement: () => new FakeElement(),
    querySelectorAll: () => [],
    querySelector(selector) {
      let match = selector.match(/^#hotkey_tabs \.nav-item:nth-child\((\d)\) a$/);
      if (match) return hotkeyLinks[Number(match[1]) - 1];
      match = selector.match(/^#holding_tank_tabs \.nav-item:nth-child\((\d)\) a$/);
      if (match) return holdingLinks[Number(match[1]) - 1];
      return null;
    }
  };
}

globalThis.window = { debugLog: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } };
globalThis.document = createFakeDocument();
const { HotkeysModule } = await import('../../../src/renderer/modules/hotkeys/index.js');
const { default: HotkeyState } = await import('../../../src/renderer/modules/hotkeys/hotkey-state.js');
const { restoreHoldingTankSnapshot } = await import('../../../src/renderer/modules/holding-tank/index.js');

describe('state model rendering', () => {
  beforeEach(() => {
    globalThis.document = createFakeDocument();
  });

  it('renders renamed and hidden hotkey tabs while clearing empty slots', async () => {
    const module = Object.create(HotkeysModule.prototype);
    module.state = new HotkeyState();
    module.electronAPI = { database: { getSongsByIds: vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: 17, title: 'Entrance', artist: 'Cast', time: '0:12' }]
    }) } };
    const staleSlot = document.getElementById('hotkeys_list_2').hotkeys.f2;
    staleSlot.setAttribute('songid', 'stale');
    staleSlot.span.textContent = 'Stale label';

    await module.restoreHotkeySnapshot([
      { tabNumber: 2, tabName: 'Act Two', hotkeys: { f1: '17' } }
    ]);

    expect(document.hotkeyLinks[1].textContent).toBe('Act Two');
    expect(document.getElementById('hotkeys_list_2').hotkeys.f1.getAttribute('songid')).toBe('17');
    expect(document.getElementById('hotkeys_list_2').hotkeys.f1.span.textContent).toBe('Entrance by Cast (0:12)');
    expect(staleSlot.getAttribute('songid')).toBeNull();
    expect(staleSlot.span.textContent).toBe('');
  });

  it('filters missing songs and renders ordered holding-tank entries on hidden tabs', async () => {
    window.secureElectronAPI = { database: { getSongsByIds: vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: 18, title: 'Finale', artist: 'Cast', time: '1:00' }]
    }) } };

    const snapshot = await restoreHoldingTankSnapshot([
      { tabNumber: 4, tabName: 'Finale', songIds: ['missing', '18'] }
    ]);

    expect(document.holdingLinks[3].textContent).toBe('Finale');
    expect(document.getElementById('holding_tank_4').children).toHaveLength(1);
    expect(document.getElementById('holding_tank_4').children[0].textContent).toBe('Finale by Cast (1:00)');
    expect(snapshot[3].songIds).toEqual(['18']);
  });
});
