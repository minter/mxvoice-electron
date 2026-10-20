import { describe, expect, it, vi } from 'vitest';
import { buildShowMenu } from '../../../src/main/modules/show-menu.js';

const shows = [
  { id: 'b1', name: 'Comedy Sports' },
  { id: 'b2', name: 'Mom & Pop' }
];
const readyState = (activeId = 'b1') => ({
  status: 'ready',
  activeShow: shows.find((b) => b.id === activeId),
  shows
});

function build(state, platform = 'darwin') {
  const calls = [];
  const send = vi.fn((command, showId) => calls.push(`send:${command}:${showId}`));
  const rebuild = vi.fn(() => calls.push('rebuild'));
  const fileOperations = { loadHotkeysFile: vi.fn(), loadHoldingTankFile: vi.fn() };
  const menu = buildShowMenu(state, { platform, send, fileOperations, rebuild });
  return { menu, send, rebuild, calls, fileOperations };
}
const labels = (menu) => menu.submenu.map((i) => i.label ?? '---');
const find = (menu, label) => menu.submenu.find((i) => i.label === label);
const walk = (items, fn) => items.forEach((i) => { fn(i); if (i.submenu) walk(i.submenu, fn); });

describe('Shows menu', () => {
  it('lists shows as radio items with the active one checked', () => {
    const { menu } = build(readyState('b2'));
    expect(menu.label).toBe('Shows');
    expect(menu.submenu[0]).toMatchObject({ label: 'Comedy Sports', type: 'radio', checked: false });
    expect(menu.submenu[1]).toMatchObject({ label: 'Mom & Pop', type: 'radio', checked: true });
  });

  it('uses the specified items in order', () => {
    const { menu } = build(readyState());
    expect(labels(menu)).toEqual([
      'Comedy Sports', 'Mom & Pop', '---', 'Update "Comedy Sports"', 'New Show…',
      'Revert to "Comedy Sports"', 'Rename Show', 'Delete Show', '---',
      'Import Show…', 'Import Hotkey File…', 'Import Holding Tank File…'
    ]);
    expect(find(menu, 'Rename Show').submenu.map((i) => i.label)).toEqual(['Comedy Sports…', 'Mom & Pop…']);
  });

  it('names the active show in Update and Revert', () => {
    const { menu } = build(readyState());
    expect(find(menu, 'Update "Comedy Sports"')).toBeTruthy();
    expect(find(menu, 'Revert to "Comedy Sports"')).toBeTruthy();
  });

  it('sends commands with show ids', () => {
    const { menu, send } = build(readyState());
    menu.submenu[1].click();
    find(menu, 'Update "Comedy Sports"').click();
    find(menu, 'New Show…').click();
    find(menu, 'Revert to "Comedy Sports"').click();
    find(menu, 'Rename Show').submenu[1].click();
    find(menu, 'Delete Show').submenu[0].click();
    find(menu, 'Import Show…').click();
    expect(send.mock.calls).toEqual([
      ['switch', 'b2'], ['update', undefined], ['new', undefined], ['revert', undefined],
      ['rename', 'b2'], ['delete', 'b1'], ['import', undefined]
    ]);
  });

  // Electron moves the radio check natively; the renderer may drop the
  // switch, so the menu is rebuilt from the session's state straight away
  it('clicking a non-active show sends switch and then rebuilds the menu', async () => {
    const { menu, calls } = build(readyState());
    menu.submenu[1].click();
    expect(calls).toEqual(['send:switch:b2']);
    await new Promise((r) => setImmediate(r));
    expect(calls).toEqual(['send:switch:b2', 'rebuild']);
  });

  it('clicking the active show sends no command', () => {
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

  it('disables show commands unless status is ready', () => {
    for (const status of ['idle', 'loading', 'failed', 'unreadable']) {
      const { menu } = build({ ...readyState(), status });
      walk(menu.submenu, (item) => {
        if (item.type === 'separator') return;
        const legacy = /^Import (Hotkey|Holding Tank) File/.test(item.label);
        expect(item.enabled, `${status}: ${item.label}`).toBe(legacy ? undefined : false);
      });
    }
    const { menu } = build(readyState());
    expect(find(menu, 'New Show…').enabled).toBe(true);
  });

  it('renders nameless disabled items and no shows without a session', () => {
    const { menu } = build({ status: 'idle', activeShow: null, shows: [] });
    expect(labels(menu)).toEqual([
      '---', 'Update', 'New Show…', 'Revert to', 'Rename Show', 'Delete Show', '---',
      'Import Show…', 'Import Hotkey File…', 'Import Holding Tank File…'
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
      expect(find(menu, 'Delete Show').submenu[1].label).toBe('Mom && Pop…');
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
