import { beforeEach, describe, expect, it, vi } from 'vitest';

const ops = {
  getCategories: vi.fn(),
  editCategory: vi.fn(),
  addNewCategory: vi.fn(),
  deleteCategory: vi.fn()
};
vi.mock('../../../src/renderer/modules/categories/category-operations.js', () => ops);
vi.mock('../../../src/renderer/modules/ui/bootstrap-helpers.js', () => ({
  safeShowModal: vi.fn(),
  safeHideModal: vi.fn()
}));

const elements = new Map();

function descendants(element) {
  return element.children.flatMap(child => [child, ...descendants(child)]);
}

function matchesClass(element, selector) {
  return selector.startsWith('.') && element.className.split(/\s+/).includes(selector.slice(1));
}

function node() {
  const attributes = new Map();
  const listeners = new Map();
  const innerHTMLAssignments = [];

  return {
    value: '',
    textContent: '',
    className: '',
    style: {},
    children: [],
    innerHTMLAssignments,
    set innerHTML(value) { innerHTMLAssignments.push(value); },
    get innerHTML() { return ''; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type) { return listeners.get(type)?.({ preventDefault: vi.fn() }); },
    querySelector(selector) { return descendants(this).find(child => matchesClass(child, selector)) ?? null; },
    querySelectorAll(selector) { return descendants(this).filter(child => matchesClass(child, selector)); },
    remove: vi.fn(),
    focus: vi.fn(),
    select: vi.fn()
  };
}

function allElements() {
  return [...elements.values()].flatMap(element => [element, ...descendants(element)]);
}

globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
globalThis.alert = vi.fn();
globalThis.confirm = vi.fn();
globalThis.document = {
  getElementById: id => {
    if (!elements.has(id)) elements.set(id, node());
    return elements.get(id);
  },
  createElement: () => node(),
  querySelectorAll: selector => allElements().filter(element => matchesClass(element, selector)),
  querySelector: () => null
};

const ui = await import('../../../src/renderer/modules/categories/category-ui.js');

describe('category modal UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    elements.clear();
  });

  it('rejects blank descriptions before database access', async () => {
    document.getElementById('newCategoryDescription').value = ' ';
    await expect(ui.addNewCategoryUI({ preventDefault: vi.fn() })).rejects.toThrow('Category description is required');
    expect(alert).toHaveBeenCalledWith('Category description is required');
    expect(ops.addNewCategory).not.toHaveBeenCalled();
  });

  it('adds a category, clears input, and refreshes selectors', async () => {
    document.getElementById('newCategoryDescription').value = 'Talk';
    ops.addNewCategory.mockResolvedValue({ success: true });
    ops.getCategories.mockResolvedValue({ success: true, data: [] });
    await ui.addNewCategoryUI({ preventDefault: vi.fn() });
    expect(ops.addNewCategory).toHaveBeenCalledWith('Talk');
    expect(document.getElementById('newCategoryDescription').value).toBe('');
  });

  it('renders imported category values only as text and properties', async () => {
    const code = 'EVIL" onfocus="globalThis.pwned=true';
    const description = '"><img src=x onerror="globalThis.pwned=true">';
    ops.getCategories.mockResolvedValue({ success: true, data: [{ code, description }] });

    await ui.populateCategoriesModal();

    const row = document.getElementById('categoryList').children[0];
    const descriptionElement = row.querySelector('.category-description');
    const input = row.querySelector('.categoryDescription');
    expect(row.innerHTMLAssignments).toEqual([]);
    expect(descriptionElement.textContent).toBe(description);
    expect(descriptionElement.getAttribute('catcode')).toBe(code);
    expect(descriptionElement.getAttribute('onfocus')).toBeNull();
    expect(descriptionElement.children).toEqual([]);
    expect(input.value).toBe(description);
    expect(input.getAttribute('catcode')).toBe(code);
    expect(input.getAttribute('onfocus')).toBeNull();

    row.querySelector('.category-edit-btn').dispatch('click');
    expect(descriptionElement.style.display).toBe('none');
    expect(input.style.display).toBe('block');
    expect(input.select).toHaveBeenCalled();
  });

  it('logs category loading failures without breaking the modal', async () => {
    ops.getCategories.mockRejectedValue(new Error('offline'));
    await expect(ui.populateCategoriesModal()).resolves.toBeUndefined();
    expect(window.debugLog.warn).toHaveBeenCalled();
  });
});
