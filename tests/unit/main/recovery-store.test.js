import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRecoveryStore } from '../../../src/main/modules/recovery-store.js';

let root;
let recoveryDir;
let clock;
let debugLog;
let store;

const profilesDir = () => path.join(root, 'profiles');
const pathFor = (name) => path.join(recoveryDir, `${name.toLowerCase()}.json`);
const LAYOUT = { slots: [{ id: 'a' }] };

function makeStore(overrides = {}) {
  return createRecoveryStore({
    fs,
    getRecoveryDirectory: () => recoveryDir,
    getRecoveryPath: pathFor,
    debugLog,
    now: () => clock,
    ...overrides
  });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-recovery-'));
  recoveryDir = path.join(root, 'recovery');
  clock = 1700000000000;
  debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  store = makeStore();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('recovery store', () => {
  it('lives outside the profile directory', async () => {
    await store.write('Show', { boardId: 'b1', layout: LAYOUT });
    expect(pathFor('Show').startsWith(profilesDir())).toBe(false);
    expect(fs.existsSync(pathFor('Show'))).toBe(true);
  });

  it('round-trips layout, boardId and savedAt, with no .prev and no stray files', async () => {
    await store.write('Show', { boardId: 'b1', layout: LAYOUT });
    expect(await store.read('Show')).toEqual({
      version: 1, boardId: 'b1', savedAt: clock, handoff: null, layout: LAYOUT
    });
    expect(fs.readdirSync(recoveryDir)).toEqual(['show.json']);
  });

  it('read returns null when missing', async () => {
    expect(await store.read('Nobody')).toBeNull();
  });

  it('retire is a no-op when missing and never creates directories', async () => {
    await store.retire('Show');
    expect(fs.existsSync(recoveryDir)).toBe(false);
  });

  it('retire removes an existing record', async () => {
    await store.write('Show', { boardId: 'b1', layout: LAYOUT });
    await store.retire('Show');
    expect(await store.read('Show')).toBeNull();
  });

  it('markHandoff sets handoff on an existing record only, keeping savedAt', async () => {
    expect(await store.markHandoff('Show', 'update')).toBe(false);
    expect(fs.existsSync(recoveryDir)).toBe(false);

    await store.write('Show', { boardId: 'b1', layout: LAYOUT });
    clock += 5000;
    expect(await store.markHandoff('Show', 'renderer-crash')).toBe(true);
    const rec = await store.read('Show');
    expect(rec.handoff).toBe('renderer-crash');
    expect(rec.savedAt).toBe(1700000000000);
    expect(rec.handoffAt).toBe(1700000005000);
    expect(rec.layout).toEqual(LAYOUT);
    expect(fs.readdirSync(recoveryDir)).toEqual(['show.json']);
  });

  it('clearHandoff makes a handed-off record an ordinary one, keeping savedAt and the layout', async () => {
    expect(await store.clearHandoff('Show')).toBe(false);
    expect(fs.existsSync(recoveryDir)).toBe(false);

    await store.write('Show', { boardId: 'b1', layout: LAYOUT });
    await store.markHandoff('Show', 'update');
    clock += 5000;
    expect(await store.clearHandoff('Show')).toBe(true);
    const rec = await store.read('Show');
    expect(rec).toMatchObject({ handoff: null, savedAt: 1700000000000, boardId: 'b1', layout: LAYOUT });
    expect(rec).not.toHaveProperty('handoffAt');

    // A torn record is left alone
    fs.writeFileSync(pathFor('Show'), '{ torn');
    expect(await store.clearHandoff('Show')).toBe(false);
    expect(fs.readFileSync(pathFor('Show'), 'utf8')).toBe('{ torn');
  });

  it('markHandoff rejects unknown reasons', async () => {
    await store.write('Show', { boardId: 'b1', layout: LAYOUT });
    await expect(store.markHandoff('Show', 'bogus')).rejects.toThrow();
    await expect(store.markHandoff('Show', undefined)).rejects.toThrow();
  });

  it('markHandoff returns false and writes nothing for an unreadable record', async () => {
    fs.mkdirSync(recoveryDir);
    fs.writeFileSync(pathFor('Show'), '{ torn');
    expect(await store.markHandoff('Show', 'update')).toBe(false);
    expect(fs.readFileSync(pathFor('Show'), 'utf8')).toBe('{ torn');
  });

  it('a torn record reads as null and is quarantined', async () => {
    fs.mkdirSync(recoveryDir);
    fs.writeFileSync(pathFor('Show'), '{ "version": 1, "layo');
    expect(await store.read('Show')).toBeNull();
    const files = fs.readdirSync(recoveryDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^show\.json\.corrupt-/);
  });

  it.each([['array', '[]'], ['null', 'null'], ['wrong version', '{"version":2}']])(
    'a %s record is quarantined',
    async (_n, body) => {
      fs.mkdirSync(recoveryDir);
      fs.writeFileSync(pathFor('Show'), body);
      expect(await store.read('Show')).toBeNull();
      expect(fs.existsSync(pathFor('Show'))).toBe(false);
      expect(fs.readdirSync(recoveryDir)[0]).toMatch(/\.corrupt-/);
    }
  );

  it('an I/O read error warns, returns null and does not quarantine', async () => {
    fs.mkdirSync(recoveryDir);
    fs.writeFileSync(pathFor('Show'), '{}');
    const failingFs = {
      ...fs,
      promises: {
        ...fs.promises,
        readFile: async () => { throw Object.assign(new Error('locked'), { code: 'EBUSY' }); }
      }
    };
    const s = makeStore({ fs: failingFs });
    expect(await s.read('Show')).toBeNull();
    expect(debugLog.warn).toHaveBeenCalled();
    expect(fs.readdirSync(recoveryDir)).toEqual(['show.json']);
  });

  it('clearAll removes every record but leaves other files', async () => {
    await store.write('A', { boardId: 'a', layout: LAYOUT });
    await store.write('B', { boardId: 'b', layout: LAYOUT });
    fs.writeFileSync(path.join(recoveryDir, 'notes.txt'), 'keep');
    await store.clearAll();
    expect(fs.readdirSync(recoveryDir)).toEqual(['notes.txt']);
  });

  it('clearAll tolerates a missing directory', async () => {
    await expect(store.clearAll()).resolves.toBeUndefined();
    expect(fs.existsSync(recoveryDir)).toBe(false);
  });

  it.each(['', '   ', null, undefined, 42])('rejects invalid profile name %j', async (name) => {
    await expect(store.write(name, { boardId: 'b', layout: LAYOUT })).rejects.toThrow();
    await expect(store.read(name)).rejects.toThrow();
    await expect(store.markHandoff(name, 'update')).rejects.toThrow();
    await expect(store.retire(name)).rejects.toThrow();
  });
});
