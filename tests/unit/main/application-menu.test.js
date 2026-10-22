import { describe, expect, it, vi } from 'vitest';
import { buildApplicationMenu } from '../../../src/main/modules/application-menu.js';

function buildHarness() {
  const template = [];
  const Menu = {
    buildFromTemplate: vi.fn((value) => ({ value })),
    setApplicationMenu: vi.fn()
  };
  const rendererCommands = {
    increaseFontSize: vi.fn(),
    decreaseFontSize: vi.fn(),
    toggleWaveform: vi.fn(),
    toggleAdvancedSearch: vi.fn(),
    editSelectedSong: vi.fn(),
    deleteSelectedSong: vi.fn(),
    manageCategories: vi.fn()
  };
  const result = buildApplicationMenu({
    app: { name: 'Mx. Voice' },
    Menu,
    shell: { openExternal: vi.fn() },
    mainWindow: { isDestroyed: () => false, webContents: { send: vi.fn() } },
    fileOperations: {},
    getCurrentProfile: () => 'Default User',
    showAboutDialog: vi.fn(),
    debugLog: { warn: vi.fn() },
    logService: { exportLogs: vi.fn() },
    rendererCommands,
    getShowMenuState: () => ({
      status: 'ready',
      activeShow: { id: 'b1', name: 'Comedy Sports' },
      shows: [{ id: 'b1', name: 'Comedy Sports' }]
    })
  });
  template.push(...result);
  return { Menu, rendererCommands, template };
}

describe('application menu', () => {
  it('builds and installs the platform menu', () => {
    const { Menu, template } = buildHarness();
    expect(template.map((menu) => menu.label)).toEqual(
      expect.arrayContaining(['File', 'Edit', 'View', 'Songs', 'Shows', 'Profile'])
    );
    expect(Menu.buildFromTemplate).toHaveBeenCalledWith(template);
    expect(Menu.setApplicationMenu).toHaveBeenCalledOnce();
  });

  it('routes view actions through the renderer command dispatcher', () => {
    const { rendererCommands, template } = buildHarness();
    const viewMenu = template.find((menu) => menu.label === 'View');
    viewMenu.submenu.find((item) => item.label === 'Show/Hide Waveform').click();
    expect(rendererCommands.toggleWaveform).toHaveBeenCalledOnce();
  });

  it('has a Shows menu where Hotkeys was, and no Hotkeys menu or Start a New Session', () => {
    const { template } = buildHarness();
    const labels = template.map((menu) => menu.label);
    expect(labels).not.toContain('Hotkeys');
    expect(labels.indexOf('Shows')).toBe(labels.indexOf('Songs') + 1);
    const show = template.find((menu) => menu.label === 'Shows');
    expect(show.submenu.map((i) => i.label)).toContain('Save "Comedy Sports"…');
    const view = template.find((menu) => menu.label === 'View');
    expect(view.submenu.map((i) => i.label)).not.toContain('Start a New Session');
    const accelerators = [];
    const walk = (items) => items.forEach((i) => { accelerators.push(i.accelerator); if (i.submenu) walk(i.submenu); });
    walk(template);
    expect(accelerators).not.toContain('CommandOrControl+O');
    expect(accelerators).not.toContain('CommandOrControl+S');
  });

  it('sends show commands to the window on menu:show-command', async () => {
    const send = vi.fn();
    const rebuildMenu = vi.fn();
    const Menu = { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() };
    const template = buildApplicationMenu({
      app: { name: 'Mx. Voice' }, Menu, shell: {},
      mainWindow: { isDestroyed: () => false, webContents: { send } },
      fileOperations: {}, getCurrentProfile: () => 'Default User', showAboutDialog: vi.fn(),
      debugLog: { warn: vi.fn() }, logService: {}, rendererCommands: {},
      getShowMenuState: () => ({ status: 'ready', activeShow: { id: 'b1', name: 'A' }, shows: [{ id: 'b1', name: 'A' }, { id: 'b2', name: 'B' }], hasPlayed: true }),
      rebuildMenu,
      swatchImage: (key) => `swatch:${key}`
    });
    template.find((m) => m.label === 'Shows').submenu[1].click();
    expect(send).toHaveBeenCalledWith('menu:show-command', { command: 'switch', showId: 'b2' });
    await new Promise((r) => setImmediate(r));
    expect(rebuildMenu).toHaveBeenCalledOnce();
    const shows = template.find((m) => m.label === 'Shows').submenu;
    const teal = shows.find((i) => i.label === 'Color').submenu.find((i) => i.label === 'Teal');
    expect(teal.icon).toBe('swatch:teal');
    teal.click();
    expect(send).toHaveBeenLastCalledWith('menu:show-command', { command: 'set-color', showId: null, color: 'teal' });
    // Tonight's played counts reset from the Shows menu, not Songs, which is the library
    expect(template.find((m) => m.label === 'Songs').submenu.map((i) => i.label)).not.toContain('Mark All Songs as Unplayed');
    const unplayed = shows.find((i) => i.label === 'Mark All Songs as Unplayed');
    expect(unplayed.enabled).toBe(true);
    unplayed.click();
    expect(send).toHaveBeenLastCalledWith('menu:show-command', { command: 'reset-played', showId: undefined });
  });

  it('writes the ellipsis as one character in every menu label', () => {
    const { template } = buildHarness();
    const labels = [];
    const walk = (items) => items.forEach((i) => { if (i.label) labels.push(i.label); if (i.submenu) walk(i.submenu); });
    walk(template);
    expect(labels.filter((label) => label.includes('...'))).toEqual([]);
    expect(labels).toEqual(expect.arrayContaining(['Export Library…', 'Switch Profile…', 'Backup Settings…']));
  });

  it('has no top-level Categories menu and puts Manage Categories at the end of Songs', () => {
    const { rendererCommands, template } = buildHarness();
    expect(template.map((menu) => menu.label)).not.toContain('Categories');
    const songs = template.find((menu) => menu.label === 'Songs');
    const last = songs.submenu[songs.submenu.length - 1];
    expect(songs.submenu[songs.submenu.length - 2]).toEqual({ type: 'separator' });
    expect(last.label).toBe('Manage Categories…');
    last.click();
    expect(rendererCommands.manageCategories).toHaveBeenCalledOnce();
  });

  it('disables destructive actions for the default profile', () => {
    const { template } = buildHarness();
    const profileMenu = template.find((menu) => menu.label === 'Profile');
    expect(profileMenu.submenu.find((item) => item.label === 'Delete Current Profile…').enabled).toBe(false);
  });
});
