import { describe, expect, it, vi } from 'vitest';
import { buildShowMenu } from '../../../src/main/modules/show-menu.js';

const shows = [
  { id: 'b1', name: 'Comedy Sports' },
  { id: 'b2', name: 'Mom & Pop' }
];
const readyState = (activeId = 'b1') => ({
  status: 'ready',
  activeShow: shows.find((b) => b.id === activeId),
  shows,
  dirty: true
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
      'Comedy Sports', 'Mom & Pop', '---', 'Save "Comedy Sports"…', 'Save As…',
      'Revert to Saved…', 'Rename "Comedy Sports"…', 'Delete "Comedy Sports"…', 'Color', '---',
      'Import Show…', 'Import Hotkey File…', 'Import Holding Tank File…'
    ]);
    // Color is the only nested menu
    walk(menu.submenu, (item) => expect(item.submenu, item.label).toBe(item.label === 'Color' ? item.submenu : undefined));
    expect(find(menu, 'Color').submenu).toHaveLength(8);
  });

  it('names the active show in Save, Rename and Delete; Revert names none', () => {
    const { menu } = build(readyState('b2'));
    expect(find(menu, 'Save "Mom & Pop"…')).toBeTruthy();
    expect(find(menu, 'Revert to Saved…')).toBeTruthy();
    expect(find(menu, 'Rename "Mom & Pop"…')).toBeTruthy();
    expect(find(menu, 'Delete "Mom & Pop"…')).toBeTruthy();
  });

  it('enables Revert to Saved only when ready with unsaved changes', () => {
    const revert = (state) => find(build(state).menu, 'Revert to Saved…').enabled;
    expect(revert(readyState())).toBe(true);
    expect(revert({ ...readyState(), dirty: false })).toBe(false);
    expect(revert({ ...readyState(), dirty: undefined })).toBe(false);
    expect(revert({ ...readyState(), status: 'loading' })).toBe(false);
  });

  it('sends switch with a show id and every other command without one', () => {
    const { menu, send } = build(readyState());
    menu.submenu[1].click();
    find(menu, 'Save "Comedy Sports"…').click();
    find(menu, 'Save As…').click();
    find(menu, 'Revert to Saved…').click();
    find(menu, 'Rename "Comedy Sports"…').click();
    find(menu, 'Delete "Comedy Sports"…').click();
    find(menu, 'Import Show…').click();
    expect(send.mock.calls).toEqual([
      ['switch', 'b2'], ['save', undefined], ['save-as', undefined], ['revert', undefined],
      ['rename', undefined], ['delete', undefined], ['import', undefined]
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
    expect(find(menu, 'Save As…').enabled).toBe(true);
  });

  it('has a Color submenu of radio items, None first, checked on the active show\'s color', () => {
    const state = { ...readyState(), activeShow: { ...shows[0], color: 'pink' } };
    const color = find(build(state).menu, 'Color');
    expect(color.enabled).toBe(true);
    expect(color.submenu.map((i) => i.label)).toEqual([
      'None', 'Teal', 'Blue', 'Purple', 'Pink', 'Coral', 'Amber', 'Green'
    ]);
    for (const item of color.submenu) {
      expect(item.type).toBe('radio');
      expect(item.enabled).toBe(true);
      expect(item.checked, item.label).toBe(item.label === 'Pink');
    }
    // No color, or one this build doesn't know, checks None
    for (const value of [null, undefined, 'mauve']) {
      const plain = find(build({ ...readyState(), activeShow: { ...shows[0], color: value } }).menu, 'Color');
      expect(plain.submenu.filter((i) => i.checked).map((i) => i.label)).toEqual(['None']);
    }
  });

  it('disables the Color submenu unless ready', () => {
    for (const status of ['idle', 'loading', 'failed', 'unreadable']) {
      const color = find(build({ ...readyState(), status }).menu, 'Color');
      expect(color.enabled, status).toBe(false);
      for (const item of color.submenu) expect(item.enabled, `${status}: ${item.label}`).toBe(false);
    }
  });

  it('a Color click sends set-color with the key, then rebuilds after the click', async () => {
    const { menu, send, calls } = build(readyState());
    const color = find(menu, 'Color');
    color.submenu.find((i) => i.label === 'Teal').click();
    expect(send).toHaveBeenCalledWith('set-color', null, { color: 'teal' });
    expect(calls).toEqual(['send:set-color:null']);
    await new Promise((r) => setImmediate(r));
    expect(calls).toEqual(['send:set-color:null', 'rebuild']);
    color.submenu.find((i) => i.label === 'None').click();
    expect(send).toHaveBeenLastCalledWith('set-color', null, { color: null });
  });

  it('renders nameless disabled items and no shows without a session', () => {
    const { menu } = build({ status: 'idle', activeShow: null, shows: [] });
    expect(labels(menu)).toEqual([
      '---', 'Save…', 'Save As…', 'Revert to Saved…', 'Rename…', 'Delete…', 'Color', '---',
      'Import Show…', 'Import Hotkey File…', 'Import Holding Tank File…'
    ]);
    expect(find(menu, 'Save…').enabled).toBe(false);
    expect(find(menu, 'Rename…').enabled).toBe(false);
    expect(find(menu, 'Delete…').enabled).toBe(false);
  });

  it('escapes & on win32 and linux, not on darwin', () => {
    const state = readyState('b2');
    expect(find(build(state, 'darwin').menu, 'Save "Mom & Pop"…')).toBeTruthy();
    for (const platform of ['win32', 'linux']) {
      const { menu } = build(state, platform);
      expect(menu.submenu[1].label).toBe('Mom && Pop');
      expect(find(menu, 'Save "Mom && Pop"…')).toBeTruthy();
      expect(find(menu, 'Rename "Mom && Pop"…')).toBeTruthy();
      expect(find(menu, 'Delete "Mom && Pop"…')).toBeTruthy();
    }
  });

  // Save replaces a prepared show and asks first; no reflex keystroke reaches it
  it('has no accelerators', () => {
    const { menu } = build(readyState());
    walk(menu.submenu, (item) => expect(item.accelerator).toBeUndefined());
  });
});
