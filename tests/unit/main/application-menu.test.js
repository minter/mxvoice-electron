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
    closeAllTabs: vi.fn(),
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
    rendererCommands
  });
  template.push(...result);
  return { Menu, rendererCommands, template };
}

describe('application menu', () => {
  it('builds and installs the platform menu', () => {
    const { Menu, template } = buildHarness();
    expect(template.map((menu) => menu.label)).toEqual(
      expect.arrayContaining(['File', 'Edit', 'View', 'Songs', 'Profile'])
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

  it('disables destructive actions for the default profile', () => {
    const { template } = buildHarness();
    const profileMenu = template.find((menu) => menu.label === 'Profile');
    expect(profileMenu.submenu.find((item) => item.label === 'Delete Current Profile...').enabled).toBe(false);
  });
});
