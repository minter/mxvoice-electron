import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSongsByIds = vi.fn();
const getSongById = vi.fn();
vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({
  secureDatabase: { getSongsByIds: (...a) => getSongsByIds(...a), getSongById: (...a) => getSongById(...a) }
}));
vi.mock('../../../src/renderer/modules/drag-drop/drag-drop-functions.js', () => ({ songDrag: vi.fn() }));
vi.mock('../../../src/renderer/modules/utils/index.js', () => ({
  customConfirm: vi.fn(), customPrompt: vi.fn(), scaleScrollable: vi.fn()
}));
vi.mock('../../../src/renderer/modules/preferences/profile-preference-adapter.js', () => ({ getPreference: vi.fn() }));

// A minimal tab: <div id="holding_tank_1" class="holding_tank active"> holding <li>s
function makeTab() {
  const items = [];
  const tab = {
    id: 'holding_tank_1',
    nodeType: 1,
    items,
    closest: () => tab,
    matches: (sel) => sel === 'div',
    querySelectorAll: () => items,
    querySelector: () => null,
    appendChild: (li) => { const i = items.indexOf(li); if (i >= 0) items.splice(i, 1); items.push(li); li.parentNode = tab; }
  };
  return tab;
}

vi.mock('../../../src/renderer/modules/dom-utils/index.js', () => ({
  default: { empty: () => { globalThis.__tab.items.length = 0; }, $: () => globalThis.__tab }
}));

globalThis.window = { debugLog: { info() {}, warn() {}, error() {}, debug() {} } };
const { default: initializeHoldingTank } = await import('../../../src/renderer/modules/holding-tank/index.js');
const saveProfileState = vi.fn(async () => {});
const tank = initializeHoldingTank({ moduleRegistry: { profileState: { saveProfileState } }, electronAPI: {} });

const row = (id) => ({ id, title: `T${id}`, artist: 'A', time: '0:01' });

describe('populateHoldingTank import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__tab = makeTab();
    globalThis.document = {
      querySelector: (sel) => {
        const m = sel.match(/list-group-item\[songid="(\d+)"\]/);
        if (m) return globalThis.__tab.items.find(li => li.getAttribute('songid') === m[1]) || null;
        return globalThis.__tab;
      },
      createElement: () => {
        const attrs = new Map();
        return { style: {}, setAttribute: (k, v) => attrs.set(k, v), getAttribute: k => attrs.get(k), addEventListener() {}, closest: () => globalThis.__tab, matches: () => true };
      }
    };
  });

  it('looks songs up once with no per-song queries', async () => {
    getSongsByIds.mockResolvedValue({ success: true, data: [row(1), row(2)] });

    const outcome = await tank.populateHoldingTank(['1', '2', '999']);

    expect(getSongsByIds).toHaveBeenCalledTimes(1);
    expect(getSongById).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ success: true, count: 2, dropped: 1 });
    expect(globalThis.__tab.items.map(li => li.getAttribute('songid'))).toEqual(['1', '2']);
    expect(tank.getHoldingTankSnapshot()[0].songIds).toEqual(['1', '2']);
  });

  it('adds a repeated id once and counts it once', async () => {
    getSongsByIds.mockResolvedValue({ success: true, data: [row(1), row(2)] });

    const outcome = await tank.populateHoldingTank(['1', '2', '1']);

    expect(outcome).toMatchObject({ count: 2, dropped: 0 });
    expect(globalThis.__tab.items).toHaveLength(2);
    expect(getSongsByIds.mock.calls[0][0]).toEqual(['1', '2']);
  });

  it('leaves the tab untouched and reports every id when none are in the library', async () => {
    getSongsByIds.mockResolvedValue({ success: true, data: [] });
    globalThis.__tab.items.push({ getAttribute: () => '7' });
    const before = tank.getHoldingTankSnapshot();

    const outcome = await tank.populateHoldingTank(['5', '6', '5']);

    // success: false makes the bridge say the file has no songs, untracked
    expect(outcome).toMatchObject({ success: false, dropped: 2 });
    expect(globalThis.__tab.items).toHaveLength(1);
    expect(tank.getHoldingTankSnapshot()).toEqual(before);
    expect(saveProfileState).not.toHaveBeenCalled();
  });
});
