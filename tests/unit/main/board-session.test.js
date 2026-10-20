import { describe, expect, it, vi } from 'vitest';
import { createBoardSession } from '../../../src/main/modules/board-session.js';
import { BoardStoreError } from '../../../src/main/modules/board-store.js';
import { createDocument, normalizeLayout } from '../../../src/main/modules/board-document.js';

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

function setup({ doc = makeDoc(), loadError = null, profile = 'Alice' } = {}) {
  const clock = { t: T0, now: () => clock.t };
  const current = { profile };
  const recoveryStore = fakeRecoveryStore(clock);
  const boardStore = {
    load: vi.fn(async () => {
      if (loadError) throw loadError;
      return { doc, source: 'boards' };
    }),
    resetUnreadable: vi.fn(async () => ({ doc: makeDoc(normalizeLayout(null)) })),
    peek: vi.fn(),
    save: vi.fn(),
  };
  const rebuildMenu = vi.fn();
  const session = createBoardSession({
    boardStore,
    recoveryStore,
    profileManager: { profileExists: () => true },
    getCurrentProfile: () => current.profile,
    rebuildMenu,
    now: clock.now,
    newId: () => 'new-id',
    debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { session, boardStore, recoveryStore, rebuildMenu, clock, current, doc };
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

    // end() is idempotent, and a no-op before any open
    await ctx.session.end('clean-exit');
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
    await ctx.session.end('switch');

    expect(ctx.recoveryStore.markHandoff).toHaveBeenCalledWith('Alice', 'renderer-crash');
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.get('Alice')).toMatchObject({ handoff: 'renderer-crash', layout: layoutWith(9) });

    // Other exits still retire it
    await ctx.session.end('backup-restore');
    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Alice');
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
