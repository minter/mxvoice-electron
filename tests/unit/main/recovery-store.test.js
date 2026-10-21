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
    await store.write('Show', { showId: 'b1', layout: LAYOUT });
    expect(pathFor('Show').startsWith(profilesDir())).toBe(false);
    expect(fs.existsSync(pathFor('Show'))).toBe(true);
  });

  it('round-trips layout, showId and savedAt, with no .prev and no stray files', async () => {
    await store.write('Show', { showId: 'b1', layout: LAYOUT });
    expect(await store.read('Show')).toEqual({
      version: 1, showId: 'b1', savedAt: clock, handoff: null, layout: LAYOUT
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
    await store.write('Show', { showId: 'b1', layout: LAYOUT });
    await store.retire('Show');
    expect(await store.read('Show')).toBeNull();
  });

  it('markHandoff sets handoff on an existing record only, keeping savedAt', async () => {
    expect(await store.markHandoff('Show', 'update')).toBe(false);
    expect(fs.existsSync(recoveryDir)).toBe(false);

    await store.write('Show', { showId: 'b1', layout: LAYOUT });
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

    await store.write('Show', { showId: 'b1', layout: LAYOUT });
    await store.markHandoff('Show', 'update');
    clock += 5000;
    expect(await store.clearHandoff('Show')).toBe(true);
    const rec = await store.read('Show');
    expect(rec).toMatchObject({ handoff: null, savedAt: 1700000000000, showId: 'b1', layout: LAYOUT });
    expect(rec).not.toHaveProperty('handoffAt');

    // A torn record is left alone
    fs.writeFileSync(pathFor('Show'), '{ torn');
    expect(await store.clearHandoff('Show')).toBe(false);
    expect(fs.readFileSync(pathFor('Show'), 'utf8')).toBe('{ torn');
  });

  it('markHandoff rejects unknown reasons', async () => {
    await store.write('Show', { showId: 'b1', layout: LAYOUT });
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
    await store.write('A', { showId: 'a', layout: LAYOUT });
    await store.write('B', { showId: 'b', layout: LAYOUT });
    fs.writeFileSync(path.join(recoveryDir, 'notes.txt'), 'keep');
    await store.clearAll();
    expect(fs.readdirSync(recoveryDir)).toEqual(['notes.txt']);
  });

  it('clearAll tolerates a missing directory', async () => {
    await expect(store.clearAll()).resolves.toBeUndefined();
    expect(fs.existsSync(recoveryDir)).toBe(false);
  });

  describe('played counts', () => {
    const playedPath = (name) => path.join(recoveryDir, `${name.toLowerCase()}.played.json`);

    it('writes <key>.played.json next to the layout record and reads it back', async () => {
      await store.writePlayed('Show', { 12: 2, 7: 1 });
      expect(fs.existsSync(playedPath('Show'))).toBe(true);
      expect(await store.readPlayed('Show')).toEqual({
        version: 1, savedAt: clock, handoff: null, counts: { 12: 2, 7: 1 }
      });
      // The layout record is a different file
      expect(await store.read('Show')).toBeNull();
    });

    it('a handed-off write carries handoffAt; an ordinary one does not', async () => {
      await store.writePlayed('Show', { 12: 1 }, { handoff: 'update' });
      expect(await store.readPlayed('Show')).toEqual({
        version: 1, savedAt: clock, handoff: 'update', handoffAt: clock, counts: { 12: 1 }
      });
      await expect(store.writePlayed('Show', { 12: 1 }, { handoff: 'bogus' })).rejects.toThrow();
    });

    it('writing no counts removes the file', async () => {
      await store.writePlayed('Show', { 12: 1 });
      await store.writePlayed('Show', {});
      expect(fs.existsSync(playedPath('Show'))).toBe(false);
      expect(await store.readPlayed('Show')).toBeNull();
    });

    it('drops invalid entries and reads a file with none left as no counts', async () => {
      fs.mkdirSync(recoveryDir, { recursive: true });
      fs.writeFileSync(playedPath('Show'), JSON.stringify({
        version: 1, savedAt: 5, handoff: null, counts: { 12: 3, abc: 2, 9: 0, 8: -1, 7: 1.5, 6: '2' }
      }));
      expect((await store.readPlayed('Show')).counts).toEqual({ 12: 3 });
      fs.writeFileSync(playedPath('Show'), JSON.stringify({ version: 1, savedAt: 5, counts: { abc: 1 } }));
      expect(await store.readPlayed('Show')).toBeNull();
    });

    it('a torn played file reads as null and is quarantined', async () => {
      fs.mkdirSync(recoveryDir, { recursive: true });
      fs.writeFileSync(playedPath('Show'), '{"version":1,');
      expect(await store.readPlayed('Show')).toBeNull();
      const names = fs.readdirSync(recoveryDir);
      expect(names.some((n) => n.startsWith('show.played.json.corrupt-'))).toBe(true);
    });

    it('retire leaves the played file; retirePlayed removes only it', async () => {
      await store.write('Show', { showId: 'b1', layout: LAYOUT });
      await store.writePlayed('Show', { 12: 1 });
      await store.retire('Show');
      expect(fs.existsSync(playedPath('Show'))).toBe(true);
      await store.write('Show', { showId: 'b1', layout: LAYOUT });
      await store.retirePlayed('Show');
      expect(fs.existsSync(playedPath('Show'))).toBe(false);
      expect(fs.existsSync(pathFor('Show'))).toBe(true);
    });

    it('clearAll removes played files too', async () => {
      await store.writePlayed('A', { 1: 1 });
      await store.write('B', { showId: 'b', layout: LAYOUT });
      await store.clearAll();
      expect(fs.readdirSync(recoveryDir)).toEqual([]);
    });
  });

  it.each(['', '   ', null, undefined, 42])('rejects invalid profile name %j', async (name) => {
    await expect(store.write(name, { showId: 'b', layout: LAYOUT })).rejects.toThrow();
    await expect(store.read(name)).rejects.toThrow();
    await expect(store.markHandoff(name, 'update')).rejects.toThrow();
    await expect(store.retire(name)).rejects.toThrow();
  });
});
