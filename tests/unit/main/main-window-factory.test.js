import { describe, expect, it, vi } from 'vitest';
import { createMainWindow } from '../../../src/main/modules/main-window-factory.js';

function createBrowserWindowMock() {
  const instances = [];
  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.loadFile = vi.fn();
      this.once = vi.fn((event, handler) => { this.readyHandler = handler; });
      this.isDestroyed = () => false;
      this.maximize = vi.fn();
      this.setFullScreen = vi.fn();
      instances.push(this);
    }
  }
  return { BrowserWindow, instances };
}

describe('main window factory', () => {
  it('creates a context-isolated window and restores valid state', () => {
    const { BrowserWindow, instances } = createBrowserWindowMock();
    const autoUpdater = { checkForUpdatesAndNotify: vi.fn() };
    const window = createMainWindow({
      BrowserWindow,
      screen: { getAllDisplays: () => [{ id: 7 }] },
      autoUpdater,
      iconPath: '/icon.ico',
      preloadPath: '/preload.cjs',
      indexPath: '/index.html',
      state: { width: 900, height: 600, x: 20, y: 30, displayId: 7, isMaximized: true }
    });

    expect(instances[0].options).toMatchObject({
      width: 900,
      height: 600,
      x: 20,
      y: 30,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    expect(window.loadFile).toHaveBeenCalledWith('/index.html');
    window.readyHandler();
    expect(autoUpdater.checkForUpdatesAndNotify).toHaveBeenCalledOnce();
    expect(window.maximize).toHaveBeenCalledOnce();
  });

  it('does not restore coordinates for a missing display', () => {
    const { BrowserWindow, instances } = createBrowserWindowMock();
    createMainWindow({
      BrowserWindow,
      screen: { getAllDisplays: () => [] },
      iconPath: '/icon.ico',
      preloadPath: '/preload.cjs',
      indexPath: '/index.html',
      state: { x: 20, y: 30, displayId: 99 }
    });
    expect(instances[0].options).not.toHaveProperty('x');
    expect(instances[0].options).not.toHaveProperty('y');
  });

  it('hides the window in test mode', () => {
    const { BrowserWindow, instances } = createBrowserWindowMock();
    createMainWindow({
      BrowserWindow,
      screen: { getAllDisplays: () => [] },
      iconPath: '', preloadPath: '', indexPath: '', testMode: true
    });
    expect(instances[0].options.show).toBe(false);
  });
});
