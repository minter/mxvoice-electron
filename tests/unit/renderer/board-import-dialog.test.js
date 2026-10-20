import { describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const { chooseImportBoard } = await import('../../../src/renderer/modules/boards/import-dialog.js');

// Just enough DOM for the dialog: no innerHTML, so a name can only arrive as text
class FakeElement {
  constructor(tagName, id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.attributes = {};
    this.listeners = [];
    this.textContent = '';
    this.disabled = false;
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((n) => classes.add(n)),
      remove: (...names) => names.forEach((n) => classes.delete(n)),
      toggle: (name, force) => ((force ?? !classes.has(name)) ? classes.add(name) : classes.delete(name)),
      contains: (name) => classes.has(name)
    };
    Object.defineProperty(this, 'className', {
      get: () => [...classes].join(' '),
      set: (value) => { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach((n) => classes.add(n)); }
    });
    Object.defineProperty(this, 'innerHTML', { set: () => { throw new Error('innerHTML is not allowed'); } });
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, fn, options = {}) {
    const entry = { type, fn, once: !!options.once };
    this.listeners.push(entry);
    options.signal?.addEventListener('abort', () => { this.listeners = this.listeners.filter((l) => l !== entry); });
  }
  dispatch(type) {
    for (const entry of [...this.listeners]) {
      if (entry.type !== type) continue;
      if (entry.once) this.listeners = this.listeners.filter((l) => l !== entry);
      entry.fn({ type, currentTarget: this, preventDefault() {} });
    }
  }
  click() { if (!this.disabled) this.dispatch('click'); }
}

function setup() {
  const elements = {
    importBoardModal: new FakeElement('div', 'importBoardModal'),
    importBoardList: new FakeElement('div', 'importBoardList'),
    importBoardEmpty: new FakeElement('p', 'importBoardEmpty'),
    importBoardBtn: new FakeElement('button', 'importBoardBtn')
  };
  elements.importBoardEmpty.classList.add('d-none');
  const doc = {
    getElementById: (id) => elements[id] ?? null,
    createElement: (tag) => new FakeElement(tag)
  };
  const show = vi.fn(async () => {});
  const hide = vi.fn(async () => { elements.importBoardModal.dispatch('hidden.bs.modal'); });
  return { elements, options: { document: doc, show, hide }, show, hide };
}

const groups = [
  { profile: 'Derek', boards: [{ id: 'd1', name: 'Comedy Sports', updatedAt: 1 }, { id: 'd2', name: '<b>Late</b>', updatedAt: 2 }] },
  { profile: 'Empty Profile', boards: [] },
  { profile: 'Sam', boards: [{ id: 's1', name: 'Kids Show', updatedAt: 3 }] }
];

const rowsOf = (list) => list.children.filter((el) => el.getAttribute('role') === 'option');
const headersOf = (list) => list.children.filter((el) => el.getAttribute('role') !== 'option');

describe('chooseImportBoard', () => {
  it('lists boards grouped under their profile as plain text', async () => {
    const { elements, options, show } = setup();
    void chooseImportBoard(groups, options);
    await vi.waitFor(() => expect(show).toHaveBeenCalledWith('#importBoardModal', expect.any(Object), { backdrop: true, keyboard: true }));

    const list = elements.importBoardList;
    expect(headersOf(list).map((el) => el.textContent)).toEqual(['Derek', 'Sam']);
    expect(list.children.map((el) => el.textContent)).toEqual(['Derek', 'Comedy Sports', '<b>Late</b>', 'Sam', 'Kids Show']);
    expect(elements.importBoardEmpty.classList.contains('d-none')).toBe(true);
    expect(elements.importBoardBtn.disabled).toBe(true);
  });

  it('enables Import once a row is selected and resolves with that board', async () => {
    const { elements, options, hide } = setup();
    const chosen = chooseImportBoard(groups, options);
    await vi.waitFor(() => expect(rowsOf(elements.importBoardList)).toHaveLength(3));

    const [first, , kids] = rowsOf(elements.importBoardList);
    first.click();
    expect(elements.importBoardBtn.disabled).toBe(false);
    expect(first.classList.contains('active')).toBe(true);
    kids.click();
    expect(first.classList.contains('active')).toBe(false);
    expect(kids.getAttribute('aria-selected')).toBe('true');

    elements.importBoardBtn.click();
    await expect(chosen).resolves.toEqual({ profile: 'Sam', boardId: 's1' });
    expect(hide).toHaveBeenCalledWith('#importBoardModal', expect.any(Object));
  });

  it('a double-click imports that row', async () => {
    const { elements, options } = setup();
    const chosen = chooseImportBoard(groups, options);
    await vi.waitFor(() => expect(rowsOf(elements.importBoardList)).toHaveLength(3));
    rowsOf(elements.importBoardList)[0].dispatch('dblclick');
    await expect(chosen).resolves.toEqual({ profile: 'Derek', boardId: 'd1' });
  });

  it('closing the dialog resolves null, and a later open starts clean', async () => {
    const { elements, options } = setup();
    const first = chooseImportBoard(groups, options);
    await vi.waitFor(() => expect(rowsOf(elements.importBoardList)).toHaveLength(3));
    rowsOf(elements.importBoardList)[0].click();
    elements.importBoardModal.dispatch('hidden.bs.modal');
    await expect(first).resolves.toBeNull();

    const second = chooseImportBoard(groups, options);
    await vi.waitFor(() => expect(rowsOf(elements.importBoardList)).toHaveLength(3));
    expect(elements.importBoardBtn.disabled).toBe(true);
    // The first open's listeners are gone: one click resolves the second only
    rowsOf(elements.importBoardList)[2].click();
    elements.importBoardBtn.click();
    await expect(second).resolves.toEqual({ profile: 'Sam', boardId: 's1' });
  });

  it('with no other boards it says so and keeps Import disabled', async () => {
    const { elements, options } = setup();
    const chosen = chooseImportBoard([{ profile: 'Empty Profile', boards: [] }], options);
    await vi.waitFor(() => expect(elements.importBoardEmpty.classList.contains('d-none')).toBe(false));
    expect(elements.importBoardEmpty.textContent).toBe('No other profiles have saved boards.');
    expect(elements.importBoardList.children).toEqual([]);
    expect(elements.importBoardBtn.disabled).toBe(true);
    elements.importBoardBtn.click();
    elements.importBoardModal.dispatch('hidden.bs.modal');
    await expect(chosen).resolves.toBeNull();
  });

  it('resolves null when the dialog markup is missing', async () => {
    const { options } = setup();
    options.document = { getElementById: () => null, createElement: () => new FakeElement('div') };
    await expect(chooseImportBoard(groups, options)).resolves.toBeNull();
  });
});
