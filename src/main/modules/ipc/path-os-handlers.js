/**
 * Path and OS IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import path from 'path';
import os from 'os';
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { debugLog } = deps;

  // Path operations
  ipcMain.handle(IPC.PATH_OS.PATH_JOIN, async (event, ...paths) => {
    try {
      const joinedPath = path.join(...paths);
      return { success: true, data: joinedPath };
    } catch (error) {
      debugLog?.error('Path join error:', { module: 'ipc-handlers', function: 'path-join', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PATH_OS.PATH_PARSE, async (event, filePath) => {
    try {
      const parsedPath = path.parse(filePath);
      return { success: true, data: parsedPath };
    } catch (error) {
      debugLog?.error('Path parse error:', { module: 'ipc-handlers', function: 'path-parse', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PATH_OS.PATH_EXTNAME, async (event, filePath) => {
    try {
      const ext = path.extname(filePath);
      return { success: true, data: ext };
    } catch (error) {
      debugLog?.error('Path extname error:', { module: 'ipc-handlers', function: 'path-extname', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Additional path operations for secure API
  ipcMain.handle(IPC.PATH_OS.PATH_DIRNAME, async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      return { success: true, data: path.dirname(filePath) };
    } catch (error) {
      debugLog?.error('Path dirname error:', { module: 'ipc-handlers', function: 'path-dirname', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PATH_OS.PATH_BASENAME, async (event, filePath, ext) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      return { success: true, data: path.basename(filePath, ext) };
    } catch (error) {
      debugLog?.error('Path basename error:', { module: 'ipc-handlers', function: 'path-basename', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PATH_OS.PATH_RESOLVE, async (event, ...paths) => {
    try {
      return { success: true, data: path.resolve(...paths) };
    } catch (error) {
      debugLog?.error('Path resolve error:', { module: 'ipc-handlers', function: 'path-resolve', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PATH_OS.PATH_NORMALIZE, async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      return { success: true, data: path.normalize(filePath) };
    } catch (error) {
      debugLog?.error('Path normalize error:', { module: 'ipc-handlers', function: 'path-normalize', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // OS operations for secure API
  ipcMain.handle(IPC.PATH_OS.OS_HOMEDIR, async () => {
    try {
      return { success: true, data: os.homedir() };
    } catch (error) {
      debugLog?.error('OS homedir error:', { module: 'ipc-handlers', function: 'os-homedir', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PATH_OS.OS_PLATFORM, async () => {
    try {
      return { success: true, data: os.platform() };
    } catch (error) {
      debugLog?.error('OS platform error:', { module: 'ipc-handlers', function: 'os-platform', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PATH_OS.OS_ARCH, async () => {
    try {
      return { success: true, data: os.arch() };
    } catch (error) {
      debugLog?.error('OS arch error:', { module: 'ipc-handlers', function: 'os-arch', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.PATH_OS.OS_TMPDIR, async () => {
    try {
      return { success: true, data: os.tmpdir() };
    } catch (error) {
      debugLog?.error('OS tmpdir error:', { module: 'ipc-handlers', function: 'os-tmpdir', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
