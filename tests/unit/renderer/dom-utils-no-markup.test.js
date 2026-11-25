import { describe, expect, it } from 'vitest';

// dom-utils must never turn a string into markup: callers build elements.

function makeNode() {
  const node = {
    children: [],
    attributes: new Map(),
    textContent: '',
    appendChild(child) { node.children.push(child); return child; },
    setAttribute(name, value) { node.attributes.set(name, String(value)); },
    get innerHTML() { return ''; },
    set innerHTML(value) { node.innerHTMLWrites = (node.innerHTMLWrites || []).concat(value); },
    insertAdjacentHTML() { throw new Error('insertAdjacentHTML must not be used'); }
  };
  return node;
}

globalThis.window = { debugLog: { info() {}, warn() {}, error() {}, debug() {} } };
globalThis.document = {
  createElement: () => makeNode(),
  createTextNode: (text) => ({ nodeType: 3, text }),
  querySelector: () => null,
  querySelectorAll: () => []
};

const { default: Dom, domUtils } = await import('../../../src/renderer/modules/dom-utils/index.js');

describe('dom-utils', () => {
  it('has no helper that parses a string as HTML', () => {
    expect(domUtils.html).toBeUndefined();
    expect(Dom.html).toBeUndefined();
  });

  it('appends a string as a text node, not markup', () => {
    const el = makeNode();
    Dom.append(el, '<img src=x onerror=alert(1)>');
    expect(el.children).toEqual([{ nodeType: 3, text: '<img src=x onerror=alert(1)>' }]);
    expect(el.innerHTMLWrites).toBeUndefined();
  });

  it('create() does not treat an innerHTML attribute as markup', () => {
    const el = Dom.create('div', { innerHTML: '<b>x</b>' });
    expect(el.innerHTMLWrites).toBeUndefined();
  });
});
