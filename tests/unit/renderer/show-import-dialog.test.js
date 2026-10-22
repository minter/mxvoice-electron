import { describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const { chooseImportShow, describeContents } = await import('../../../src/renderer/modules/shows/import-dialog.js');

describe('describeContents', () => {
  it('says what a show holds in plain words', () => {
    expect(describeContents({ hotkeyCount: 1, tankCount: 1 })).toBe('1 hotkey and 1 holding tank song');
    expect(describeContents({ hotkeyCount: 7, tankCount: 0 })).toBe('7 hotkeys');
    expect(describeContents({ hotkeyCount: 0, tankCount: 3 })).toBe('3 holding tank songs');
    expect(describeContents({ hotkeyCount: 0, tankCount: 0 })).toBe('Empty');
    expect(describeContents({})).toBe('Empty');
  });
});

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
    this.dataset = {};
    this.hidden = false;
    this.tabIndex = 0;
    this.value = '';
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
  append(...children) { this.children.push(...children); }
  focus() { this.focused = true; }
  closest() { return this.wrapper ?? null; }
  /** All text below this element, as the DOM's textContent would give */
  get text() { return this.textContent + this.children.map((c) => c.text).join(''); }
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
  key(key) {
    let prevented = false;
    for (const entry of this.listeners.filter((l) => l.type === 'keydown')) entry.fn({ key, preventDefault: () => { prevented = true; } });
    return prevented;
  }
  input(value) { this.value = value; this.dispatch('input'); }
}

function setup() {
  const elements = {
    importShowModal: new FakeElement('div', 'importShowModal'),
    importShowList: new FakeElement('div', 'importShowList'),
    importShowEmpty: new FakeElement('p', 'importShowEmpty'),
    importShowBtn: new FakeElement('button', 'importShowBtn'),
    importShowFilter: new FakeElement('input', 'importShowFilter')
  };
  elements.importShowEmpty.classList.add('d-none');
  elements.filterWrapper = new FakeElement('div');
  elements.filterWrapper.classList.add('d-none');
  elements.importShowFilter.wrapper = elements.filterWrapper;
  const doc = {
    getElementById: (id) => elements[id] ?? null,
    createElement: (tag) => new FakeElement(tag)
  };
  const show = vi.fn(async () => {});
  const hide = vi.fn(async () => { elements.importShowModal.dispatch('hidden.bs.modal'); });
  return { elements, options: { document: doc, show, hide }, show, hide };
}

const groups = [
  { profile: 'Derek', shows: [
    { id: 'd1', name: 'Comedy Sports', updatedAt: 1, color: 'teal', hotkeyCount: 5, tankCount: 12 },
    { id: 'd2', name: '<b>Late</b>', updatedAt: 2, color: 'mauve', hotkeyCount: 1, tankCount: 0 }
  ] },
  { profile: 'Empty Profile', shows: [] },
  { profile: 'Sam', shows: [{ id: 's1', name: 'Kids Show', updatedAt: 3, color: null, hotkeyCount: 0, tankCount: 0 }] }
];

const rowsOf = (list) => list.children.filter((el) => el.getAttribute('role') === 'option');
const headersOf = (list) => list.children.filter((el) => el.getAttribute('role') !== 'option');

describe('chooseImportShow', () => {
  it('lists shows grouped under their profile as plain text', async () => {
    const { elements, options, show } = setup();
    void chooseImportShow(groups, options);
    await vi.waitFor(() => expect(show).toHaveBeenCalledWith('#importShowModal', expect.any(Object), { backdrop: true, keyboard: true }));

    const list = elements.importShowList;
    expect(headersOf(list).map((el) => el.text)).toEqual(['Derek', 'Sam']);
    expect(list.children.map((el) => el.dataset.show ?? el.dataset.profile)).toEqual(['Derek', 'Comedy Sports', '<b>Late</b>', 'Sam', 'Kids Show']);
    // Each show says what it holds; its color is the bar, and an unknown color is neutral
    const rows = rowsOf(list);
    expect(rows.map((row) => row.text)).toEqual([
      'Comedy Sports5 hotkeys and 12 holding tank songs', '<b>Late</b>1 hotkey', 'Kids ShowEmpty'
    ]);
    expect(rows.map((row) => row.dataset.color)).toEqual(['teal', 'none', 'none']);
    // Named by the show alone, described by what it holds
    const [nameSpan, contentsSpan] = rows[0].children[0].children;
    expect(rows[0].getAttribute('aria-labelledby')).toBe(nameSpan.id);
    expect(rows[0].getAttribute('aria-describedby')).toBe(contentsSpan.id);
    expect(new Set(rows.map((row) => row.getAttribute('aria-labelledby'))).size).toBe(3);
    // One tab stop for the list
    expect(rows.map((row) => row.tabIndex)).toEqual([0, -1, -1]);
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

  it('Up and Down move the choice through the shows, and Return imports it', async () => {
    const { elements, options } = setup();
    const chosen = chooseImportShow(groups, options);
    await vi.waitFor(() => expect(rowsOf(elements.importShowList)).toHaveLength(3));
    const list = elements.importShowList;
    const [first, second, third] = rowsOf(list);

    expect(list.key('ArrowDown')).toBe(true);
    expect(first.getAttribute('aria-selected')).toBe('true');
    list.key('ArrowDown');
    list.key('ArrowDown');
    list.key('ArrowDown'); // stays on the last
    expect(third.getAttribute('aria-selected')).toBe('true');
    expect(third.focused).toBe(true);
    list.key('ArrowUp');
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(second.tabIndex).toBe(0);
    expect(third.tabIndex).toBe(-1);

    list.key('Enter');
    await expect(chosen).resolves.toEqual({ profile: 'Derek', showId: 'd2' });
  });

  it('shows the filter only for a long list, and filters by profile or show name', async () => {
    const short = setup();
    void chooseImportShow(groups, short.options);
    await vi.waitFor(() => expect(rowsOf(short.elements.importShowList)).toHaveLength(3));
    expect(short.elements.filterWrapper.classList.contains('d-none')).toBe(true);

    const many = ['A', 'B', 'C', 'D', 'E'].map((p) => ({ profile: p, shows: [{ id: p, name: 'Default Show' }] }));
    const { elements, options } = setup();
    void chooseImportShow([...groups, ...many], options);
    await vi.waitFor(() => expect(rowsOf(elements.importShowList)).toHaveLength(8));
    expect(elements.filterWrapper.classList.contains('d-none')).toBe(false);

    const visible = () => rowsOf(elements.importShowList).filter((r) => !r.hidden).map((r) => `${r.dataset.profile}/${r.dataset.show}`);
    const visibleHeaders = () => headersOf(elements.importShowList).filter((h) => !h.hidden).map((h) => h.dataset.profile);
    elements.importShowFilter.input('derek');
    expect(visible()).toEqual(['Derek/Comedy Sports', 'Derek/<b>Late</b>']);
    expect(visibleHeaders()).toEqual(['Derek']);
    elements.importShowFilter.input('kids');
    expect(visible()).toEqual(['Sam/Kids Show']);
    expect(visibleHeaders()).toEqual(['Sam']);

    // A choice hidden by the filter is let go
    rowsOf(elements.importShowList)[0].click();
    expect(elements.importShowBtn.disabled).toBe(false);
    elements.importShowFilter.input('zzz');
    expect(visible()).toEqual([]);
    expect(elements.importShowBtn.disabled).toBe(true);
    expect(elements.importShowEmpty.classList.contains('d-none')).toBe(false);
    expect(elements.importShowEmpty.textContent).toBe('No profile or show matches.');
    elements.importShowFilter.input('');
    expect(visible()).toHaveLength(8);
    expect(elements.importShowEmpty.classList.contains('d-none')).toBe(true);
  });

  it('resolves null when the dialog markup is missing', async () => {
    const { options } = setup();
    options.document = { getElementById: () => null, createElement: () => new FakeElement('div') };
    await expect(chooseImportShow(groups, options)).resolves.toBeNull();
  });
});
