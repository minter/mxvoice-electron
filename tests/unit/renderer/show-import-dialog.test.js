import { describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const { chooseImportShow } = await import('../../../src/renderer/modules/shows/import-dialog.js');

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
    importShowModal: new FakeElement('div', 'importShowModal'),
    importShowList: new FakeElement('div', 'importShowList'),
    importShowEmpty: new FakeElement('p', 'importShowEmpty'),
    importShowBtn: new FakeElement('button', 'importShowBtn')
  };
  elements.importShowEmpty.classList.add('d-none');
  const doc = {
    getElementById: (id) => elements[id] ?? null,
    createElement: (tag) => new FakeElement(tag)
  };
  const show = vi.fn(async () => {});
  const hide = vi.fn(async () => { elements.importShowModal.dispatch('hidden.bs.modal'); });
  return { elements, options: { document: doc, show, hide }, show, hide };
}

const groups = [
  { profile: 'Derek', shows: [{ id: 'd1', name: 'Comedy Sports', updatedAt: 1 }, { id: 'd2', name: '<b>Late</b>', updatedAt: 2 }] },
  { profile: 'Empty Profile', shows: [] },
  { profile: 'Sam', shows: [{ id: 's1', name: 'Kids Show', updatedAt: 3 }] }
];

const rowsOf = (list) => list.children.filter((el) => el.getAttribute('role') === 'option');
const headersOf = (list) => list.children.filter((el) => el.getAttribute('role') !== 'option');

describe('chooseImportShow', () => {
  it('lists shows grouped under their profile as plain text', async () => {
    const { elements, options, show } = setup();
    void chooseImportShow(groups, options);
    await vi.waitFor(() => expect(show).toHaveBeenCalledWith('#importShowModal', expect.any(Object), { backdrop: true, keyboard: true }));

    const list = elements.importShowList;
    expect(headersOf(list).map((el) => el.textContent)).toEqual(['Derek', 'Sam']);
    expect(list.children.map((el) => el.textContent)).toEqual(['Derek', 'Comedy Sports', '<b>Late</b>', 'Sam', 'Kids Show']);
    expect(elements.importShowEmpty.classList.contains('d-none')).toBe(true);
    expect(elements.importShowBtn.disabled).toBe(true);
  });

  it('enables Import once a row is selected and resolves with that show', async () => {
    const { elements, options, hide } = setup();
    const chosen = chooseImportShow(groups, options);
    await vi.waitFor(() => expect(rowsOf(elements.importShowList)).toHaveLength(3));

    const [first, , kids] = rowsOf(elements.importShowList);
    first.click();
    expect(elements.importShowBtn.disabled).toBe(false);
    expect(first.classList.contains('active')).toBe(true);
    kids.click();
    expect(first.classList.contains('active')).toBe(false);
    expect(kids.getAttribute('aria-selected')).toBe('true');

    elements.importShowBtn.click();
    await expect(chosen).resolves.toEqual({ profile: 'Sam', showId: 's1' });
    expect(hide).toHaveBeenCalledWith('#importShowModal', expect.any(Object));
  });

  it('a double-click imports that row', async () => {
    const { elements, options } = setup();
    const chosen = chooseImportShow(groups, options);
    await vi.waitFor(() => expect(rowsOf(elements.importShowList)).toHaveLength(3));
    rowsOf(elements.importShowList)[0].dispatch('dblclick');
    await expect(chosen).resolves.toEqual({ profile: 'Derek', showId: 'd1' });
  });

  it('closing the dialog resolves null, and a later open starts clean', async () => {
    const { elements, options } = setup();
    const first = chooseImportShow(groups, options);
    await vi.waitFor(() => expect(rowsOf(elements.importShowList)).toHaveLength(3));
    rowsOf(elements.importShowList)[0].click();
    elements.importShowModal.dispatch('hidden.bs.modal');
    await expect(first).resolves.toBeNull();

    const second = chooseImportShow(groups, options);
    await vi.waitFor(() => expect(rowsOf(elements.importShowList)).toHaveLength(3));
    expect(elements.importShowBtn.disabled).toBe(true);
    // The first open's listeners are gone: one click resolves the second only
    rowsOf(elements.importShowList)[2].click();
    elements.importShowBtn.click();
    await expect(second).resolves.toEqual({ profile: 'Sam', showId: 's1' });
  });

  it('with no other shows it says so and keeps Import disabled', async () => {
    const { elements, options } = setup();
    const chosen = chooseImportShow([{ profile: 'Empty Profile', shows: [] }], options);
    await vi.waitFor(() => expect(elements.importShowEmpty.classList.contains('d-none')).toBe(false));
    expect(elements.importShowEmpty.textContent).toBe('No other profiles have saved shows.');
    expect(elements.importShowList.children).toEqual([]);
    expect(elements.importShowBtn.disabled).toBe(true);
    elements.importShowBtn.click();
    elements.importShowModal.dispatch('hidden.bs.modal');
    await expect(chosen).resolves.toBeNull();
  });

  it('resolves null when the dialog markup is missing', async () => {
    const { options } = setup();
    options.document = { getElementById: () => null, createElement: () => new FakeElement('div') };
    await expect(chooseImportShow(groups, options)).resolves.toBeNull();
  });
});
