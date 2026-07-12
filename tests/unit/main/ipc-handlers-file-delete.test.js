/**
 * Unit tests for the file-delete IPC handler's path validation and async unlink.
 *
 * Strategy: stub ipcMain.handle to capture the handler, then invoke it directly
 * with various paths to verify the allowedPaths whitelist, input validation,
 * and ENOENT handling.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
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
const realpathMock = vi.fn(async value => value);
const readdirMock = vi.fn();
const statMock = vi.fn();
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
        realpath: realpathMock,
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
      realpath: realpathMock,
      readdir: readdirMock,
      stat: statMock,
    },
  };
});

describe('restricted filesystem capabilities', () => {
  beforeEach(() => {
    readdirMock.mockReset();
    statMock.mockReset();
    realpathMock.mockImplementation(async value => value);
  });

  it('rejects copy destinations outside the managed music directory', async () => {
    const res = await invoke('file-copy', '/tmp/source.mp3', '/Users/testuser/Documents/source.mp3');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/destination.*managed music directory/i);
  });

  it('rejects unsupported copy source types', async () => {
    const res = await invoke('file-copy', '/tmp/source.txt', '/Users/testuser/Music/source.txt');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/supported audio/i);
  });

  it('restricts existence checks to the managed music directory', async () => {
    const denied = await invoke('file-exists', '/Users/testuser/Documents/notes.txt');
    expect(denied.success).toBe(false);
    expect(denied.error).toMatch(/access denied/i);
    const allowed = await invoke('file-exists', '/Users/testuser/Music/missing.mp3');
    expect(allowed.success).toBe(true);
    expect(allowed.exists).toBe(false);
  });

  it('scans recursively while excluding hidden, unsupported, and symlink entries', async () => {
    const file = name => ({ name, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false });
    const directory = name => ({ name, isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false });
    const symlink = name => ({ name, isFile: () => false, isDirectory: () => false, isSymbolicLink: () => true });
    statMock.mockResolvedValue({ isDirectory: () => true });
    readdirMock.mockImplementation(async dir => dir === '/selected/nested'
      ? [file('child.flac')]
      : [file('song.mp3'), file('notes.txt'), file('.hidden.wav'), directory('nested'), symlink('linked.wav')]);
    const res = await invoke('library:scan-audio-directory', '/selected');
    expect(res).toEqual({ success: true, data: ['/selected/song.mp3', '/selected/nested/child.flac'] });
  });

  it('rejects audio scans when the selected path is not a directory', async () => {
    statMock.mockResolvedValue({ isDirectory: () => false });
    const res = await invoke('library:scan-audio-directory', '/selected/file.mp3');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not a directory/i);
  });
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
    getDb: () => db,
    store: { get: vi.fn(key => key === 'music_directory' ? '/Users/testuser/Music' : undefined), set: vi.fn(), has: vi.fn(), delete: vi.fn(), clear: vi.fn() },
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
  beforeEach(() => {
    unlinkMock.mockReset();
    realpathMock.mockClear();
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

  it('rejects sibling paths that merely share an allowed prefix', async () => {
    const res = await invoke('file-delete', '/Users/testuser2/private.txt');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/access denied/i);
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it('rejects a symlink that resolves outside the allowed directories', async () => {
    realpathMock.mockImplementation(async value =>
      value === '/Users/testuser/Music/linked-secret' ? '/etc/secret' : value
    );
    const res = await invoke('file-delete', '/Users/testuser/Music/linked-secret');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/access denied/i);
    expect(unlinkMock).not.toHaveBeenCalled();
    realpathMock.mockImplementation(async value => value);
  });

  it('allows deletion of files in music directory', async () => {
    unlinkMock.mockResolvedValueOnce(undefined);
    const filePath = '/Users/testuser/Music/old-track.mp3';
    const res = await invoke('file-delete', filePath);
    expect(res.success).toBe(true);
    expect(unlinkMock).toHaveBeenCalledWith(path.resolve(filePath));
  });

  it('rejects deletion outside the configured music directory', async () => {
    const res = await invoke('file-delete', '/Users/testuser/Documents/notes.txt');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/access denied/i);
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it('treats ENOENT as success (file already gone)', async () => {
    const enoent = new Error('ENOENT');
    enoent.code = 'ENOENT';
    unlinkMock.mockRejectedValueOnce(enoent);
    const filePath = '/Users/testuser/Music/gone.txt';
    const res = await invoke('file-delete', filePath);
    expect(res.success).toBe(true);
    expect(res.alreadyDeleted).toBe(true);
  });

  it('returns error for other fs failures (e.g. EACCES)', async () => {
    const eacces = new Error('Permission denied');
    eacces.code = 'EACCES';
    unlinkMock.mockRejectedValueOnce(eacces);
    const filePath = '/Users/testuser/Music/locked.txt';
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
