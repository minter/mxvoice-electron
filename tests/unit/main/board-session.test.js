import { afterEach, describe, expect, it, vi } from 'vitest';
import nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBoardSession } from '../../../src/main/modules/board-session.js';
import { BoardStoreError, createBoardStore } from '../../../src/main/modules/board-store.js';
import { addBoard, createDocument, normalizeLayout } from '../../../src/main/modules/board-document.js';

const MINUTE = 60 * 1000;
const T0 = 1_000_000_000_000;

function layoutWith(n) {
  const songId = String(n);
  return normalizeLayout({
    hotkeys: [{ tabNumber: 1, hotkeys: { f1: songId } }],
    holdingTank: [{ tabNumber: 1, songIds: [songId] }],
  });
}

function makeDoc(layout = layoutWith(1)) {
  let n = 0;
  return createDocument(layout, { now: T0, newId: () => `board-${++n}` });
}

/** In-memory recovery store with the real store's contract. */
function fakeRecoveryStore(clock) {
  const records = new Map();
  const calls = [];
  return {
    records,
    calls,
    write: vi.fn(async (profile, { boardId, layout }) => {
      calls.push(['write', profile]);
      records.set(profile, { version: 1, boardId, savedAt: clock.now(), handoff: null, layout });
    }),
    read: vi.fn(async (profile) => records.get(profile) ?? null),
    markHandoff: vi.fn(async (profile, reason) => {
      calls.push(['markHandoff', profile, reason]);
      const record = records.get(profile);
      if (!record) return false;
      records.set(profile, { ...record, handoff: reason });
      return true;
    }),
    clearHandoff: vi.fn(async (profile) => {
      calls.push(['clearHandoff', profile]);
      const record = records.get(profile);
      if (!record) return false;
      records.set(profile, { ...record, handoff: null });
      return true;
    }),
    retire: vi.fn(async (profile) => {
      calls.push(['retire', profile]);
      records.delete(profile);
    }),
    clearAll: vi.fn(async () => {
      calls.push(['clearAll']);
      records.clear();
    }),
  };
}

function setup({ doc = makeDoc(), loadError = null, profile = 'Alice', profiles = ['Alice'], boardStore: realStore } = {}) {
  const clock = { t: T0, now: () => clock.t };
  const current = { profile };
  const recoveryStore = fakeRecoveryStore(clock);
  const boardStore = realStore ?? {
    load: vi.fn(async () => {
      if (loadError) throw loadError;
      return { doc, source: 'boards' };
    }),
    resetUnreadable: vi.fn(async () => ({ doc: makeDoc(normalizeLayout(null)) })),
    peek: vi.fn(),
    save: vi.fn(),
  };
  const rebuildMenu = vi.fn();
  const debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  let idCount = 0;
  const session = createBoardSession({
    boardStore,
    recoveryStore,
    listProfiles: () => profiles,
    getCurrentProfile: () => current.profile,
    rebuildMenu,
    now: clock.now,
    newId: () => (++idCount === 1 ? 'new-id' : `new-id-${idCount}`),
    debugLog,
  });
  return { session, boardStore, recoveryStore, rebuildMenu, clock, current, doc, debugLog };
}

async function openReady(ctx) {
  const opened = await ctx.session.open();
  ctx.session.reportReady(opened.generation, true);
  return opened;
}

describe('board session', () => {
  it('open loads the active board and reports recovery when a record exists', async () => {
    const ctx = setup();
    const boardId = ctx.doc.activeBoardId;
    ctx.recoveryStore.records.set('Alice', {
      version: 1, boardId, savedAt: T0 - MINUTE, handoff: null, layout: layoutWith(7),
    });

    const opened = await ctx.session.open();

    expect(ctx.boardStore.load).toHaveBeenCalledWith('Alice');
    expect(opened.doc).toBe(ctx.doc);
    expect(opened.board.id).toBe(boardId);
    expect(opened.board.layout).toEqual(layoutWith(1));
    expect(opened.recovery).toEqual({ savedAt: T0 - MINUTE, handoff: null, boardId });
    expect(opened.generation).toBe(1);
    expect(ctx.session.state()).toMatchObject({ profile: 'Alice', status: 'loading', generation: 1 });
    expect(ctx.rebuildMenu).toHaveBeenCalled();

    // Without a record, recovery is null
    ctx.recoveryStore.records.clear();
    const again = await ctx.session.open();
    expect(again.recovery).toBeNull();
    expect(again.generation).toBe(2);

    // state() is a copy
    const snapshot = ctx.session.state();
    snapshot.status = 'ready';
    expect(ctx.session.state().status).toBe('loading');
  });

  it('open with a fresh "update" handoff returns it; one older than 15 minutes is dropped', async () => {
    const ctx = setup();
    const boardId = ctx.doc.activeBoardId;
    const record = { version: 1, boardId, handoff: 'update', layout: layoutWith(7) };

    ctx.recoveryStore.records.set('Alice', { ...record, savedAt: T0 - 14 * MINUTE });
    expect((await ctx.session.open()).recovery).toEqual({
      savedAt: T0 - 14 * MINUTE, handoff: 'update', boardId,
    });

    ctx.recoveryStore.records.set('Alice', { ...record, savedAt: T0 - 16 * MINUTE });
    expect((await ctx.session.open()).recovery).toEqual({
      savedAt: T0 - 16 * MINUTE, handoff: null, boardId,
    });
  });

  it('saveRecovery is refused while loading, failed or fenced', async () => {
    const ctx = setup();
    const opened = await ctx.session.open();
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ skipped: true });

    ctx.session.reportReady(opened.generation, false);
    expect(ctx.session.state().status).toBe('failed');
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ skipped: true });

    await openReady(ctx);
    await ctx.session.handoff('update');
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ skipped: true });
    expect(ctx.recoveryStore.write).not.toHaveBeenCalled();

    // A ready, unfenced session writes
    await openReady(ctx);
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({});
    expect(ctx.recoveryStore.records.get('Alice')).toMatchObject({
      boardId: ctx.doc.activeBoardId,
      layout: layoutWith(9),
    });
  });

  it('saveRecovery of a layout equal to the saved board retires instead of writing', async () => {
    const ctx = setup();
    await openReady(ctx);
    ctx.recoveryStore.records.set('Alice', { version: 1, boardId: 'x', savedAt: T0, handoff: null, layout: layoutWith(5) });

    const sameButSelected = { ...layoutWith(1), selected: { hotkeyTab: 3, holdingTankTab: 2 } };
    await expect(ctx.session.saveRecovery(sameButSelected)).resolves.toEqual({ retired: true });

    expect(ctx.recoveryStore.write).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Alice');
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
  });

  it('recovery writes go to the profile captured at open, even after getCurrentProfile changes', async () => {
    const ctx = setup();
    await openReady(ctx);
    ctx.current.profile = 'Bob';

    await ctx.session.saveRecovery(layoutWith(9));
    expect(ctx.recoveryStore.write).toHaveBeenCalledWith('Alice', {
      boardId: ctx.doc.activeBoardId,
      layout: layoutWith(9),
    });

    await ctx.session.end('switch');
    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Alice');
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalledWith('Bob');
  });

  it('reportReady with a stale generation is ignored', async () => {
    const ctx = setup();
    const first = await ctx.session.open();
    const second = await ctx.session.open();
    ctx.rebuildMenu.mockClear();

    ctx.session.reportReady(first.generation, true);
    expect(ctx.session.state().status).toBe('loading');
    expect(ctx.rebuildMenu).not.toHaveBeenCalled();

    ctx.session.reportReady(second.generation, true);
    expect(ctx.session.state().status).toBe('ready');
    expect(ctx.rebuildMenu).toHaveBeenCalledTimes(1);
  });

  it('end() fences before it retires, so a late saveRecovery cannot recreate the record', async () => {
    const ctx = setup();
    await openReady(ctx);

    // A write already in flight when end() starts must land before the retire
    let releaseWrite;
    ctx.recoveryStore.write.mockImplementationOnce(async (profile, { boardId, layout }) => {
      await new Promise((resolve) => { releaseWrite = resolve; });
      ctx.recoveryStore.calls.push(['write', profile]);
      ctx.recoveryStore.records.set(profile, { version: 1, boardId, savedAt: T0, handoff: null, layout });
    });
    const inFlight = ctx.session.saveRecovery(layoutWith(8));
    await vi.waitFor(() => expect(releaseWrite).toBeTypeOf('function'));
    const ending = ctx.session.end('clean-exit');
    const late = ctx.session.saveRecovery(layoutWith(9));
    await Promise.resolve();
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    releaseWrite();
    await Promise.all([inFlight, ending]);

    await expect(late).resolves.toEqual({ skipped: true });
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({ skipped: true });
    expect(ctx.recoveryStore.calls).toEqual([['write', 'Alice'], ['retire', 'Alice']]);
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    expect(ctx.session.state().status).toBe('idle');

    // end() is idempotent: once ended, end() and handoff() touch no store
    await ctx.session.end('clean-exit');
    await ctx.session.end('backup-restore');
    await ctx.session.handoff('update');
    ctx.session.rendererGone();
    await Promise.resolve();
    expect(ctx.recoveryStore.calls).toEqual([['write', 'Alice'], ['retire', 'Alice']]);

    // ...and a no-op before any open
    const idle = setup();
    await idle.session.end('clean-exit');
    await idle.session.handoff('update');
    expect(idle.recoveryStore.calls).toEqual([]);
  });

  it('end("library-import") clears every record', async () => {
    const ctx = setup();
    await openReady(ctx);
    ctx.recoveryStore.records.set('Alice', { version: 1 });
    ctx.recoveryStore.records.set('Bob', { version: 1 });

    await ctx.session.end('library-import');

    expect(ctx.recoveryStore.clearAll).toHaveBeenCalled();
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.size).toBe(0);
  });

  it('after rendererGone, end("clean-exit") keeps the record', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    ctx.session.rendererGone();
    await ctx.session.end('clean-exit');

    expect(ctx.recoveryStore.markHandoff).toHaveBeenCalledWith('Alice', 'renderer-crash');
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.get('Alice')).toMatchObject({ handoff: 'renderer-crash', layout: layoutWith(9) });

    // switch keeps it too; other exits still retire it
    for (const [reason, retired] of [['switch', false], ['backup-restore', true], ['profile-deleted', true]]) {
      const other = setup();
      await openReady(other);
      await other.session.saveRecovery(layoutWith(9));
      other.session.rendererGone();
      await other.session.end(reason);
      expect(other.recoveryStore.records.has('Alice'), reason).toBe(!retired);
    }
  });

  it('an open() during end() keeps its own profile and status', async () => {
    const ctx = setup();
    await openReady(ctx);
    let releaseWrite;
    ctx.recoveryStore.write.mockImplementationOnce(async (profile) => {
      await new Promise((resolve) => { releaseWrite = resolve; });
      ctx.recoveryStore.calls.push(['write', profile]);
    });
    const inFlight = ctx.session.saveRecovery(layoutWith(8));
    await vi.waitFor(() => expect(releaseWrite).toBeTypeOf('function'));

    const ending = ctx.session.end('switch');
    ctx.current.profile = 'Bob';
    const opening = ctx.session.open();
    releaseWrite();
    await Promise.all([inFlight, ending]);
    const opened = await opening;

    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Alice');
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalledWith('Bob');
    expect(ctx.session.state()).toMatchObject({ profile: 'Bob', status: 'loading', generation: opened.generation });
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.session.state().status).toBe('ready');
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({});
    expect(ctx.recoveryStore.write).toHaveBeenLastCalledWith('Bob', expect.anything());
  });

  it('a renderer-crash handoff marks the profile it was called for, even across an open()', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    let release;
    const marked = [];
    ctx.recoveryStore.markHandoff.mockImplementationOnce(async (profile, reason) => {
      await new Promise((resolve) => { release = resolve; });
      marked.push([profile, reason]);
    });

    ctx.session.rendererGone();
    ctx.current.profile = 'Bob';
    const opened = await ctx.session.open();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await vi.waitFor(() => expect(marked).toEqual([['Alice', 'renderer-crash']]));

    expect(ctx.recoveryStore.markHandoff).not.toHaveBeenCalledWith('Bob', expect.anything());
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.session.state()).toMatchObject({ profile: 'Bob', status: 'ready' });
    // Bob's session was not handed off, so its clean exit retires Bob only
    await ctx.session.end('clean-exit');
    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Bob');
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalledWith('Alice');
  });

  it('an unreadable recovery record opens as no recovery', async () => {
    const ctx = setup();
    ctx.recoveryStore.read.mockRejectedValueOnce(new Error('EACCES'));
    const opened = await ctx.session.open();
    expect(opened.recovery).toBeNull();
    expect(ctx.session.state().doc).toBe(ctx.doc);
  });

  it('startEmpty superseded by a newer open does not touch the new session', async () => {
    const ctx = setup({ loadError: new BoardStoreError('unreadable') });
    await ctx.session.open();
    let release;
    ctx.boardStore.resetUnreadable.mockImplementationOnce(async () => {
      await new Promise((resolve) => { release = resolve; });
      return { doc: makeDoc(normalizeLayout(null)) };
    });
    const empty = ctx.session.startEmpty();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await ctx.session.open();
    release();
    await expect(empty).rejects.toThrow('superseded');
    expect(ctx.session.state()).toMatchObject({ status: 'unreadable', doc: null, generation: 2 });
  });

  it('an unreadable store gives status unreadable; startEmpty resets it', async () => {
    const ctx = setup({ loadError: new BoardStoreError('unreadable') });
    await expect(ctx.session.startEmpty()).rejects.toThrow();

    const opened = await ctx.session.open();
    expect(opened).toEqual({ unreadable: true, generation: 1 });
    expect(ctx.session.state().status).toBe('unreadable');

    const empty = await ctx.session.startEmpty();
    expect(ctx.boardStore.resetUnreadable).toHaveBeenCalledWith('Alice');
    expect(empty).toEqual({ layout: normalizeLayout(null), generation: 1 });
    expect(ctx.session.state().status).toBe('loading');
    await expect(ctx.session.startEmpty()).rejects.toThrow();

    // Other store errors fail the open and do not allow startEmpty
    for (const code of ['io', 'version', 'unregistered', 'shape']) {
      const failing = setup({ loadError: new BoardStoreError(code) });
      const result = await failing.session.open();
      expect(result).toEqual({ failed: true, error: code, generation: 1 });
      expect(failing.session.state().status).toBe('failed');
      await expect(failing.session.startEmpty()).rejects.toThrow();
    }
  });

  it('a clean exit or switch before the board was ever ready keeps the record', async () => {
    const record = { version: 1, boardId: 'board-1', savedAt: T0, handoff: null, layout: layoutWith(9) };
    const states = {
      // e.g. quit while the crash prompt is still open
      loading: async (ctx) => { await ctx.session.open(); },
      failed: async (ctx) => {
        const opened = await ctx.session.open();
        ctx.session.reportReady(opened.generation, false);
      },
      unreadable: async (ctx) => { await ctx.session.open(); },
    };
    for (const [state, reach] of Object.entries(states)) {
      for (const reason of ['clean-exit', 'switch']) {
        const ctx = setup(state === 'unreadable' ? { loadError: new BoardStoreError('unreadable') } : {});
        ctx.recoveryStore.records.set('Alice', record);
        await reach(ctx);
        expect(ctx.session.state().status, state).toBe(state);
        await ctx.session.end(reason);
        expect(ctx.recoveryStore.retire, `${state} ${reason}`).not.toHaveBeenCalled();
        expect(ctx.recoveryStore.records.get('Alice'), `${state} ${reason}`).toEqual(record);
      }
    }

    // Other exits still retire it, and a library import still clears all
    const deleted = setup();
    deleted.recoveryStore.records.set('Alice', record);
    await deleted.session.open();
    await deleted.session.end('profile-deleted');
    expect(deleted.recoveryStore.records.has('Alice')).toBe(false);
    const imported = setup();
    imported.recoveryStore.records.set('Alice', record);
    await imported.session.open();
    await imported.session.end('library-import');
    expect(imported.recoveryStore.clearAll).toHaveBeenCalled();
  });

  it('restoring a handed-off record makes it an ordinary record, so a second crash asks', async () => {
    for (const savedAt of [T0, T0 - 16 * MINUTE]) {
      const ctx = setup();
      ctx.recoveryStore.records.set('Alice', { version: 1, boardId: 'board-1', savedAt, handoff: 'update', layout: layoutWith(9) });
      await ctx.session.open();
      await expect(ctx.session.resolveRecovery('restore')).resolves.toEqual({ layout: layoutWith(9) });
      expect(ctx.recoveryStore.records.get('Alice')).toEqual({
        version: 1, boardId: 'board-1', savedAt, handoff: null, layout: layoutWith(9)
      });

      // The next open (after another crash) reports it without a handoff
      const reopened = await ctx.session.open();
      expect(reopened.recovery).toEqual({ savedAt, handoff: null, boardId: 'board-1' });
    }

    // An ordinary record is not rewritten on restore
    const plain = setup();
    plain.recoveryStore.records.set('Alice', { version: 1, boardId: 'board-1', savedAt: T0, handoff: null, layout: layoutWith(9) });
    await plain.session.open();
    await plain.session.resolveRecovery('restore');
    expect(plain.recoveryStore.clearHandoff).not.toHaveBeenCalled();
  });

  it('a failed report after a failed open is accepted without a stale warning', async () => {
    const ctx = setup({ loadError: new BoardStoreError('version') });
    const opened = await ctx.session.open();
    expect(opened).toMatchObject({ failed: true });
    ctx.session.reportReady(opened.generation, false);
    expect(ctx.session.state().status).toBe('failed');
    expect(ctx.debugLog.info).not.toHaveBeenCalledWith('Ignoring stale board ready report', expect.anything());
  });

  it('restore onto a deleted boardId lands on the active board', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', {
      version: 1, boardId: 'deleted-board', savedAt: T0, handoff: null,
      layout: { hotkeys: [{ tabNumber: 1, hotkeys: { f2: '7' } }] },
    });
    const opened = await ctx.session.open();
    expect(opened.recovery.boardId).toBe('deleted-board');

    const restored = await ctx.session.resolveRecovery('restore');
    expect(restored).toEqual({ layout: normalizeLayout({ hotkeys: [{ tabNumber: 1, hotkeys: { f2: '7' } }] }) });
    expect(ctx.recoveryStore.records.has('Alice')).toBe(true);

    // Later writes from the restored session go to the active board
    ctx.session.reportReady(opened.generation, true);
    await ctx.session.saveRecovery(restored.layout);
    expect(ctx.recoveryStore.records.get('Alice').boardId).toBe(ctx.doc.activeBoardId);
  });

  it('discard retires the record and returns the saved layout', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', { version: 1, boardId: 'x', savedAt: T0, handoff: null, layout: layoutWith(7) });
    await ctx.session.open();

    await expect(ctx.session.resolveRecovery('bogus')).rejects.toThrow('Invalid recovery choice');
    await expect(ctx.session.resolveRecovery('discard')).resolves.toEqual({ layout: layoutWith(1) });
    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Alice');

    // Nothing reported: just the saved layout, nothing retired
    ctx.recoveryStore.retire.mockClear();
    await expect(ctx.session.resolveRecovery('restore')).resolves.toEqual({ layout: layoutWith(1) });
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
  });

  it('end awaits the pending renderer-crash handoff', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    let release;
    ctx.recoveryStore.markHandoff.mockImplementationOnce(async (profile, reason) => {
      await new Promise((resolve) => { release = resolve; });
      ctx.recoveryStore.calls.push(['markHandoff', profile, reason]);
    });

    ctx.session.rendererGone();
    const ending = ctx.session.end('backup-restore');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    release();
    await ending;
    expect(ctx.recoveryStore.calls.slice(-2)).toEqual([
      ['markHandoff', 'Alice', 'renderer-crash'],
      ['retire', 'Alice'],
    ]);
  });

  it('a failing menu rebuild or handoff never breaks the session', async () => {
    const ctx = setup();
    ctx.rebuildMenu.mockImplementation(() => { throw new Error('menu'); });
    const opened = await ctx.session.open();
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.session.state().status).toBe('ready');

    ctx.recoveryStore.markHandoff.mockRejectedValueOnce(new Error('disk'));
    expect(() => ctx.session.rendererGone()).not.toThrow();
    await expect(ctx.session.end('clean-exit')).resolves.toBeUndefined();
  });
});

/** Two boards; board-1 is active. */
function twoBoardDoc() {
  let n = 0;
  const newId = () => `board-${++n}`;
  const first = createDocument(layoutWith(1), { now: T0, newId });
  return addBoard(first, { name: 'Second', layout: layoutWith(2), now: T0, newId, activate: false }).doc;
}

/** Make the next recovery write hang until released. */
function holdNextWrite(ctx) {
  const held = {};
  ctx.recoveryStore.write.mockImplementationOnce(async (profile, { boardId, layout }) => {
    await new Promise((resolve) => { held.release = resolve; });
    ctx.recoveryStore.calls.push(['write', profile]);
    ctx.recoveryStore.records.set(profile, { version: 1, boardId, savedAt: T0, handoff: null, layout });
  });
  return held;
}

describe('board session mutations', () => {
  it('updateActive is refused unless ready', async () => {
    const ctx = setup();
    await expect(ctx.session.updateActive(layoutWith(5))).rejects.toThrow('session not ready');
    const opened = await ctx.session.open();
    await expect(ctx.session.updateActive(layoutWith(5))).rejects.toThrow('session not ready');
    ctx.session.reportReady(opened.generation, true);

    // A fenced session (handed off) is refused too
    await ctx.session.handoff('update');
    for (const call of [
      () => ctx.session.updateActive(layoutWith(5)),
      () => ctx.session.activate('board-1'),
      () => ctx.session.revert(),
      () => ctx.session.createBoard('New', layoutWith(5)),
      () => ctx.session.renameBoard('board-1', 'Renamed'),
      () => ctx.session.deleteBoard('board-1'),
      () => ctx.session.importBoard('Bob', 'board-1'),
    ]) {
      await expect(call()).rejects.toThrow('session not ready');
    }
    expect(ctx.boardStore.save).not.toHaveBeenCalled();

    // A ready session saves the board, then retires recovery; still ready, same generation
    const ready = setup();
    const readyOpened = await openReady(ready);
    await ready.session.saveRecovery(layoutWith(5));
    ready.rebuildMenu.mockClear();
    await ready.session.updateActive({ ...layoutWith(5), extra: true });
    const saved = ready.boardStore.save.mock.calls[0][1];
    expect(ready.boardStore.save).toHaveBeenCalledWith('Alice', expect.anything());
    expect(saved.boards[0].layout).toEqual(layoutWith(5));
    expect(ready.session.state()).toMatchObject({ status: 'ready', generation: readyOpened.generation, doc: saved });
    expect(ready.recoveryStore.records.has('Alice')).toBe(false);
    expect(ready.rebuildMenu).toHaveBeenCalled();
    // Not fenced afterwards
    await expect(ready.session.saveRecovery(layoutWith(6))).resolves.toEqual({});
  });

  it('a second mutation while one runs is rejected as busy', async () => {
    const ctx = setup({ doc: twoBoardDoc() });
    await openReady(ctx);
    let release;
    ctx.boardStore.save.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

    const first = ctx.session.renameBoard('board-2', 'Renamed');
    await expect(ctx.session.updateActive(layoutWith(5))).rejects.toThrow('busy');
    await expect(ctx.session.activate('board-2')).rejects.toThrow('busy');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await first;

    expect(ctx.boardStore.save).toHaveBeenCalledTimes(1);
    expect(ctx.session.state().doc.boards[1].name).toBe('Renamed');
    // Free again once the first settles
    await expect(ctx.session.renameBoard('board-2', 'Again')).resolves.toBeDefined();
  });

  it('activate of the active board is rejected and changes nothing', async () => {
    const ctx = setup({ doc: twoBoardDoc() });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    await expect(ctx.session.activate('board-1')).rejects.toThrow('already active');
    await expect(ctx.session.activate('missing')).rejects.toThrow('Board not found.');

    expect(ctx.boardStore.save).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation });
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({});
  });

  it('activate fences and retires recovery before returning the new layout', async () => {
    const ctx = setup({ doc: twoBoardDoc() });
    const opened = await openReady(ctx);

    // A recovery write of the old layout is already in flight
    const held = holdNextWrite(ctx);
    const inFlight = ctx.session.saveRecovery(layoutWith(8));
    await vi.waitFor(() => expect(held.release).toBeTypeOf('function'));

    const activating = ctx.session.activate('board-2');
    // Fenced synchronously: a later write of the old layout is skipped
    const late = ctx.session.saveRecovery(layoutWith(9));
    await Promise.resolve();
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    held.release();
    const result = await activating;
    await inFlight;

    await expect(late).resolves.toEqual({ skipped: true });
    expect(result).toEqual({ layout: layoutWith(2), generation: opened.generation + 1 });
    expect(ctx.recoveryStore.calls).toEqual([['write', 'Alice'], ['retire', 'Alice']]);
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    expect(ctx.boardStore.save.mock.calls[0][1].activeBoardId).toBe('board-2');
    expect(ctx.session.state()).toMatchObject({ status: 'loading', generation: result.generation });
    expect(ctx.session.state().doc.activeBoardId).toBe('board-2');

    // Writes stay refused while loading; the new generation's ready report unfences
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ skipped: true });
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.session.state().status).toBe('loading');
    ctx.session.reportReady(result.generation, true);
    expect(ctx.session.state().status).toBe('ready');
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({});
    expect(ctx.recoveryStore.records.get('Alice')).toMatchObject({ boardId: 'board-2', layout: layoutWith(9) });
  });

  it('revert retires recovery and reloads the saved active board', async () => {
    const ctx = setup({ doc: twoBoardDoc() });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    const result = await ctx.session.revert();

    expect(result).toEqual({ layout: layoutWith(1), generation: opened.generation + 1 });
    expect(ctx.boardStore.save).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    expect(ctx.session.state().status).toBe('loading');
    ctx.session.reportReady(result.generation, true);
    await expect(ctx.session.saveRecovery(layoutWith(7))).resolves.toEqual({});
  });

  it('a failed save leaves the doc, recovery and status unchanged', async () => {
    const ctx = setup({ doc: twoBoardDoc() });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    const record = ctx.recoveryStore.records.get('Alice');
    const docBefore = ctx.session.state().doc;
    ctx.boardStore.save.mockRejectedValue(new BoardStoreError('io', 'disk full'));

    for (const call of [
      () => ctx.session.activate('board-2'),
      () => ctx.session.updateActive(layoutWith(5)),
      () => ctx.session.createBoard('New', layoutWith(5)),
      () => ctx.session.renameBoard('board-2', 'Renamed'),
      () => ctx.session.deleteBoard('board-1'),
      () => ctx.session.deleteBoard('board-2'),
    ]) {
      await expect(call()).rejects.toThrow('disk full');
      expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation, doc: docBefore });
      expect(ctx.recoveryStore.records.get('Alice')).toBe(record);
    }
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    // The fence came back down, and the lock was released
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({});
    ctx.boardStore.save.mockResolvedValue(undefined);
    await expect(ctx.session.renameBoard('board-2', 'Renamed')).resolves.toBeDefined();
  });

  it('createBoard makes the new board active and stays ready', async () => {
    const ctx = setup();
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    await expect(ctx.session.createBoard('  ', layoutWith(9))).rejects.toThrow('Enter a name for the board.');
    await expect(ctx.session.createBoard('board', layoutWith(9))).rejects.toThrow('A board with this name already exists.');
    const created = await ctx.session.createBoard('Show Two', layoutWith(9));

    expect(created).toEqual({ id: 'new-id', name: 'Show Two' });
    const { doc } = ctx.session.state();
    expect(doc.activeBoardId).toBe('new-id');
    expect(doc.boards.at(-1)).toMatchObject({ name: 'Show Two', layout: layoutWith(9), createdAt: T0 });
    expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation });
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    await expect(ctx.session.saveRecovery(layoutWith(3))).resolves.toEqual({});
    expect(ctx.recoveryStore.records.get('Alice').boardId).toBe('new-id');
  });

  it('renameBoard keeps status and rejects invalid names with the exact message', async () => {
    const ctx = setup({ doc: twoBoardDoc() });
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    await expect(ctx.session.renameBoard('board-1', 'second')).rejects.toThrow('A board with this name already exists.');
    await expect(ctx.session.renameBoard('board-1', 'x'.repeat(51))).rejects.toThrow('Board names can be at most 50 characters.');
    await expect(ctx.session.renameBoard('nope', 'Fine')).rejects.toThrow('Board not found.');
    expect(ctx.boardStore.save).not.toHaveBeenCalled();
    ctx.rebuildMenu.mockClear();

    await ctx.session.renameBoard('board-1', ' Opening ');
    expect(ctx.session.state().doc.boards[0].name).toBe('Opening');
    expect(ctx.session.state().status).toBe('ready');
    expect(ctx.recoveryStore.records.has('Alice')).toBe(true);
    expect(ctx.rebuildMenu).toHaveBeenCalled();
  });

  it('deleting a non-active board leaves status ready and recovery intact', async () => {
    const ctx = setup({ doc: twoBoardDoc() });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    await expect(ctx.session.deleteBoard('board-2')).resolves.toEqual({ activeChanged: false });
    expect(ctx.session.state().doc.boards.map((b) => b.id)).toEqual(['board-1']);
    expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation });
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.has('Alice')).toBe(true);
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({});
  });

  it('deleting the active board fences, retires and loads the next board', async () => {
    const ctx = setup({ doc: twoBoardDoc() });
    const opened = await openReady(ctx);
    const held = holdNextWrite(ctx);
    const inFlight = ctx.session.saveRecovery(layoutWith(8));
    await vi.waitFor(() => expect(held.release).toBeTypeOf('function'));

    const deleting = ctx.session.deleteBoard('board-1');
    const late = ctx.session.saveRecovery(layoutWith(9));
    held.release();
    const result = await deleting;
    await inFlight;

    await expect(late).resolves.toEqual({ skipped: true });
    expect(result).toEqual({ activeChanged: true, layout: layoutWith(2), generation: opened.generation + 1 });
    expect(ctx.recoveryStore.calls).toEqual([['write', 'Alice'], ['retire', 'Alice']]);
    expect(ctx.session.state()).toMatchObject({ status: 'loading', generation: result.generation });
    expect(ctx.session.state().doc.activeBoardId).toBe('board-2');
  });

  it('a mutation superseded by end() does not touch the ended session', async () => {
    const ctx = setup({ doc: twoBoardDoc() });
    await openReady(ctx);
    let release;
    ctx.boardStore.save.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const activating = ctx.session.activate('board-2');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await ctx.session.end('clean-exit');
    release();
    await expect(activating).rejects.toThrow('superseded');
    expect(ctx.session.state().status).toBe('idle');
  });
});

describe('board session imports', () => {
  const dirs = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) nodeFs.rmSync(dir, { recursive: true, force: true });
  });

  /** A real board store over a temp profiles directory, with every fs write recorded. */
  function realStoreSetup(registered) {
    const root = nodeFs.mkdtempSync(path.join(os.tmpdir(), 'board-import-'));
    dirs.push(root);
    const writes = [];
    const MUTATORS = new Set(['writeFile', 'rename', 'copyFile', 'rm', 'mkdir', 'unlink', 'appendFile']);
    const promises = new Proxy(nodeFs.promises, {
      get(target, key) {
        const value = target[key];
        if (typeof value !== 'function') return value;
        return (...args) => {
          if (MUTATORS.has(key) || (key === 'open' && args[1] !== 'r')) writes.push([key, String(args[0])]);
          return value.apply(target, args);
        };
      },
    });
    const fs = { ...nodeFs, promises };
    const dir = (name) => path.join(root, name);
    const boardStore = createBoardStore({
      fs,
      getProfileBoardsPath: (name) => path.join(dir(name), 'boards.json'),
      getProfileStatePath: (name) => path.join(dir(name), 'state.json'),
      profileExists: (name) => registered.includes(name),
    });
    const writeFile = (name, file, value) => {
      nodeFs.mkdirSync(dir(name), { recursive: true });
      nodeFs.writeFileSync(path.join(dir(name), file), typeof value === 'string' ? value : JSON.stringify(value));
    };
    const snapshot = (name) => {
      if (!nodeFs.existsSync(dir(name))) return {};
      return Object.fromEntries(nodeFs.readdirSync(dir(name)).map((f) => [f, nodeFs.readFileSync(path.join(dir(name), f))]));
    };
    return { boardStore, writes, writeFile, snapshot, dir };
  }

  it('listImportable excludes the current profile, includes never-opened profiles, and writes nothing', async () => {
    const registered = ['Alice', 'zed', 'Default User', 'Bob', 'Carol'];
    const store = realStoreSetup(registered);
    const bobDoc = twoBoardDoc();
    store.writeFile('Bob', 'boards.json', bobDoc);
    store.writeFile('zed', 'boards.json', makeDoc());
    // Never opened since the upgrade: only a state.json
    store.writeFile('Default User', 'state.json', layoutWith(4));
    // Unreadable: skipped
    store.writeFile('Carol', 'boards.json', '{ not json');
    store.writeFile('Carol', 'boards.json.prev', '{ not json');

    const ctx = setup({ boardStore: store.boardStore, profiles: registered });
    await expect(ctx.session.listImportable()).rejects.toThrow('No profile is open');
    await openReady(ctx);
    store.writes.length = 0;
    const before = Object.fromEntries(registered.filter((p) => p !== 'Alice').map((p) => [p, store.snapshot(p)]));

    const list = await ctx.session.listImportable();

    expect(list.map((entry) => entry.profile)).toEqual(['Default User', 'Bob', 'zed']);
    expect(list[0].boards).toEqual([{ id: expect.any(String), name: 'Board', updatedAt: expect.any(Number) }]);
    expect(list[1].boards).toEqual([
      { id: 'board-1', name: 'Board', updatedAt: T0 },
      { id: 'board-2', name: 'Second', updatedAt: T0 },
    ]);
    expect(store.writes).toEqual([]);
    for (const [name, files] of Object.entries(before)) expect(store.snapshot(name), name).toEqual(files);
    expect(nodeFs.existsSync(path.join(store.dir('Default User'), 'boards.json'))).toBe(false);

    // Allowed while loading, too: it only needs an opened profile
    await ctx.session.revert();
    await expect(ctx.session.listImportable()).resolves.toHaveLength(3);
  });

  it('importBoard names the copy "<name> (<profile>)" and leaves the source files byte-identical', async () => {
    const registered = ['Alice', 'Bob'];
    const store = realStoreSetup(registered);
    store.writeFile('Alice', 'boards.json', makeDoc());
    store.writeFile('Bob', 'boards.json', twoBoardDoc());
    // Bob's board name clashes with nothing; Alice already has "Board"
    const ctx = setup({ boardStore: store.boardStore, profiles: registered });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    const bobBefore = store.snapshot('Bob');
    store.writes.length = 0;

    await expect(ctx.session.importBoard('Alice', 'board-1')).rejects.toThrow('Cannot import from the current profile');
    await expect(ctx.session.importBoard('Mallory', 'board-1')).rejects.toThrow('not registered');
    await expect(ctx.session.importBoard('Bob', 'missing')).rejects.toThrow('Board not found.');
    // A rejected import leaves the session as it was
    expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation });
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({});

    const result = await ctx.session.importBoard('Bob', 'board-2');

    expect(result).toEqual({ layout: layoutWith(2), generation: opened.generation + 1 });
    const { doc, status } = ctx.session.state();
    expect(status).toBe('loading');
    const copy = doc.boards.find((b) => b.id === doc.activeBoardId);
    expect(copy).toMatchObject({
      id: 'new-id',
      name: 'Second (Bob)',
      layout: layoutWith(2),
      importedFrom: { profile: 'Bob', boardId: 'board-2', boardName: 'Second', at: T0 },
    });
    // Saved to Alice only; Bob's files untouched
    const onDisk = JSON.parse(nodeFs.readFileSync(path.join(store.dir('Alice'), 'boards.json'), 'utf8'));
    expect(onDisk.activeBoardId).toBe('new-id');
    expect(store.writes.every(([, file]) => !file.startsWith(store.dir('Bob')))).toBe(true);
    expect(store.writes.length).toBeGreaterThan(0);
    expect(store.snapshot('Bob')).toEqual(bobBefore);
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);

    // A second import of the same board gets a numbered name
    ctx.session.reportReady(result.generation, true);
    await ctx.session.importBoard('Bob', 'board-2');
    expect(ctx.session.state().doc.boards.at(-1).name).toBe('Second (Bob) 2');
  });
});
