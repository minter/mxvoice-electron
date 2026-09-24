import { describe, expect, it, vi } from 'vitest';
import { createMainWindow } from '../../../src/main/modules/main-window-factory.js';

function createBrowserWindowMock() {
  const instances = [];
  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.loadFile = vi.fn();
      this.webContents = {
        on: vi.fn(),
        send: vi.fn(),
        insertCSS: vi.fn()
      };
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

  it('does not leave a failed update check as an unhandled rejection', async () => {
    const { BrowserWindow } = createBrowserWindowMock();
    const failure = Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'));
    const catchSpy = vi.spyOn(failure, 'catch');
    const autoUpdater = { checkForUpdatesAndNotify: vi.fn(() => failure) };
    const window = createMainWindow({
      BrowserWindow,
      screen: { getAllDisplays: () => [] },
      autoUpdater,
      iconPath: '', preloadPath: '', indexPath: ''
    });

    window.readyHandler();
    await Promise.resolve();

    expect(catchSpy).toHaveBeenCalledOnce();
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

  it('disables CSS transitions in test mode', () => {
    const { BrowserWindow, instances } = createBrowserWindowMock();
    createMainWindow({
      BrowserWindow,
      screen: { getAllDisplays: () => [] },
      iconPath: '', preloadPath: '', indexPath: '', testMode: true
    });
    for (const [event, handler] of instances[0].webContents.on.mock.calls) {
      if (event === 'did-finish-load') handler();
    }
    expect(instances[0].webContents.insertCSS).toHaveBeenCalledWith(
      expect.stringContaining('transition-duration: 0s')
    );
  });

  it('does not inject transition-disabling CSS outside test mode', () => {
    const { BrowserWindow, instances } = createBrowserWindowMock();
    createMainWindow({
      BrowserWindow,
      screen: { getAllDisplays: () => [] },
      iconPath: '', preloadPath: '', indexPath: ''
    });
    for (const [event, handler] of instances[0].webContents.on.mock.calls) {
      if (event === 'did-finish-load') handler();
    }
    expect(instances[0].webContents.insertCSS).not.toHaveBeenCalled();
  });

  it('restores a quiet update after renderer reloads without another update check', () => {
    const { BrowserWindow } = createBrowserWindowMock();
    const updateState = {};
    const autoUpdater = { checkForUpdatesAndNotify: vi.fn() };
    const window = createMainWindow({
      BrowserWindow, screen: { getAllDisplays: () => [] }, autoUpdater, updateState,
      iconPath: '', preloadPath: '', indexPath: ''
    });
    const finishLoad = () => {
      for (const [event, handler] of window.webContents.on.mock.calls) {
        if (event === 'did-finish-load') handler();
      }
    };
    finishLoad();
    expect(window.webContents.send).not.toHaveBeenCalled();

    updateState.quietUpdate = { name: '4.3.3', notes: '<h2>Release notes</h2>' };
    finishLoad();
    finishLoad();
    expect(window.webContents.send.mock.calls).toEqual([
      ['update_available_quiet', '4.3.3', '<h2>Release notes</h2>'],
      ['update_available_quiet', '4.3.3', '<h2>Release notes</h2>'],
    ]);
    expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();

    window.webContents.send.mockClear();
    updateState.downloaded = true;
    finishLoad();
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

});
