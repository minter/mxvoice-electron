import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const { refreshHeader, setHeaderLabels } = await import('../../../src/renderer/modules/boards/header.js');

// No DOM library: elements that record textContent and refuse innerHTML
function element() {
  const attrs = {};
  return {
    hidden: false,
    textContent: '',
    get title() { return attrs.title ?? ''; },
    set title(value) { attrs.title = value; },
    removeAttribute: (name) => { delete attrs[name]; },
    set innerHTML(_) { throw new Error('innerHTML must not be used'); }
  };
}

let els;
let doc;
const board = () => els.board;
const hiddenParts = () => [els.separator, els.icon, els.board].map((el) => el.hidden);

function resetDom() {
  els = { profile: element(), separator: element(), icon: element(), board: element() };
  const byId = { 'profile-name': els.profile, 'board-icon': els.icon, 'board-name': els.board };
  doc = {
    getElementById: (id) => byId[id] ?? null,
    querySelector: (selector) => (selector === '.board-separator' ? els.separator : null)
  };
}

describe('setHeaderLabels', () => {
  beforeEach(() => { resetDom(); });

  it('shows profile and board, full name in title', () => {
    setHeaderLabels({ profile: 'Default User', board: 'Friday Show' }, doc);
    expect(els.profile.textContent).toBe('Default User');
    expect(board().textContent).toBe('Friday Show');
    expect(board().title).toBe('Friday Show');
    expect(hiddenParts()).toEqual([false, false, false]);
  });

  it('uses textContent, never innerHTML', () => {
    setHeaderLabels({ profile: '<i>p</i>', board: '<b>x</b>' }, doc);
    expect(board().textContent).toBe('<b>x</b>');
    expect(board().innerHTML).toBeUndefined();
      });

  it('hides the separator, icon and name without a board', () => {
    setHeaderLabels({ profile: 'Default User', board: 'Main' }, doc);
    setHeaderLabels({ profile: 'Default User', board: null }, doc);
    expect(hiddenParts()).toEqual([true, true, true]);
    expect(board().textContent).toBe('');
    expect(els.profile.textContent).toBe('Default User');
  });

  it('leaves the profile alone when none is given', () => {
    setHeaderLabels({ profile: 'Default User' }, doc);
    setHeaderLabels({ board: 'Main' }, doc);
    expect(els.profile.textContent).toBe('Default User');
  });
});

describe('refreshHeader', () => {
  beforeEach(() => { resetDom(); });
  const api = (data, success = true) => ({ getState: vi.fn(async () => (success ? { success, data } : { success, error: 'x' })) });

  it('shows the active board from the session state', async () => {
    const boardDoc = { activeBoardId: 'b2', boards: [{ id: 'b1', name: 'One' }, { id: 'b2', name: 'Two' }] };
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'ready', doc: boardDoc }) });
    expect(board().textContent).toBe('Two');
    expect(els.profile.textContent).toBe('Default User');
  });

  it('shows no board when the session has no document', async () => {
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'failed', doc: null }) });
    expect(hiddenParts()).toEqual([true, true, true]);
    expect(els.profile.textContent).toBe('Default User');
  });

  it('never throws when the state cannot be read', async () => {
    await expect(refreshHeader({ doc, api: api(null, false) })).resolves.toBeUndefined();
    await expect(refreshHeader({ doc, api: { getState: vi.fn(async () => { throw new Error('boom'); }) } })).resolves.toBeUndefined();
  });
});
