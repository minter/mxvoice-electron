/**
 * Unit tests for the secure adapter module.
 *
 * Every adapter method follows the same pattern:
 *   1. Check window.secureElectronAPI.{namespace}.{method}  → call it
 *   2. (fileSystem/path/store/audio only) fallback to window.electronAPI
 *   3. Otherwise throw → caught → return { success: false, error }
 *
 * We test representative methods from each adapter group to validate the
 * pattern, plus edge cases.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide window + debugLog before the module loads
globalThis.window = globalThis.window || {};
const mockDebugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
window.debugLog = mockDebugLog;

// Clear APIs before import so the module starts clean
delete window.secureElectronAPI;
delete window.electronAPI;

const {
  secureDatabase,
  secureFileSystem,
  securePath,
  secureStore,
  secureAudio,
  secureFileDialog,
} = await import('../../../src/renderer/modules/adapters/secure-adapter.js');

// ── Helpers ───────────────────────────────────────────────────────────

function setupSecureAPI(namespace, methods) {
  window.secureElectronAPI = window.secureElectronAPI || {};
  window.secureElectronAPI[namespace] = {};
  for (const [name, impl] of Object.entries(methods)) {
    window.secureElectronAPI[namespace][name] = vi.fn(impl);
  }
}

function setupFallbackAPI(namespace, methods) {
  window.electronAPI = window.electronAPI || {};
  if (namespace) {
    window.electronAPI[namespace] = {};
    for (const [name, impl] of Object.entries(methods)) {
      window.electronAPI[namespace][name] = vi.fn(impl);
    }
  } else {
    // Top-level methods (e.g. electronAPI.showFilePicker)
    for (const [name, impl] of Object.entries(methods)) {
      window.electronAPI[name] = vi.fn(impl);
    }
  }
}

beforeEach(() => {
  delete window.secureElectronAPI;
  delete window.electronAPI;
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// secureDatabase — no fallback path, only secureElectronAPI
// ═══════════════════════════════════════════════════════════════════════

describe('secureDatabase', () => {
  it('getCategories delegates to secureElectronAPI', async () => {
    const data = [{ code: 'GAME', description: 'Game' }];
    setupSecureAPI('database', {
      getCategories: async () => ({ success: true, data }),
    });

    const res = await secureDatabase.getCategories();
    expect(res.success).toBe(true);
    expect(res.data).toEqual(data);
    expect(window.secureElectronAPI.database.getCategories).toHaveBeenCalled();
  });

  it('getCategories returns error when API is unavailable', async () => {
    const res = await secureDatabase.getCategories();
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no database api/i);
    expect(mockDebugLog.error).toHaveBeenCalled();
  });

  it('addSong passes songData through', async () => {
    const songData = { title: 'Test', artist: 'A', category: 'X', filename: 'f.mp3' };
    setupSecureAPI('database', {
      addSong: async (data) => ({ success: true, data: { lastInsertRowid: 42 } }),
    });

    const res = await secureDatabase.addSong(songData);
    expect(res.success).toBe(true);
    expect(window.secureElectronAPI.database.addSong).toHaveBeenCalledWith(songData);
  });

  it('searchSongs passes searchParams through', async () => {
    setupSecureAPI('database', {
      searchSongs: async (params) => ({ success: true, data: [] }),
    });

    await secureDatabase.searchSongs({ searchTerm: 'test' });
    expect(window.secureElectronAPI.database.searchSongs).toHaveBeenCalledWith({ searchTerm: 'test' });
  });

  it('deleteSong passes songId through', async () => {
    setupSecureAPI('database', {
      deleteSong: async (id) => ({ success: true, data: { changes: 1 } }),
    });

    const res = await secureDatabase.deleteSong(123);
    expect(res.success).toBe(true);
    expect(window.secureElectronAPI.database.deleteSong).toHaveBeenCalledWith(123);
  });

  it('handles API throwing an error', async () => {
    setupSecureAPI('database', {
      getCategories: async () => { throw new Error('DB connection lost'); },
    });

    const res = await secureDatabase.getCategories();
    expect(res.success).toBe(false);
    expect(res.error).toBe('DB connection lost');
  });

  it('updateCategory passes code and description', async () => {
    setupSecureAPI('database', {
      updateCategory: async (code, desc) => ({ success: true }),
    });

    await secureDatabase.updateCategory('GAME', 'Games');
    expect(window.secureElectronAPI.database.updateCategory).toHaveBeenCalledWith('GAME', 'Games');
  });

  it('reassignSongCategory passes both codes', async () => {
    setupSecureAPI('database', {
      reassignSongCategory: async (from, to) => ({ success: true }),
    });

    await secureDatabase.reassignSongCategory('OLD', 'NEW');
    expect(window.secureElectronAPI.database.reassignSongCategory).toHaveBeenCalledWith('OLD', 'NEW');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// secureFileSystem — has fallback to electronAPI
// ═══════════════════════════════════════════════════════════════════════

describe('secureFileSystem', () => {
  it('read uses secureElectronAPI when available', async () => {
    setupSecureAPI('fileSystem', {
      read: async (path) => ({ success: true, data: 'content' }),
    });

    const res = await secureFileSystem.read('/test/file.txt');
    expect(res.success).toBe(true);
    expect(window.secureElectronAPI.fileSystem.read).toHaveBeenCalledWith('/test/file.txt');
  });

  it('read falls back to electronAPI', async () => {
    setupFallbackAPI('fileSystem', {
      read: async (path) => ({ success: true, data: 'fallback' }),
    });

    const res = await secureFileSystem.read('/test/file.txt');
    expect(res.success).toBe(true);
    expect(res.data).toBe('fallback');
  });

  it('read returns error when no API is available', async () => {
    const res = await secureFileSystem.read('/test/file.txt');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no file system api/i);
  });

  it('write passes filePath and data', async () => {
    setupSecureAPI('fileSystem', {
      write: async (path, data) => ({ success: true }),
    });

    await secureFileSystem.write('/test/out.txt', 'hello');
    expect(window.secureElectronAPI.fileSystem.write).toHaveBeenCalledWith('/test/out.txt', 'hello');
  });

  it('copy passes source and dest', async () => {
    setupSecureAPI('fileSystem', {
      copy: async (src, dest) => ({ success: true }),
    });

    await secureFileSystem.copy('/src', '/dest');
    expect(window.secureElectronAPI.fileSystem.copy).toHaveBeenCalledWith('/src', '/dest');
  });

  it('mkdir passes options', async () => {
    setupSecureAPI('fileSystem', {
      mkdir: async (dir, opts) => ({ success: true }),
    });

    await secureFileSystem.mkdir('/new/dir', { recursive: true });
    expect(window.secureElectronAPI.fileSystem.mkdir).toHaveBeenCalledWith('/new/dir', { recursive: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// securePath — has fallback to electronAPI
// ═══════════════════════════════════════════════════════════════════════

describe('securePath', () => {
  it('join delegates to secureElectronAPI', async () => {
    setupSecureAPI('path', {
      join: async (...parts) => '/a/b/c',
    });

    const res = await securePath.join('/a', 'b', 'c');
    expect(res).toBe('/a/b/c');
  });

  it('join falls back to electronAPI', async () => {
    setupFallbackAPI('path', {
      join: async (...parts) => 'fallback/path',
    });

    const res = await securePath.join('fallback', 'path');
    expect(res).toBe('fallback/path');
  });

  it('join returns error when no API available', async () => {
    const res = await securePath.join('a', 'b');
    expect(res.success).toBe(false);
  });

  it('extname delegates correctly', async () => {
    setupSecureAPI('path', {
      extname: async (p) => '.mp3',
    });

    const res = await securePath.extname('song.mp3');
    expect(res).toBe('.mp3');
  });

  it('basename passes ext argument', async () => {
    setupSecureAPI('path', {
      basename: async (p, ext) => 'file',
    });

    await securePath.basename('/dir/file.txt', '.txt');
    expect(window.secureElectronAPI.path.basename).toHaveBeenCalledWith('/dir/file.txt', '.txt');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// secureStore — has fallback to electronAPI
// ═══════════════════════════════════════════════════════════════════════

describe('secureStore', () => {
  it('get delegates to secureElectronAPI', async () => {
    setupSecureAPI('store', {
      get: async (key) => ({ success: true, value: 'dark' }),
    });

    const res = await secureStore.get('theme');
    expect(res.value).toBe('dark');
  });

  it('get falls back to electronAPI', async () => {
    setupFallbackAPI('store', {
      get: async (key) => ({ success: true, value: 'light' }),
    });

    const res = await secureStore.get('theme');
    expect(res.value).toBe('light');
  });

  it('get returns error when no API available', async () => {
    const res = await secureStore.get('theme');
    expect(res.success).toBe(false);
  });

  it('set passes key and value', async () => {
    setupSecureAPI('store', {
      set: async (key, val) => ({ success: true }),
    });

    await secureStore.set('volume', 0.7);
    expect(window.secureElectronAPI.store.set).toHaveBeenCalledWith('volume', 0.7);
  });

  it('has returns result', async () => {
    setupSecureAPI('store', {
      has: async (key) => ({ success: true, has: true }),
    });

    const res = await secureStore.has('myKey');
    expect(res.has).toBe(true);
  });

  it('delete passes key', async () => {
    setupSecureAPI('store', {
      delete: async (key) => ({ success: true }),
    });

    await secureStore.delete('oldKey');
    expect(window.secureElectronAPI.store.delete).toHaveBeenCalledWith('oldKey');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// secureAudio — has fallback to electronAPI
// ═══════════════════════════════════════════════════════════════════════

describe('secureAudio', () => {
  it('play delegates with filePath and options', async () => {
    setupSecureAPI('audio', {
      play: async (path, opts) => ({ success: true }),
    });

    await secureAudio.play('/music/song.mp3', { volume: 0.5 });
    expect(window.secureElectronAPI.audio.play).toHaveBeenCalledWith('/music/song.mp3', { volume: 0.5 });
  });

  it('play returns error when no API available', async () => {
    const res = await secureAudio.play('/song.mp3');
    expect(res.success).toBe(false);
  });

  it('stop passes soundId', async () => {
    setupSecureAPI('audio', {
      stop: async (id) => ({ success: true }),
    });

    await secureAudio.stop('abc');
    expect(window.secureElectronAPI.audio.stop).toHaveBeenCalledWith('abc');
  });

  it('setVolume passes volume and soundId', async () => {
    setupSecureAPI('audio', {
      setVolume: async (vol, id) => ({ success: true }),
    });

    await secureAudio.setVolume(0.8, 'sid');
    expect(window.secureElectronAPI.audio.setVolume).toHaveBeenCalledWith(0.8, 'sid');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// secureFileDialog — mixed API patterns
// ═══════════════════════════════════════════════════════════════════════

describe('secureFileDialog', () => {
  it('showFilePicker uses secureElectronAPI.app', async () => {
    setupSecureAPI('app', {
      showFilePicker: async (opts) => ({ success: true, path: '/picked' }),
    });

    const res = await secureFileDialog.showFilePicker({ multiple: false });
    expect(res.path).toBe('/picked');
  });

  it('showFilePicker falls back to electronAPI.showFilePicker', async () => {
    setupFallbackAPI(null, {
      showFilePicker: async (opts) => ({ success: true, path: '/fallback' }),
    });

    const res = await secureFileDialog.showFilePicker();
    expect(res.path).toBe('/fallback');
  });

  it('showDirectoryPicker passes defaultPath', async () => {
    setupSecureAPI('app', {
      showDirectoryPicker: async (p) => ({ success: true, path: p }),
    });

    const res = await secureFileDialog.showDirectoryPicker('/home');
    expect(res.path).toBe('/home');
  });

  it('openHotkeyFile uses secureElectronAPI.fileOperations', async () => {
    setupSecureAPI('fileOperations', {
      openHotkeyFile: async () => ({ success: true, data: [] }),
    });

    const res = await secureFileDialog.openHotkeyFile();
    expect(res.success).toBe(true);
  });

  it('openHotkeyFile falls back to electronAPI.openHotkeyFile', async () => {
    setupFallbackAPI(null, {
      openHotkeyFile: async () => ({ success: true, data: ['fallback'] }),
    });

    const res = await secureFileDialog.openHotkeyFile();
    expect(res.success).toBe(true);
  });

  it('saveHotkeyFile passes hotkeyArray', async () => {
    const arr = [{ key: 'F1', songId: 1 }];
    setupSecureAPI('fileOperations', {
      saveHotkeyFile: async (data) => ({ success: true }),
    });

    await secureFileDialog.saveHotkeyFile(arr);
    expect(window.secureElectronAPI.fileOperations.saveHotkeyFile).toHaveBeenCalledWith(arr);
  });

  it('returns error when no dialog API available', async () => {
    const res = await secureFileDialog.showFilePicker();
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no file picker api/i);
  });
});
