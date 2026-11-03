import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pkg from 'node-sqlite3-wasm';

vi.mock('electron-store', () => ({ default: class Store { get() { return null; } set() {} } }));
vi.mock('electron', () => ({ default: { app: { getPath: () => '/tmp' } } }));
vi.mock('../../../src/main/modules/debug-log.js', () => ({ default: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

const { Database } = pkg;
const { ensureAutoincrementIds, setupDatabaseIndexes } = (await import('../../../src/main/modules/database-setup.js')).default;

const LEGACY = `CREATE TABLE mrvoice (id INTEGER PRIMARY KEY, title TEXT, artist TEXT, category TEXT, info TEXT, filename TEXT, time TEXT, modtime INTEGER, volume INTEGER DEFAULT 100, start_time REAL DEFAULT NULL, end_time REAL DEFAULT NULL)`;

let dir, dbPath, db;
const backup = () => `${dbPath}.pre-autoincrement`;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-ai-'));
  dbPath = path.join(dir, 'mrvoice.db');
  db = new Database(dbPath);
  db.exec(LEGACY);
  for (let i = 1; i <= 3; i++) {
    db.run('INSERT INTO mrvoice (title, artist, volume, start_time, end_time) VALUES (?, ?, ?, ?, ?)', [`t${i}`, `a${i}`, 50 + i, i, i + 1]);
  }
});
afterEach(() => {
  try { db.close(); } catch { /* already closed */ }
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('ensureAutoincrementIds', () => {
  it('preserves every row and id', () => {
    const before = db.all('SELECT * FROM mrvoice ORDER BY id');
    expect(ensureAutoincrementIds(db, { dbPath, fs }).rebuilt).toBe(true);
    expect(db.all('SELECT * FROM mrvoice ORDER BY id')).toEqual(before);
    expect(fs.existsSync(backup())).toBe(true);
  });

  it('a deleted max id is not reused by the next insert', () => {
    ensureAutoincrementIds(db, { dbPath, fs });
    db.run('DELETE FROM mrvoice WHERE id = 3');
    const r = db.run('INSERT INTO mrvoice (title) VALUES (?)', ['new']);
    expect(Number(r.lastInsertRowid)).toBe(4);
  });

  it('is a no-op on an already-migrated table', () => {
    ensureAutoincrementIds(db, { dbPath, fs });
    fs.rmSync(backup());
    expect(ensureAutoincrementIds(db, { dbPath, fs })).toEqual({ rebuilt: false });
    expect(fs.existsSync(backup())).toBe(false);
  });

  it('keeps volume/start_time/end_time columns and defaults', () => {
    ensureAutoincrementIds(db, { dbPath, fs });
    const cols = db.all('PRAGMA table_info(mrvoice)');
    expect(cols.map((c) => c.name)).toEqual(['id', 'title', 'artist', 'category', 'info', 'filename', 'time', 'modtime', 'volume', 'start_time', 'end_time']);
    expect(cols.find((c) => c.name === 'volume').dflt_value).toBe('100');
    db.run('INSERT INTO mrvoice (title) VALUES (?)', ['x']);
    expect(db.get('SELECT volume FROM mrvoice WHERE title = ?', ['x']).volume).toBe(100);
  });

  it('rolls back and leaves mrvoice intact if the copy fails', () => {
    const before = db.all('SELECT * FROM mrvoice ORDER BY id');
    const failing = {
      get: (...a) => db.get(...a),
      all: (...a) => db.all(...a),
      get inTransaction() { return db.inTransaction; },
      exec: (sql) => {
        if (/^INSERT INTO mrvoice_new/.test(sql)) throw new Error('injected');
        return db.exec(sql);
      }
    };
    const result = ensureAutoincrementIds(failing, { dbPath, fs });
    expect(result.rebuilt).toBe(false);
    expect(result.error).toBe('injected');
    expect(db.inTransaction).toBe(false);
    expect(db.all('SELECT * FROM mrvoice ORDER BY id')).toEqual(before);
    expect(db.get("SELECT sql FROM sqlite_master WHERE name='mrvoice_new'")).toBeNull();
    expect(/AUTOINCREMENT/i.test(db.get("SELECT sql FROM sqlite_master WHERE name='mrvoice'").sql)).toBe(false);
  });

  it('does not rebuild if the backup copy fails', () => {
    const badFs = { existsSync: () => false, copyFileSync: () => { throw new Error('disk full'); } };
    expect(ensureAutoincrementIds(db, { dbPath, fs: badFs })).toEqual({ rebuilt: false, error: 'disk full' });
    expect(/AUTOINCREMENT/i.test(db.get("SELECT sql FROM sqlite_master WHERE name='mrvoice'").sql)).toBe(false);
  });

  it('does not overwrite an existing backup', () => {
    fs.writeFileSync(backup(), 'original');
    ensureAutoincrementIds(db, { dbPath, fs });
    expect(fs.readFileSync(backup(), 'utf8')).toBe('original');
  });

  it('works in memory without a backup and indexes can be recreated', () => {
    const mem = new Database(':memory:');
    mem.exec(LEGACY);
    mem.exec('CREATE TABLE categories (code TEXT PRIMARY KEY, description TEXT)');
    mem.run('INSERT INTO mrvoice (title) VALUES (?)', ['a']);
    expect(ensureAutoincrementIds(mem, { dbPath: ':memory:', fs }).rebuilt).toBe(true);
    setupDatabaseIndexes(mem);
    expect(mem.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").length).toBe(4);
    mem.close();
  });

  it('rebuilds 10,000 rows and reports the time', () => {
    db.exec('BEGIN');
    for (let i = 0; i < 10000; i++) db.run('INSERT INTO mrvoice (title, artist, category) VALUES (?, ?, ?)', [`t${i}`, `a${i}`, 'C']);
    db.exec('COMMIT');
    const t = Date.now();
    const r = ensureAutoincrementIds(db, { dbPath, fs });
    console.log(`REBUILD_MS=${Date.now() - t}`);
    expect(r.rebuilt).toBe(true);
    expect(db.get('SELECT COUNT(*) AS n FROM mrvoice').n).toBe(10003);
  });
});
