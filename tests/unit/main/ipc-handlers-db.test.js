/**
 * Unit tests for the named database IPC handlers in ipc-handlers.js.
 *
 * Strategy: rather than booting Electron and registering real ipcMain handlers,
 * we stub `ipcMain.handle` to capture each handler function by name, then call
 * those functions directly against a real in-memory SQLite database.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import pkg from 'node-sqlite3-wasm';

const { Database, onRuntimeInitialized } = pkg;

// ── Stubs for Electron APIs ───────────────────────────────────────────

const handlers = {};

// Capture every ipcMain.handle registration so we can invoke handlers directly
const fakeIpcMain = {
  handle: (channel, fn) => { handlers[channel] = fn; },
  on: () => {},
};

// Minimal stubs for dependencies the module expects
const fakeDialog = { showOpenDialogSync: vi.fn() };
const fakeApp = { getAppPath: vi.fn(() => '/fake'), getPath: vi.fn(() => '/fake') };

// Stub the electron module before importing ipc-handlers
vi.mock('electron', () => ({
  default: {
    ipcMain: fakeIpcMain,
    dialog: fakeDialog,
    app: fakeApp,
  },
  ipcMain: fakeIpcMain,
  dialog: fakeDialog,
  app: fakeApp,
}));

// Stub file-operations (not under test here)
vi.mock('../../../src/main/modules/file-operations.js', () => ({
  default: { initializeFileOperations: vi.fn() },
}));

// Stub profile modules
vi.mock('../../../src/main/modules/profile-manager.js', () => ({}));
vi.mock('../../../src/main/modules/profile-backup-manager.js', () => ({}));

// Stub howler (not needed for db tests)
vi.mock('howler', () => ({ Howl: vi.fn(), Howler: {} }));

// Stub music-metadata
vi.mock('music-metadata', () => ({ parseFile: vi.fn() }));

// ── Database & handler setup ──────────────────────────────────────────

let db;
const mockDebugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const fakeEvent = {}; // ipcMain handlers receive (event, ...args)

beforeAll(async () => {
  await onRuntimeInitialized;
  db = new Database(':memory:');

  // Create schema (matches test-database-manager)
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      code TEXT PRIMARY KEY,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS mrvoice (
      id INTEGER PRIMARY KEY,
      title TEXT,
      artist TEXT,
      category TEXT,
      info TEXT,
      filename TEXT,
      time TEXT,
      modtime INTEGER,
      publisher TEXT,
      md5 TEXT
    );
  `);

  // Import & initialize — this populates `handlers` via the fakeIpcMain stub
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

afterAll(() => {
  db?.close();
});

// ── Seed helpers ──────────────────────────────────────────────────────

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
  { title: 'Got The Time', artist: 'Anthrax', category: 'GAME', info: 'Countdown', filename: 'anthrax.mp3', time: '0:06', modtime: Math.floor(Date.now() / 1000) },
  { title: 'Eat It', artist: 'Weird Al', category: 'GROAN', info: '', filename: 'weird-al.mp3', time: '0:06', modtime: Math.floor(Date.now() / 1000) },
  { title: 'We Are Family', artist: 'Sister Sledge', category: 'END', info: '', filename: 'family.mp3', time: '0:07', modtime: Math.floor(Date.now() / 1000) - 90 * 86400 },
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
});

// ── Helpers ───────────────────────────────────────────────────────────

/** Call a captured IPC handler by channel name. */
function invoke(channel, ...args) {
  const fn = handlers[channel];
  if (!fn) throw new Error(`No handler registered for "${channel}"`);
  return fn(fakeEvent, ...args);
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('get-categories', () => {
  it('returns all categories sorted by description', async () => {
    const res = await invoke('get-categories');
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(3);
    // Sorted by description ASC: "Game", "Groaner", "Show Ending"
    expect(res.data[0].description).toBe('Game');
    expect(res.data[2].description).toBe('Show Ending');
  });

  it('returns empty array when no categories exist', async () => {
    db.exec('DELETE FROM categories');
    const res = await invoke('get-categories');
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });
});

describe('add-song', () => {
  it('inserts a song and returns lastInsertRowid', async () => {
    const res = await invoke('add-song', {
      title: 'New Song',
      artist: 'Test Artist',
      category: 'GAME',
      filename: 'new.mp3',
      duration: '1:30',
    });
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(1);
    expect(res.data.lastInsertRowid).toBeGreaterThan(0);

    // Verify it's actually in the database
    const stmt = db.prepare('SELECT * FROM mrvoice WHERE title = ?');
    const row = stmt.get('New Song');
    stmt.finalize();
    expect(row.artist).toBe('Test Artist');
    expect(row.time).toBe('1:30');
  });

  it('defaults info to empty string', async () => {
    await invoke('add-song', {
      title: 'No Info Song',
      artist: 'Artist',
      category: 'GAME',
      filename: 'no-info.mp3',
    });
    const stmt = db.prepare('SELECT info FROM mrvoice WHERE title = ?');
    const row = stmt.get('No Info Song');
    stmt.finalize();
    expect(row.info).toBe('');
  });
});

describe('delete-song', () => {
  it('deletes a song by id', async () => {
    // Get a song id first
    const stmt = db.prepare('SELECT id FROM mrvoice LIMIT 1');
    const row = stmt.get();
    stmt.finalize();

    const res = await invoke('delete-song', row.id);
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(1);
  });

  it('returns changes=0 for non-existent id', async () => {
    const res = await invoke('delete-song', 99999);
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(0);
  });

  it('returns error when id is missing', async () => {
    const res = await invoke('delete-song', null);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/required/i);
  });
});

describe('update-song', () => {
  it('updates only provided fields', async () => {
    const stmt = db.prepare('SELECT id, artist FROM mrvoice LIMIT 1');
    const original = stmt.get();
    stmt.finalize();

    const res = await invoke('update-song', { id: original.id, title: 'Updated Title' });
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(1);

    // Artist should be unchanged
    const check = db.prepare('SELECT title, artist FROM mrvoice WHERE id = ?');
    const updated = check.get(original.id);
    check.finalize();
    expect(updated.title).toBe('Updated Title');
    expect(updated.artist).toBe(original.artist);
  });

  it('updates multiple fields at once', async () => {
    const stmt = db.prepare('SELECT id FROM mrvoice LIMIT 1');
    const { id } = stmt.get();
    stmt.finalize();

    await invoke('update-song', { id, title: 'T', artist: 'A', info: 'I' });

    const check = db.prepare('SELECT title, artist, info FROM mrvoice WHERE id = ?');
    const row = check.get(id);
    check.finalize();
    expect(row).toEqual({ title: 'T', artist: 'A', info: 'I' });
  });

  it('returns error when no fields are provided', async () => {
    const res = await invoke('update-song', { id: 1 });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no fields/i);
  });

  it('returns error when id is missing', async () => {
    const res = await invoke('update-song', { title: 'Oops' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/required/i);
  });
});

describe('search-songs', () => {
  it('returns all songs when no filters are provided', async () => {
    const res = await invoke('search-songs', {});
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(3);
  });

  it('filters by category', async () => {
    const res = await invoke('search-songs', { category: 'GAME' });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].category).toBe('GAME');
  });

  it('wildcard category returns all songs', async () => {
    const res = await invoke('search-songs', { category: '*' });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(3);
  });

  it('basic search term matches title, artist, or info', async () => {
    const res = await invoke('search-songs', { searchTerm: 'Anthrax' });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe('Got The Time');
  });

  it('basic search is case-insensitive (SQLite LIKE)', async () => {
    const res = await invoke('search-songs', { searchTerm: 'anthrax' });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
  });

  it('search term can match info field', async () => {
    const res = await invoke('search-songs', { searchTerm: 'Countdown' });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
  });

  it('combines category + search term', async () => {
    const res = await invoke('search-songs', { category: 'GAME', searchTerm: 'Time' });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
  });

  it('category + non-matching search returns empty', async () => {
    const res = await invoke('search-songs', { category: 'GAME', searchTerm: 'Nonexistent' });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(0);
  });

  describe('advanced filters', () => {
    it('filters by title', async () => {
      const res = await invoke('search-songs', {
        advancedFilters: { title: 'Family' },
      });
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].artist).toBe('Sister Sledge');
    });

    it('filters by artist', async () => {
      const res = await invoke('search-songs', {
        advancedFilters: { artist: 'Weird' },
      });
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
    });

    it('filters by info', async () => {
      const res = await invoke('search-songs', {
        advancedFilters: { info: 'Countdown' },
      });
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
    });

    it('filters by since (days)', async () => {
      // "We Are Family" has modtime 90 days ago; the other two are recent
      const res = await invoke('search-songs', {
        advancedFilters: { since: '30' },
      });
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);
      expect(res.data.every(s => s.title !== 'We Are Family')).toBe(true);
    });

    it('combines multiple advanced filters', async () => {
      const res = await invoke('search-songs', {
        category: 'GAME',
        advancedFilters: { title: 'Got' },
      });
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
    });
  });

  it('returns error for invalid search params', async () => {
    const res = await invoke('search-songs', null);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/required/i);
  });
});

describe('get-songs-by-ids', () => {
  it('returns songs matching the given ids', async () => {
    // Get actual ids from the database
    const stmt = db.prepare('SELECT id FROM mrvoice');
    const allIds = stmt.all([]).map(r => r.id);
    stmt.finalize();

    const res = await invoke('get-songs-by-ids', allIds.slice(0, 2));
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
  });

  it('returns empty array for empty ids', async () => {
    const res = await invoke('get-songs-by-ids', []);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });

  it('filters out non-numeric ids', async () => {
    const res = await invoke('get-songs-by-ids', ['abc', null, undefined]);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });

  it('returns empty for non-existent ids', async () => {
    const res = await invoke('get-songs-by-ids', [99999, 99998]);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });
});

describe('get-category-by-code', () => {
  it('returns matching category', async () => {
    const res = await invoke('get-category-by-code', 'GAME');
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].description).toBe('Game');
  });

  it('returns empty array for unknown code', async () => {
    const res = await invoke('get-category-by-code', 'NOPE');
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });

  it('returns error when code is missing', async () => {
    const res = await invoke('get-category-by-code', null);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/required/i);
  });
});

describe('add-category', () => {
  it('inserts a new category', async () => {
    const res = await invoke('add-category', { code: 'NEW', description: 'New Cat' });
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(1);

    const check = db.prepare('SELECT description FROM categories WHERE code = ?');
    const row = check.get('NEW');
    check.finalize();
    expect(row.description).toBe('New Cat');
  });

  it('returns error for duplicate code', async () => {
    const res = await invoke('add-category', { code: 'GAME', description: 'Duplicate' });
    expect(res.success).toBe(false);
  });

  it('returns error when code or description is missing', async () => {
    const res = await invoke('add-category', { code: 'X' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/required/i);
  });
});

describe('reassign-song-category', () => {
  it('moves songs from one category to another', async () => {
    const res = await invoke('reassign-song-category', 'GAME', 'END');
    expect(res.success).toBe(true);
    expect(res.data.changes).toBe(1);

    const stmt = db.prepare('SELECT count(*) as c FROM mrvoice WHERE category = ?');
    const gameCount = stmt.get('GAME');
    const endCount = stmt.get('END');
    stmt.finalize();
    expect(gameCount.c).toBe(0);
    expect(endCount.c).toBe(2); // original 1 + moved 1
  });

  it('returns error when codes are missing', async () => {
    const res = await invoke('reassign-song-category', null, 'END');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/required/i);
  });
});

describe('count-songs', () => {
  it('returns the total song count', async () => {
    const res = await invoke('count-songs');
    expect(res.success).toBe(true);
    expect(res.data[0].count).toBe(3);
  });
});

describe('find-category-codes-like', () => {
  it('finds exact code and pattern matches', async () => {
    const res = await invoke('find-category-codes-like', 'G', 'G%');
    expect(res.success).toBe(true);
    // Should match GAME and GROAN (start with G)
    const codes = res.data.map(r => r.code);
    expect(codes).toContain('GAME');
    expect(codes).toContain('GROAN');
  });

  it('returns error when code is missing', async () => {
    const res = await invoke('find-category-codes-like', null);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/required/i);
  });
});
