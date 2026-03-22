/**
 * Unit tests for store and category IPC handlers.
 *
 * Uses the same stub-and-capture approach as ipc-handlers-db.test.js:
 * we stub ipcMain.handle, import the module to populate handlers, then
 * call handler functions directly.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import pkg from 'node-sqlite3-wasm';

const { Database, onRuntimeInitialized } = pkg;

// ── Stubs ─────────────────────────────────────────────────────────────

const handlers = {};

const fakeIpcMain = {
  handle: (channel, fn) => { handlers[channel] = fn; },
  on: () => {},
};

const fakeDialog = { showOpenDialogSync: vi.fn() };
const fakeApp = { getAppPath: vi.fn(() => '/fake'), getPath: vi.fn(() => '/fake') };

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

// ── In-memory store stub ──────────────────────────────────────────────

let storeData;

function makeStore() {
  storeData = {};
  return {
    get: vi.fn((key) => storeData[key]),
    set: vi.fn((key, value) => { storeData[key] = value; }),
    has: vi.fn((key) => key in storeData),
    delete: vi.fn((key) => { delete storeData[key]; }),
    clear: vi.fn(() => { storeData = {}; }),
    get store() { return storeData; },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────

let db;
let mockStore;
const mockDebugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const fakeEvent = {};

beforeAll(async () => {
  await onRuntimeInitialized;
  db = new Database(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      code TEXT PRIMARY KEY,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS mrvoice (
      id INTEGER PRIMARY KEY,
      title TEXT, artist TEXT, category TEXT, info TEXT,
      filename TEXT, time TEXT, modtime INTEGER, publisher TEXT, md5 TEXT
    );
  `);

  mockStore = makeStore();

  const { initializeIpcHandlers } = await import(
    '../../../src/main/modules/ipc-handlers.js'
  );

  initializeIpcHandlers({
    mainWindow: { webContents: { send: vi.fn() } },
    db,
    store: mockStore,
    audioInstances: new Map(),
    autoUpdater: null,
    debugLog: mockDebugLog,
    logService: null,
    updateState: { downloaded: false },
  });
});

afterAll(() => { db?.close(); });

function invoke(channel, ...args) {
  const fn = handlers[channel];
  if (!fn) throw new Error(`No handler registered for "${channel}"`);
  return fn(fakeEvent, ...args);
}

function seedCategories(rows = [
  { code: 'GAME', description: 'Game' },
  { code: 'GROAN', description: 'Groaner' },
  { code: 'END', description: 'Show Ending' },
]) {
  db.exec('DELETE FROM categories');
  const stmt = db.prepare('INSERT INTO categories (code, description) VALUES (?, ?)');
  rows.forEach(r => stmt.run([r.code, r.description]));
  stmt.finalize();
}

function seedSongs(rows = [
  { title: 'Song A', artist: 'A', category: 'GAME', info: '', filename: 'a.mp3', time: '0:06', modtime: 0 },
  { title: 'Song B', artist: 'B', category: 'GAME', info: '', filename: 'b.mp3', time: '0:06', modtime: 0 },
  { title: 'Song C', artist: 'C', category: 'END', info: '', filename: 'c.mp3', time: '0:06', modtime: 0 },
]) {
  db.exec('DELETE FROM mrvoice');
  const stmt = db.prepare(
    'INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  rows.forEach(r => stmt.run([r.title, r.artist, r.category, r.info, r.filename, r.time, r.modtime]));
  stmt.finalize();
}

beforeEach(() => {
  vi.clearAllMocks();
  seedCategories();
  seedSongs();
  storeData = {};
});

// ═══════════════════════════════════════════════════════════════════════
// Store operations
// ═══════════════════════════════════════════════════════════════════════

describe('store-get', () => {
  it('returns stored value', async () => {
    storeData.music_directory = '/music';
    const res = await invoke('store-get', 'music_directory');
    expect(res.success).toBe(true);
    expect(res.value).toBe('/music');
  });

  it('returns undefined for missing key', async () => {
    const res = await invoke('store-get', 'nonexistent');
    expect(res.success).toBe(true);
    expect(res.value).toBeUndefined();
  });
});

describe('store-set', () => {
  it('sets and verifies value', async () => {
    const res = await invoke('store-set', 'theme', 'dark');
    expect(res.success).toBe(true);
    expect(res.value).toBe('dark');
    expect(storeData.theme).toBe('dark');
  });

  it('overwrites existing value', async () => {
    storeData.volume = 0.5;
    await invoke('store-set', 'volume', 0.8);
    expect(storeData.volume).toBe(0.8);
  });
});

describe('store-has', () => {
  it('returns true for existing key', async () => {
    storeData.myKey = 'val';
    const res = await invoke('store-has', 'myKey');
    expect(res.success).toBe(true);
    expect(res.has).toBe(true);
  });

  it('returns false for missing key', async () => {
    const res = await invoke('store-has', 'nope');
    expect(res.success).toBe(true);
    expect(res.has).toBe(false);
  });
});

describe('store-delete', () => {
  it('removes the key', async () => {
    storeData.toRemove = 'bye';
    const res = await invoke('store-delete', 'toRemove');
    expect(res.success).toBe(true);
    expect(storeData).not.toHaveProperty('toRemove');
  });
});

describe('store-keys', () => {
  it('returns all store keys', async () => {
    storeData.a = 1;
    storeData.b = 2;
    const res = await invoke('store-keys');
    expect(res.success).toBe(true);
    expect(res.keys).toEqual(expect.arrayContaining(['a', 'b']));
  });
});

describe('store-clear', () => {
  it('removes all data', async () => {
    storeData.x = 1;
    storeData.y = 2;
    const res = await invoke('store-clear');
    expect(res.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Category operations (update + delete with UNC logic)
// ═══════════════════════════════════════════════════════════════════════

describe('update-category', () => {
  it('updates description for existing category', async () => {
    const res = await invoke('update-category', 'GAME', 'Games & Fun');
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(1);

    const stmt = db.prepare('SELECT description FROM categories WHERE code = ?');
    const row = stmt.get('GAME');
    stmt.finalize();
    expect(row.description).toBe('Games & Fun');
  });

  it('returns changes=0 for nonexistent code', async () => {
    const res = await invoke('update-category', 'NOPE', 'Nothing');
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(0);
  });

  it('returns error when code or description is missing', async () => {
    const res1 = await invoke('update-category', null, 'Desc');
    expect(res1.success).toBe(false);
    const res2 = await invoke('update-category', 'GAME', null);
    expect(res2.success).toBe(false);
  });
});

describe('delete-category', () => {
  it('ensures UNC category exists before deleting', async () => {
    await invoke('delete-category', 'GROAN');

    const stmt = db.prepare('SELECT * FROM categories WHERE code = ?');
    const unc = stmt.get('UNC');
    stmt.finalize();
    expect(unc).toBeTruthy();
    expect(unc.description).toBe('Uncategorized');
  });

  it('reassigns songs from deleted category to UNC', async () => {
    // GAME has 2 songs
    const res = await invoke('delete-category', 'GAME');
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(1); // 1 category deleted

    const stmt = db.prepare('SELECT count(*) as c FROM mrvoice WHERE category = ?');
    const uncSongs = stmt.get('UNC');
    const gameSongs = stmt.get('GAME');
    stmt.finalize();
    expect(uncSongs.c).toBe(2); // both GAME songs moved to UNC
    expect(gameSongs.c).toBe(0);
  });

  it('handles deleting category with no songs', async () => {
    // GROAN has no songs in our test data
    db.exec('DELETE FROM mrvoice WHERE category = \'GROAN\'');
    const res = await invoke('delete-category', 'GROAN');
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(1);
  });

  it('rejects deletion of UNC category', async () => {
    const res = await invoke('delete-category', 'UNC');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cannot delete/i);
  });

  it('returns error when code is missing', async () => {
    const res = await invoke('delete-category', null);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/required/i);
  });

  it('preserves songs from other categories', async () => {
    await invoke('delete-category', 'GAME');

    const stmt = db.prepare('SELECT count(*) as c FROM mrvoice WHERE category = ?');
    const endSongs = stmt.get('END');
    stmt.finalize();
    expect(endSongs.c).toBe(1); // END songs untouched
  });
});
