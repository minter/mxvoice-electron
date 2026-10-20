import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBoardStore, BoardStoreError } from '../../../src/main/modules/board-store.js';
import { BOARD_DOCUMENT_VERSION } from '../../../src/main/modules/board-document.js';

const FIXTURE = path.resolve('tests/fixtures/state-4.3.json');
const NOTICE = "Mx. Voice couldn't read this profile's boards and opened the previous copy.";

let root;
let registered;
let idCounter;
let store;

const dirOf = (name) => path.join(root, name);
const boardsPath = (name) => path.join(dirOf(name), 'boards.json');
const statePath = (name) => path.join(dirOf(name), 'state.json');
const listing = (name) => fs.readdirSync(dirOf(name)).sort();
const snapshot = (name) =>
  Object.fromEntries(listing(name).map((f) => [f, fs.readFileSync(path.join(dirOf(name), f), 'utf8')]));

function makeStore() {
  return createBoardStore({
    fs,
    getProfileBoardsPath: boardsPath,
    getProfileStatePath: statePath,
    profileExists: async (name) => registered.has(name),
    debugLog: { info() {}, warn() {}, error() {} },
    now: () => 1700000000000,
    newId: () => `id-${++idCounter}`
  });
}

function addProfile(name, files = {}) {
  registered.add(name);
  fs.mkdirSync(dirOf(name), { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dirOf(name), file), content);
  }
}

const validDoc = (id = 'good') => ({
  version: BOARD_DOCUMENT_VERSION,
  activeBoardId: id,
  boards: [{ id, name: 'Mine', createdAt: 1, updatedAt: 1, layout: {} }]
});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-store-'));
  registered = new Set();
  idCounter = 0;
  store = makeStore();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('board store', () => {
  it('migrates state.json into one board named "Board" and leaves state.json byte-identical', async () => {
    const state = fs.readFileSync(FIXTURE, 'utf8');
    addProfile('p', { 'state.json': state });
    const { doc, source } = await store.load('p');
    expect(source).toBe('migrated-state');
    expect(doc.boards).toHaveLength(1);
    expect(doc.boards[0].name).toBe('Board');
    expect(doc.activeBoardId).toBe(doc.boards[0].id);
    expect(fs.readFileSync(statePath('p'), 'utf8')).toBe(state);
    expect(JSON.parse(fs.readFileSync(boardsPath('p'), 'utf8')).boards[0].id).toBe(doc.boards[0].id);
  });

  it('falls back to state.json.backup when state.json is corrupt', async () => {
    addProfile('p', {
      'state.json': '{ not json',
      'state.json.backup': fs.readFileSync(FIXTURE, 'utf8')
    });
    const { doc, source } = await store.load('p');
    expect(source).toBe('migrated-state-backup');
    expect(doc.boards[0].layout.hotkeys[0].hotkeys.f1).toBe('101');
  });

  it('creates an empty "Board" when the profile has no state at all', async () => {
    addProfile('p');
    const { doc, source } = await store.load('p');
    expect(source).toBe('migrated-empty');
    expect(doc.boards[0].name).toBe('Board');
    expect(doc.boards[0].layout.hotkeys).toHaveLength(5);
    expect(fs.existsSync(boardsPath('p'))).toBe(true);
  });

  it('creates the profile directory if missing when migrating a registered profile', async () => {
    registered.add('p');
    const { source } = await store.load('p');
    expect(source).toBe('migrated-empty');
    expect(fs.existsSync(boardsPath('p'))).toBe(true);
  });

  it('is idempotent: a second load reads boards.json and does not re-migrate', async () => {
    addProfile('p', { 'state.json': fs.readFileSync(FIXTURE, 'utf8') });
    const first = await store.load('p');
    const second = await store.load('p');
    expect(second.source).toBe('boards');
    expect(second.doc).toEqual(first.doc);
    expect(idCounter).toBe(1);
  });

  it('recovers from .prev, quarantines the bad file and promotes .prev', async () => {
    addProfile('p', {
      'boards.json': '{ truncated',
      'boards.json.prev': JSON.stringify(validDoc())
    });
    const { doc, source, notice } = await store.load('p');
    expect(source).toBe('recovered');
    expect(notice).toBe(NOTICE);
    expect(doc.activeBoardId).toBe('good');
    expect(listing('p').some((f) => f.startsWith('boards.json.corrupt-'))).toBe(true);
    expect(fs.existsSync(`${boardsPath('p')}.prev`)).toBe(true);

    const again = await store.load('p');
    expect(again.source).toBe('boards');
    expect(again.notice).toBeUndefined();
    expect(again.doc.activeBoardId).toBe('good');
  });

  it('treats a shape-invalid main like a parse failure and recovers from .prev', async () => {
    addProfile('p', {
      'boards.json': JSON.stringify({ version: 1, boards: [] }),
      'boards.json.prev': JSON.stringify(validDoc())
    });
    const { source } = await store.load('p');
    expect(source).toBe('recovered');
    expect(listing('p').some((f) => f.startsWith('boards.json.corrupt-'))).toBe(true);
  });

  it('recovers from .prev when main is missing without quarantining anything', async () => {
    addProfile('p', { 'boards.json.prev': JSON.stringify(validDoc()) });
    const { source, notice } = await store.load('p');
    expect(source).toBe('recovered');
    expect(notice).toBe(NOTICE);
    expect(listing('p').some((f) => f.includes('corrupt'))).toBe(false);
    expect((await store.load('p')).source).toBe('boards');
  });

  it('throws unreadable and writes nothing when both files are bad', async () => {
    addProfile('p', {
      'boards.json': '{ bad',
      'boards.json.prev': JSON.stringify({ version: 1, boards: [] }),
      'state.json': fs.readFileSync(FIXTURE, 'utf8')
    });
    const before = snapshot('p');
    await expect(store.load('p')).rejects.toMatchObject({ code: 'unreadable' });
    expect(snapshot('p')).toEqual(before);
  });

  it('throws unreadable when main is bad and .prev is missing', async () => {
    addProfile('p', { 'boards.json': '{ bad' });
    const before = snapshot('p');
    const error = await store.load('p').catch((e) => e);
    expect(error).toBeInstanceOf(BoardStoreError);
    expect(error.code).toBe('unreadable');
    expect(snapshot('p')).toEqual(before);
  });

  it('throws version for a version-2 document and leaves it untouched', async () => {
    addProfile('p', {
      'boards.json': JSON.stringify({ version: 2, boards: [] }),
      'boards.json.prev': JSON.stringify(validDoc())
    });
    const before = snapshot('p');
    await expect(store.load('p')).rejects.toMatchObject({ code: 'version' });
    expect(snapshot('p')).toEqual(before);
  });

  it('throws version when only .prev is a future version, with a bad main', async () => {
    addProfile('p', {
      'boards.json': '{ bad',
      'boards.json.prev': JSON.stringify({ version: 2, boards: [] })
    });
    const before = snapshot('p');
    await expect(store.load('p')).rejects.toMatchObject({ code: 'version' });
    expect(snapshot('p')).toEqual(before);
  });

  it('throws io and touches nothing when the main file cannot be read', async () => {
    addProfile('p', { 'boards.json.prev': JSON.stringify(validDoc()) });
    fs.mkdirSync(boardsPath('p')); // reading a directory fails with EISDIR
    const before = listing('p');
    await expect(store.load('p')).rejects.toMatchObject({ code: 'io' });
    expect(listing('p')).toEqual(before);
    expect(await store.peek('p')).toBeNull();
  });

  it('throws io and creates nothing when state.json cannot be read', async () => {
    addProfile('p');
    fs.mkdirSync(statePath('p'));
    const before = listing('p');
    await expect(store.load('p')).rejects.toMatchObject({ code: 'io' });
    expect(listing('p')).toEqual(before);
    expect(fs.existsSync(boardsPath('p'))).toBe(false);
    expect(await store.peek('p')).toBeNull();
  });

  it('throws io when state.json is corrupt and state.json.backup cannot be read', async () => {
    addProfile('p', { 'state.json': '{ bad' });
    fs.mkdirSync(`${statePath('p')}.backup`);
    await expect(store.load('p')).rejects.toMatchObject({ code: 'io' });
    expect(fs.existsSync(boardsPath('p'))).toBe(false);
  });

  it('save refuses an invalid document', async () => {
    addProfile('p', { 'boards.json': JSON.stringify(validDoc()) });
    const before = snapshot('p');
    await expect(store.save('p', { version: 1, boards: [] })).rejects.toMatchObject({ code: 'shape' });
    expect(snapshot('p')).toEqual(before);
  });

  it('save refuses to overwrite a future-version file', async () => {
    addProfile('p', { 'boards.json': JSON.stringify({ version: 2, boards: [] }) });
    const before = snapshot('p');
    await expect(store.save('p', validDoc())).rejects.toMatchObject({ code: 'version' });
    expect(snapshot('p')).toEqual(before);
  });

  it('save refuses when the existing main file cannot be read', async () => {
    addProfile('p');
    fs.mkdirSync(boardsPath('p'));
    await expect(store.save('p', validDoc())).rejects.toMatchObject({ code: 'io' });
    expect(fs.statSync(boardsPath('p')).isDirectory()).toBe(true);
  });

  it('save overwrites a corrupt main file', async () => {
    addProfile('p', { 'boards.json': '{ bad' });
    await store.save('p', validDoc());
    expect(JSON.parse(fs.readFileSync(boardsPath('p'), 'utf8')).activeBoardId).toBe('good');
  });

  it('refuses to load, save or migrate for an unregistered profile', async () => {
    fs.mkdirSync(dirOf('ghost'), { recursive: true });
    await expect(store.load('ghost')).rejects.toMatchObject({ code: 'unregistered' });
    await expect(store.save('ghost', validDoc())).rejects.toMatchObject({ code: 'unregistered' });
    expect(listing('ghost')).toEqual([]);
  });

  it('save writes atomically and keeps the previous generation', async () => {
    addProfile('p');
    const { doc } = await store.load('p');
    await store.save('p', { ...doc, boards: [{ ...doc.boards[0], name: 'Renamed' }] });
    expect(JSON.parse(fs.readFileSync(boardsPath('p'), 'utf8')).boards[0].name).toBe('Renamed');
    expect(JSON.parse(fs.readFileSync(`${boardsPath('p')}.prev`, 'utf8')).boards[0].name).toBe('Board');
  });

  it('peek migrates in memory and leaves the profile directory byte-identical', async () => {
    addProfile('p', { 'state.json': fs.readFileSync(FIXTURE, 'utf8') });
    const before = snapshot('p');
    const doc = await store.peek('p');
    expect(doc.boards[0].name).toBe('Board');
    expect(doc.boards[0].layout.hotkeys[0].hotkeys.f1).toBe('101');
    expect(snapshot('p')).toEqual(before);
  });

  it('peek returns the stored document, and null for unregistered, unreadable and version files', async () => {
    addProfile('good', { 'boards.json': JSON.stringify(validDoc()) });
    addProfile('bad', { 'boards.json': '{ bad' });
    addProfile('future', { 'boards.json': JSON.stringify({ version: 2 }) });
    fs.mkdirSync(dirOf('ghost'));
    expect((await store.peek('good')).activeBoardId).toBe('good');
    expect(await store.peek('bad')).toBeNull();
    expect(await store.peek('future')).toBeNull();
    expect(await store.peek('ghost')).toBeNull();
    expect(listing('bad')).toEqual(['boards.json']);
  });

  it('resetUnreadable quarantines the bad files and writes one empty "Board"', async () => {
    addProfile('p', {
      'boards.json': '{ bad',
      'boards.json.prev': '{ also bad',
      'state.json': fs.readFileSync(FIXTURE, 'utf8')
    });
    const { doc } = await store.resetUnreadable('p');
    expect(doc.boards).toHaveLength(1);
    expect(doc.boards[0].name).toBe('Board');
    expect(doc.boards[0].layout.hotkeys[0].hotkeys).toEqual({});
    const files = listing('p');
    expect(files.filter((f) => f.startsWith('boards.json.corrupt-'))).toHaveLength(1);
    expect(files.filter((f) => f.startsWith('boards.json.prev.corrupt-'))).toHaveLength(1);
    expect(files).not.toContain('boards.json.prev');
    expect((await store.load('p')).source).toBe('boards');
  });

  it('resetUnreadable does not destroy a healthy document', async () => {
    addProfile('p', { 'boards.json': JSON.stringify(validDoc()) });
    const { doc } = await store.resetUnreadable('p');
    expect(doc.activeBoardId).toBe('good');
    expect(listing('p')).toEqual(['boards.json']);
  });

  it('migration of a real 4.3.x state.json fixture keeps every id', async () => {
    const state = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    addProfile('p', { 'state.json': JSON.stringify(state) });
    const { doc } = await store.load('p');
    const layout = doc.boards[0].layout;
    expect(layout.hotkeys).toEqual(state.hotkeys);
    expect(layout.holdingTank).toEqual(state.holdingTank);
  });
});
