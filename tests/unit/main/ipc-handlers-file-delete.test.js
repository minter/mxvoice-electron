/**
 * Unit tests for the file-delete IPC handler's path validation and async unlink.
 *
 * Strategy: stub ipcMain.handle to capture the handler, then invoke it directly
 * with various paths to verify the allowedPaths whitelist, input validation,
 * and ENOENT handling.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import path from 'path';
import pkg from 'node-sqlite3-wasm';

const { Database, onRuntimeInitialized } = pkg;

// ── Stubs for Electron APIs ───────────────────────────────────────────

const handlers = {};

const fakeIpcMain = {
  handle: (channel, fn) => { handlers[channel] = fn; },
  on: () => {},
};

const fakeDialog = { showOpenDialogSync: vi.fn() };
// Return realistic paths so the allowedPaths whitelist resolves correctly
const fakeApp = {
  getAppPath: vi.fn(() => '/fake'),
  getPath: vi.fn((name) => {
    const paths = {
      userData: '/Users/testuser/Library/Application Support/MxVoice',
      documents: '/Users/testuser/Documents',
      music: '/Users/testuser/Music',
      downloads: '/Users/testuser/Downloads',
      home: '/Users/testuser',
    };
    return paths[name] || '/fake';
  }),
};

vi.mock('electron', () => ({
  default: { ipcMain: fakeIpcMain, dialog: fakeDialog, app: fakeApp },
  ipcMain: fakeIpcMain,
  dialog: fakeDialog,
  app: fakeApp,
}));

vi.mock('../../../src/main/modules/file-operations.js', () => ({
  default: { initializeFileOperations: vi.fn() },
}));
vi.mock('../../../src/main/modules/profile-manager.js', () => ({}));
vi.mock('../../../src/main/modules/profile-backup-manager.js', () => ({}));
vi.mock('howler', () => ({ Howl: vi.fn(), Howler: {} }));
vi.mock('music-metadata', () => ({ parseFile: vi.fn() }));

// Track fs.promises.unlink calls
const unlinkMock = vi.fn();
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual,
      promises: {
        ...actual.promises,
        unlink: unlinkMock,
        readFile: actual.promises?.readFile ?? vi.fn(),
      },
      existsSync: actual.existsSync,
      readFileSync: actual.readFileSync,
      writeFileSync: actual.writeFileSync,
      mkdirSync: actual.mkdirSync,
      unlinkSync: actual.unlinkSync,
      statSync: actual.statSync,
      createReadStream: actual.createReadStream,
      createWriteStream: actual.createWriteStream,
    },
    promises: {
      ...actual.promises,
      unlink: unlinkMock,
    },
  };
});

// ── Setup ─────────────────────────────────────────────────────────────

let db;
const mockDebugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const fakeEvent = {};

beforeAll(async () => {
  await onRuntimeInitialized;
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (code TEXT PRIMARY KEY, description TEXT);
    CREATE TABLE IF NOT EXISTS mrvoice (
      id INTEGER PRIMARY KEY, title TEXT, artist TEXT, category TEXT,
      info TEXT, filename TEXT, time TEXT, modtime INTEGER, publisher TEXT, md5 TEXT
    );
  `);

  const { initializeIpcHandlers } = await import(
    '../../../src/main/modules/ipc-handlers.js'
  );

  initializeIpcHandlers({
    mainWindow: { webContents: { send: vi.fn() } },
    db,
    store: { get: vi.fn(), set: vi.fn(), has: vi.fn(), delete: vi.fn(), clear: vi.fn() },
    audioInstances: new Map(),
    autoUpdater: null,
    debugLog: mockDebugLog,
    logService: null,
    updateState: { downloaded: false },
  });
});

function invoke(channel, ...args) {
  return handlers[channel](fakeEvent, ...args);
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('file-delete handler', () => {
  beforeAll(() => {
    unlinkMock.mockReset();
  });

  it('rejects null/undefined file path', async () => {
    const res = await invoke('file-delete', null);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/invalid file path/i);
  });

  it('rejects non-string file path', async () => {
    const res = await invoke('file-delete', 42);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/invalid file path/i);
  });

  it('rejects empty string file path', async () => {
    const res = await invoke('file-delete', '');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/invalid file path/i);
  });

  it('rejects paths outside allowed directories', async () => {
    const res = await invoke('file-delete', '/etc/passwd');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/access denied/i);
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it('rejects path traversal attempts', async () => {
    const res = await invoke('file-delete', '/Users/testuser/Documents/../../../etc/shadow');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/access denied/i);
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it('allows deletion of files in userData directory', async () => {
    unlinkMock.mockResolvedValueOnce(undefined);
    const filePath = '/Users/testuser/Library/Application Support/MxVoice/temp.txt';
    const res = await invoke('file-delete', filePath);
    expect(res.success).toBe(true);
    expect(unlinkMock).toHaveBeenCalledWith(path.resolve(filePath));
  });

  it('allows deletion of files in home directory', async () => {
    unlinkMock.mockResolvedValueOnce(undefined);
    const filePath = '/Users/testuser/some-file.txt';
    const res = await invoke('file-delete', filePath);
    expect(res.success).toBe(true);
    expect(unlinkMock).toHaveBeenCalledWith(path.resolve(filePath));
  });

  it('allows deletion of files in music directory', async () => {
    unlinkMock.mockResolvedValueOnce(undefined);
    const filePath = '/Users/testuser/Music/old-track.mp3';
    const res = await invoke('file-delete', filePath);
    expect(res.success).toBe(true);
    expect(unlinkMock).toHaveBeenCalledWith(path.resolve(filePath));
  });

  it('treats ENOENT as success (file already gone)', async () => {
    const enoent = new Error('ENOENT');
    enoent.code = 'ENOENT';
    unlinkMock.mockRejectedValueOnce(enoent);
    const filePath = '/Users/testuser/Documents/gone.txt';
    const res = await invoke('file-delete', filePath);
    expect(res.success).toBe(true);
    expect(res.alreadyDeleted).toBe(true);
  });

  it('returns error for other fs failures (e.g. EACCES)', async () => {
    const eacces = new Error('Permission denied');
    eacces.code = 'EACCES';
    unlinkMock.mockRejectedValueOnce(eacces);
    const filePath = '/Users/testuser/Documents/locked.txt';
    const res = await invoke('file-delete', filePath);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/permission denied/i);
  });

  it('logs warning when access is denied', async () => {
    mockDebugLog.warn.mockClear();
    await invoke('file-delete', '/etc/hosts');
    expect(mockDebugLog.warn).toHaveBeenCalledWith(
      'File delete access denied',
      expect.objectContaining({ function: 'file-delete' })
    );
  });
});
