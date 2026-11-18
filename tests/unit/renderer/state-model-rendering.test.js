import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.attributes = new Map();
    this.children = [];
    this.title = '';
    // Like the DOM: reads through to the children, and setting it replaces them
    let ownText = '';
    Object.defineProperty(this, 'textContent', {
      get: () => ownText + this.children.map((child) => child.textContent ?? '').join(''),
      set: (value) => { ownText = String(value ?? ''); this.children = []; }
    });
    this.style = {};
    this.className = '';
    this.draggable = false;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener() {}
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
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
const { collectSongIds: collectHoldingTankSongIds, applyHoldingTankSnapshot, getHoldingTankSnapshot } = await import('../../../src/renderer/modules/holding-tank/index.js');
const hotkeyOperations = await import('../../../src/renderer/modules/hotkeys/hotkey-operations.js');

describe('state model rendering', () => {
  beforeEach(() => {
    globalThis.document = createFakeDocument();
  });

  it('renders renamed and hidden hotkey tabs while clearing empty slots', () => {
    const module = Object.create(HotkeysModule.prototype);
    module.state = new HotkeyState();
    const staleSlot = document.getElementById('hotkeys_list_2').hotkeys.f2;
    staleSlot.setAttribute('songid', 'stale');
    staleSlot.span.textContent = 'Stale label';

    module.applyHotkeySnapshot([
      { tabNumber: 2, tabName: 'Act Two', hotkeys: { f1: '17' } }
    ], new Map([['17', { id: 17, title: 'Entrance', artist: 'Cast', time: '0:12' }]]));

    expect(document.hotkeyLinks[1].textContent).toBe('Act Two');
    expect(document.getElementById('hotkeys_list_2').hotkeys.f1.getAttribute('songid')).toBe('17');
    expect(document.getElementById('hotkeys_list_2').hotkeys.f1.span.textContent).toBe('Entrance by Cast (0:12)');
    expect(staleSlot.getAttribute('songid')).toBeNull();
    expect(staleSlot.span.textContent).toBe('');
  });

  it('filters missing songs and renders ordered holding-tank entries on hidden tabs', () => {
    applyHoldingTankSnapshot([
      { tabNumber: 4, tabName: 'Finale', songIds: ['missing', '18'] }
    ], new Map([['18', { id: 18, title: 'Finale', artist: 'Cast', time: '1:00' }]]));

    expect(document.holdingLinks[3].textContent).toBe('Finale');
    expect(document.getElementById('holding_tank_4').children).toHaveLength(1);
    expect(document.getElementById('holding_tank_4').children[0].textContent).toBe('Finale by Cast (1:00)');
    expect(getHoldingTankSnapshot()[3].songIds).toEqual(['18']);
  });

  it('collects distinct hotkey song ids and applies a hotkey snapshot synchronously', () => {
    const module = Object.create(HotkeysModule.prototype);
    module.state = new HotkeyState();
    const snapshot = [
      { tabNumber: 1, tabName: 'One', hotkeys: { f1: 17, f2: '18' } },
      { tabNumber: 3, tabName: null, hotkeys: { f5: '17', f6: '' } }
    ];

    expect(module.collectSongIds(snapshot).sort()).toEqual(['17', '18']);
    const result = module.applyHotkeySnapshot(snapshot, new Map([
      ['17', { id: 17, title: 'Entrance', artist: 'Cast', time: '0:12' }]
    ]));

    expect(result).toEqual({ dropped: 1 });
    expect(module.getHotkeySnapshot()[0]).toEqual({ tabNumber: 1, tabName: 'One', hotkeys: { f1: '17' } });
    expect(module.getHotkeySnapshot()[2].hotkeys).toEqual({ f5: '17' });
    expect(document.getElementById('hotkeys_list_1').hotkeys.f1.getAttribute('songid')).toBe('17');
    expect(document.getElementById('hotkeys_list_1').hotkeys.f2.getAttribute('songid')).toBeNull();
    expect(document.hotkeyLinks[0].textContent).toBe('One');
  });

  it('collects distinct holding-tank song ids and applies a holding-tank snapshot synchronously', () => {
    const snapshot = [
      { tabNumber: 1, tabName: null, songIds: ['18', 'gone', '18'] },
      { tabNumber: 2, tabName: 'Two', songIds: ['gone'] }
    ];

    expect(collectHoldingTankSongIds(snapshot).sort()).toEqual(['18', 'gone']);
    const result = applyHoldingTankSnapshot(snapshot, new Map([
      ['18', { id: 18, title: 'Finale', artist: 'Cast', time: '1:00' }]
    ]));

    expect(result).toEqual({ dropped: 1 });
    expect(document.getElementById('holding_tank_1').children).toHaveLength(2);
    expect(document.getElementById('holding_tank_2').children).toHaveLength(0);
    expect(document.holdingLinks[1].textContent).toBe('Two');
  });

  it('exports hotkey file data from the state model rather than rendered attributes', () => {
    const config = hotkeyOperations.exportHotkeyConfig.call({
      getActiveTabNumber: () => 2,
      getHotkeySnapshot: () => [
        { tabNumber: 1, tabName: null, hotkeys: {} },
        { tabNumber: 2, tabName: 'Act Two', hotkeys: { f1: '17', f12: '18' } }
      ]
    });

    expect(config.hotkeys).toEqual({ f1: '17', f12: '18' });
    expect(config.title).toBe('Act Two');
  });
});
