/**
 * Just enough of a DOM node for code that builds labels from child spans
 * (src/renderer/modules/ui/song-label.js): append, replaceChildren, title,
 * and a textContent that, like the DOM's, reads through to the children and
 * replaces them when set.
 */
export function makeTextNode(extra = {}) {
  let ownText = '';
  const node = {
    childNodes: [],
    className: '',
    title: '',
    append(...children) { this.childNodes.push(...children); },
    replaceChildren(...children) { ownText = ''; this.childNodes = [...children]; },
    ...extra
  };
  Object.defineProperty(node, 'textContent', {
    get() { return ownText + node.childNodes.map((child) => child.textContent ?? '').join(''); },
    set(value) { ownText = String(value ?? ''); node.childNodes = []; },
    enumerable: true
  });
  return node;
}

/** A createElement for fake documents */
export function fakeCreateElement(extra = () => ({})) {
  return (tagName) => makeTextNode({ tagName: String(tagName).toUpperCase(), ...extra() });
}
