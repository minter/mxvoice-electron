import { describe, expect, it } from 'vitest';
import * as bd from '../../../src/main/modules/board-document.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};

const makeIds = () => {
  let n = 0;
  return () => `id-${++n}`;
};
const NOW = 1000;

const mk = (names = ['A']) => {
  const newId = makeIds();
  let doc = bd.createDocument(bd.emptyLayout(), { name: names[0], now: NOW, newId });
  for (const name of names.slice(1)) {
    doc = bd.addBoard(doc, { name, layout: bd.emptyLayout(), now: NOW, newId, activate: false }).doc;
  }
  return { doc, newId };
};

describe('board-document', () => {
  it('createDocument makes one active board named "Board"', () => {
    const doc = bd.createDocument(bd.emptyLayout(), { now: NOW, newId: makeIds() });
    expect(doc.version).toBe(1);
    expect(doc.boards).toHaveLength(1);
    expect(doc.boards[0].name).toBe('Board');
    expect(doc.activeBoardId).toBe(doc.boards[0].id);
    expect(doc.boards[0].createdAt).toBe(NOW);
    expect(doc.boards[0].updatedAt).toBe(NOW);
    expect(bd.BOARD_DOCUMENT_VERSION).toBe(1);
  });

  it('validateBoardName rejects empty, >50 chars, and case-insensitive duplicates', () => {
    const { doc } = mk(['Comedy Sports']);
    expect(bd.validateBoardName(doc, '   ')).toEqual({ ok: false, error: 'Enter a name for the board.' });
    expect(bd.validateBoardName(doc, 'x'.repeat(51))).toEqual({
      ok: false,
      error: 'Board names can be at most 50 characters.',
    });
    expect(bd.validateBoardName(doc, 'comedy sports')).toEqual({
      ok: false,
      error: 'A board with this name already exists.',
    });
    expect(bd.validateBoardName(doc, '  Fresh  ')).toEqual({ ok: true, name: 'Fresh' });
    expect(bd.validateBoardName(doc, 'x'.repeat(50)).ok).toBe(true);
  });

  it('validateBoardName allows renaming a board to a different casing of itself', () => {
    const { doc } = mk(['Comedy Sports']);
    const id = doc.boards[0].id;
    expect(bd.validateBoardName(doc, 'COMEDY SPORTS', { exceptId: id })).toEqual({
      ok: true,
      name: 'COMEDY SPORTS',
    });
    const renamed = bd.renameBoard(doc, id, 'COMEDY SPORTS', 2000);
    expect(renamed.boards[0].name).toBe('COMEDY SPORTS');
    expect(renamed.boards[0].updatedAt).toBe(2000);
  });

  it('renameBoard throws the validation message and Board not found', () => {
    const { doc } = mk(['A', 'B']);
    expect(() => bd.renameBoard(doc, doc.boards[0].id, 'b', 5)).toThrow(
      'A board with this name already exists.'
    );
    expect(() => bd.renameBoard(doc, 'nope', 'Z', 5)).toThrow('Board not found.');
    expect(() => bd.updateBoardLayout(doc, 'nope', bd.emptyLayout(), 5)).toThrow('Board not found.');
    expect(() => bd.deleteBoard(doc, 'nope', { now: 5, newId: makeIds() })).toThrow('Board not found.');
    expect(() => bd.setActive(doc, 'nope')).toThrow('Board not found.');
  });

  it('deleting a non-active board keeps the active id', () => {
    const { doc, newId } = mk(['A', 'B', 'C']);
    const r = bd.deleteBoard(doc, doc.boards[1].id, { now: 5, newId });
    expect(r.activeChanged).toBe(false);
    expect(r.doc.activeBoardId).toBe(doc.activeBoardId);
    expect(r.nextActiveId).toBe(doc.activeBoardId);
    expect(r.doc.boards.map((b) => b.name)).toEqual(['A', 'C']);
  });

  it('deleting the active board activates the next in creation order', () => {
    const { doc, newId } = mk(['A', 'B', 'C']);
    const d = bd.setActive(doc, doc.boards[1].id);
    const r = bd.deleteBoard(d, doc.boards[1].id, { now: 5, newId });
    expect(r.activeChanged).toBe(true);
    expect(r.nextActiveId).toBe(doc.boards[2].id);
    expect(r.doc.activeBoardId).toBe(doc.boards[2].id);
  });

  it('deleting the last board in the list activates the previous', () => {
    const { doc, newId } = mk(['A', 'B', 'C']);
    const d = bd.setActive(doc, doc.boards[2].id);
    const r = bd.deleteBoard(d, doc.boards[2].id, { now: 5, newId });
    expect(r.nextActiveId).toBe(doc.boards[1].id);
    expect(r.doc.activeBoardId).toBe(doc.boards[1].id);
  });

  it('deleting the only board leaves one empty "Board"', () => {
    const { doc, newId } = mk(['Solo']);
    const r = bd.deleteBoard(doc, doc.boards[0].id, { now: 7, newId });
    expect(r.activeChanged).toBe(true);
    expect(r.doc.boards).toHaveLength(1);
    expect(r.doc.boards[0].name).toBe('Board');
    expect(r.doc.boards[0].id).not.toBe(doc.boards[0].id);
    expect(r.doc.boards[0].layout).toEqual(bd.emptyLayout());
    expect(r.doc.activeBoardId).toBe(r.doc.boards[0].id);
    expect(r.nextActiveId).toBe(r.doc.boards[0].id);
  });

  it('addBoard activates by default, can skip, and records importedFrom', () => {
    const { doc, newId } = mk(['A']);
    const importedFrom = { profile: 'Derek', boardId: 'x', boardName: 'Y', at: 3 };
    const r = bd.addBoard(doc, { name: ' B ', layout: bd.emptyLayout(), now: 9, newId, importedFrom });
    expect(r.board.name).toBe('B');
    expect(r.board.importedFrom).toEqual(importedFrom);
    expect(r.doc.activeBoardId).toBe(r.board.id);
    const r2 = bd.addBoard(r.doc, { name: 'C', layout: bd.emptyLayout(), now: 9, newId, activate: false });
    expect(r2.doc.activeBoardId).toBe(r.board.id);
    expect(r2.doc.boards.map((b) => b.name)).toEqual(['A', 'B', 'C']);
    expect(() => bd.addBoard(r2.doc, { name: 'a', layout: bd.emptyLayout(), now: 9, newId })).toThrow(
      'A board with this name already exists.'
    );
  });

  it('importName suffixes on collision', () => {
    const { doc } = mk(['Comedy Sports (Derek)']);
    expect(bd.importName(doc, 'Comedy Sports', 'Derek')).toBe('Comedy Sports (Derek) 2');
    expect(bd.importName(doc, 'Other', 'Derek')).toBe('Other (Derek)');
    const { doc: d2 } = mk(['X (Derek)', 'X (Derek) 2']);
    expect(bd.importName(d2, 'x', 'Derek')).toBe('x (Derek) 3');
  });

  it('importName keeps & and quotes verbatim', () => {
    const { doc } = mk(['A']);
    expect(bd.importName(doc, 'Mom & "Pop"', 'Derek')).toBe('Mom & "Pop" (Derek)');
  });

  it('importName clips the board part to stay within 50 characters', () => {
    const { doc } = mk(['A']);
    const name = bd.importName(doc, 'b'.repeat(60), 'Derek');
    expect(name.length).toBe(50);
    expect(name.endsWith(' (Derek)')).toBe(true);
    const { doc: d2 } = mk([name]);
    const second = bd.importName(d2, 'b'.repeat(60), 'Derek');
    expect(second.length).toBeLessThanOrEqual(50);
    expect(second.endsWith(' (Derek) 2')).toBe(true);
    expect(bd.validateBoardName(d2, second).ok).toBe(true);
  });

  it('normalizeLayout pads to 5 tabs and drops non-numeric ids', () => {
    const l = bd.normalizeLayout({
      hotkeys: [
        { tabNumber: 3, tabName: 'Three', hotkeys: { f1: '12', f2: 'abc', f13: '5', f12: 7, f3: '9' } },
        { tabNumber: 9, tabName: 'Out', hotkeys: { f1: '1' } },
      ],
      holdingTank: [{ tabNumber: 2, tabName: null, songIds: ['1', 'x', 2, '3'] }],
      selected: { hotkeyTab: 4, holdingTankTab: 9 },
    });
    expect(l.hotkeys.map((t) => t.tabNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(l.holdingTank.map((t) => t.tabNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(l.hotkeys[0]).toEqual({ tabNumber: 1, tabName: null, hotkeys: {} });
    expect(l.hotkeys[2]).toEqual({ tabNumber: 3, tabName: 'Three', hotkeys: { f1: '12', f3: '9' } });
    expect(l.holdingTank[1].songIds).toEqual(['1', '3']);
    expect(l.holdingTank[0]).toEqual({ tabNumber: 1, tabName: null, songIds: [] });
    expect(l.selected).toEqual({ hotkeyTab: 4, holdingTankTab: 1 });
    expect(bd.normalizeLayout(null)).toEqual(bd.emptyLayout());
    expect(bd.emptyLayout().selected).toEqual({ hotkeyTab: 1, holdingTankTab: 1 });
  });

  it('parseDocument rejects version 2 as "version"', () => {
    const { doc } = mk(['A']);
    expect(bd.parseDocument({ ...doc, version: 2 })).toEqual({ ok: false, error: 'version' });
  });

  it('parseDocument rejects bad shapes and normalizes layouts', () => {
    const { doc } = mk(['A']);
    for (const bad of [null, 'x', {}, { version: 1, boards: [] }, { ...doc, boards: 'no' },
      { ...doc, activeBoardId: 'zzz' }]) {
      expect(bd.parseDocument(bad)).toEqual({ ok: false, error: 'shape' });
    }
    const r = bd.parseDocument({
      ...doc,
      boards: [{ ...doc.boards[0], layout: { hotkeys: [], holdingTank: [] } }],
    });
    expect(r.ok).toBe(true);
    expect(r.doc.boards[0].layout.hotkeys).toHaveLength(5);
  });

  it('never mutates its input', () => {
    const { doc } = mk(['A', 'B']);
    const frozen = deepFreeze(structuredClone(doc));
    const newId = makeIds();
    const layout = deepFreeze(bd.emptyLayout());
    const id = frozen.boards[0].id;
    expect(() => {
      bd.addBoard(frozen, { name: 'C', layout, now: 1, newId });
      bd.updateBoardLayout(frozen, id, layout, 2);
      bd.renameBoard(frozen, id, 'Z', 3);
      bd.deleteBoard(frozen, id, { now: 4, newId });
      bd.setActive(frozen, frozen.boards[1].id);
      bd.importName(frozen, 'A', 'P');
      bd.parseDocument(frozen);
      bd.normalizeLayout(layout);
    }).not.toThrow();
  });
});
