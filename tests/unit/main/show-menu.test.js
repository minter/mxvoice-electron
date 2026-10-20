import { describe, expect, it, vi } from 'vitest';
import { buildBoardMenu } from '../../../src/main/modules/board-menu.js';

const boards = [
  { id: 'b1', name: 'Comedy Sports' },
  { id: 'b2', name: 'Mom & Pop' }
];
const readyState = (activeId = 'b1') => ({
  status: 'ready',
  activeBoard: boards.find((b) => b.id === activeId),
  boards
});

function build(state, platform = 'darwin') {
  const calls = [];
  const send = vi.fn((command, boardId) => calls.push(`send:${command}:${boardId}`));
  const rebuild = vi.fn(() => calls.push('rebuild'));
  const fileOperations = { loadHotkeysFile: vi.fn(), loadHoldingTankFile: vi.fn() };
  const menu = buildBoardMenu(state, { platform, send, fileOperations, rebuild });
  return { menu, send, rebuild, calls, fileOperations };
}
const labels = (menu) => menu.submenu.map((i) => i.label ?? '---');
const find = (menu, label) => menu.submenu.find((i) => i.label === label);
const walk = (items, fn) => items.forEach((i) => { fn(i); if (i.submenu) walk(i.submenu, fn); });

describe('board menu', () => {
  it('lists boards as radio items with the active one checked', () => {
    const { menu } = build(readyState('b2'));
    expect(menu.label).toBe('Board');
    expect(menu.submenu[0]).toMatchObject({ label: 'Comedy Sports', type: 'radio', checked: false });
    expect(menu.submenu[1]).toMatchObject({ label: 'Mom & Pop', type: 'radio', checked: true });
  });

  it('uses the specified items in order', () => {
    const { menu } = build(readyState());
    expect(labels(menu)).toEqual([
      'Comedy Sports', 'Mom & Pop', '---', 'Update "Comedy Sports"', 'New Board…',
      'Revert to "Comedy Sports"', 'Rename Board', 'Delete Board', '---',
      'Import Board…', 'Import Hotkey File…', 'Import Holding Tank File…'
    ]);
    expect(find(menu, 'Rename Board').submenu.map((i) => i.label)).toEqual(['Comedy Sports…', 'Mom & Pop…']);
  });

  it('names the active board in Update and Revert', () => {
    const { menu } = build(readyState());
    expect(find(menu, 'Update "Comedy Sports"')).toBeTruthy();
    expect(find(menu, 'Revert to "Comedy Sports"')).toBeTruthy();
  });

  it('sends commands with board ids', () => {
    const { menu, send } = build(readyState());
    menu.submenu[1].click();
    find(menu, 'Update "Comedy Sports"').click();
    find(menu, 'New Board…').click();
    find(menu, 'Revert to "Comedy Sports"').click();
    find(menu, 'Rename Board').submenu[1].click();
    find(menu, 'Delete Board').submenu[0].click();
    find(menu, 'Import Board…').click();
    expect(send.mock.calls).toEqual([
      ['switch', 'b2'], ['update', undefined], ['new', undefined], ['revert', undefined],
      ['rename', 'b2'], ['delete', 'b1'], ['import', undefined]
    ]);
  });

  // Electron moves the radio check natively; the renderer may drop the
  // switch, so the menu is rebuilt from the session's state straight away
  it('clicking a non-active board sends switch and then rebuilds the menu', async () => {
    const { menu, calls } = build(readyState());
    menu.submenu[1].click();
    expect(calls).toEqual(['send:switch:b2']);
    await new Promise((r) => setImmediate(r));
    expect(calls).toEqual(['send:switch:b2', 'rebuild']);
  });

  it('clicking the active board sends no command', () => {
    const { menu, send } = build(readyState());
    menu.submenu[0].click();
    expect(send).not.toHaveBeenCalled();
  });

  it('runs the legacy imports in main, not through send', () => {
    const { menu, send, fileOperations } = build(readyState());
    find(menu, 'Import Hotkey File…').click();
    find(menu, 'Import Holding Tank File…').click();
    expect(fileOperations.loadHotkeysFile).toHaveBeenCalledOnce();
    expect(fileOperations.loadHoldingTankFile).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it('disables board commands unless status is ready', () => {
    for (const status of ['idle', 'loading', 'failed', 'unreadable']) {
      const { menu } = build({ ...readyState(), status });
      walk(menu.submenu, (item) => {
        if (item.type === 'separator') return;
        const legacy = /^Import (Hotkey|Holding Tank) File/.test(item.label);
        expect(item.enabled, `${status}: ${item.label}`).toBe(legacy ? undefined : false);
      });
    }
    const { menu } = build(readyState());
    expect(find(menu, 'New Board…').enabled).toBe(true);
  });

  it('renders nameless disabled items and no boards without a session', () => {
    const { menu } = build({ status: 'idle', activeBoard: null, boards: [] });
    expect(labels(menu)).toEqual([
      '---', 'Update', 'New Board…', 'Revert to', 'Rename Board', 'Delete Board', '---',
      'Import Board…', 'Import Hotkey File…', 'Import Holding Tank File…'
    ]);
    expect(find(menu, 'Update').enabled).toBe(false);
  });

  it('escapes & on win32 and linux, not on darwin', () => {
    const state = readyState('b2');
    expect(find(build(state, 'darwin').menu, 'Update "Mom & Pop"')).toBeTruthy();
    for (const platform of ['win32', 'linux']) {
      const { menu } = build(state, platform);
      expect(menu.submenu[1].label).toBe('Mom && Pop');
      expect(find(menu, 'Update "Mom && Pop"')).toBeTruthy();
      expect(find(menu, 'Revert to "Mom && Pop"')).toBeTruthy();
      expect(find(menu, 'Delete Board').submenu[1].label).toBe('Mom && Pop…');
    }
  });

  it('has no accelerators and no Open/Save wording', () => {
    const { menu } = build(readyState());
    walk(menu.submenu, (item) => {
      expect(item.accelerator).toBeUndefined();
      expect(item.label ?? '').not.toMatch(/\b(Open|Save)\b/);
    });
  });
});
