import { describe, expect, it, vi } from 'vitest';
import { createMainWindow } from '../../../src/main/modules/main-window-factory.js';

function createBrowserWindowMock() {
  const instances = [];
  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.loadFile = vi.fn();
      this.handlers = {};
      this.contentHandlers = {};
      this.webContents = {
        on: vi.fn((event, handler) => { this.contentHandlers[event] = handler; }),
        send: vi.fn(),
        insertCSS: vi.fn(async () => 'css-key'),
        removeInsertedCSS: vi.fn(async () => {})
      };
      this.once = vi.fn((event, handler) => { this.readyHandler = handler; });
      this.on = vi.fn((event, handler) => { this.handlers[event] = handler; });
      this.fullScreen = false;
      this.isFullScreen = () => this.fullScreen;
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
      platform: 'linux',
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
      platform: 'linux',
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
      platform: 'linux',
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
      platform: 'linux',
      BrowserWindow,
      screen: { getAllDisplays: () => [] },
      iconPath: '', preloadPath: '', indexPath: '', testMode: true
    });
    expect(instances[0].options.show).toBe(false);
  });

  it('disables CSS transitions in test mode', () => {
    const { BrowserWindow, instances } = createBrowserWindowMock();
    createMainWindow({
      platform: 'linux',
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
      platform: 'linux',
      BrowserWindow,
      screen: { getAllDisplays: () => [] },
      iconPath: '', preloadPath: '', indexPath: ''
    });
    for (const [event, handler] of instances[0].webContents.on.mock.calls) {
      if (event === 'did-finish-load') handler();
    }
    expect(instances[0].webContents.insertCSS).not.toHaveBeenCalled();
  });



  it('on macOS uses the inset title bar and hides its strip while full screen', async () => {
    const { BrowserWindow, instances } = createBrowserWindowMock();
    createMainWindow({
      platform: 'darwin',
      BrowserWindow,
      screen: { getAllDisplays: () => [] },
      autoUpdater: { checkForUpdatesAndNotify: vi.fn() },
      iconPath: '', preloadPath: '', indexPath: ''
    });
    const win = instances[0];
    expect(win.options.titleBarStyle).toBe('hiddenInset');

    await win.handlers['enter-full-screen']();
    expect(win.webContents.insertCSS).toHaveBeenCalledWith(expect.stringContaining('body.platform-mac'));
    win.handlers['leave-full-screen']();
    expect(win.webContents.removeInsertedCSS).toHaveBeenCalledWith('css-key');

    // A reload while full screen puts the rule back
    win.fullScreen = true;
    win.webContents.insertCSS.mockClear();
    await win.contentHandlers['did-finish-load']();
    expect(win.webContents.insertCSS).toHaveBeenCalledOnce();
  });

  it('keeps the native title bar on Windows and Linux', () => {
    for (const platform of ['win32', 'linux']) {
      const { BrowserWindow, instances } = createBrowserWindowMock();
      createMainWindow({
        platform,
        BrowserWindow,
        screen: { getAllDisplays: () => [] },
        autoUpdater: { checkForUpdatesAndNotify: vi.fn() },
        iconPath: '', preloadPath: '', indexPath: ''
      });
      expect(instances[0].options.titleBarStyle).toBeUndefined();
      expect(instances[0].on).not.toHaveBeenCalledWith('enter-full-screen', expect.any(Function));
    }
  });
});
