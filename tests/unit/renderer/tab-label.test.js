import { describe, it, expect } from 'vitest';
import { setTabLabel } from '../../../src/renderer/modules/ui/tab-label.js';

const makeLink = () => {
  const attrs = new Map();
  return {
    textContent: 'old',
    setAttribute: (k, v) => attrs.set(k, v),
    getAttribute: (k) => attrs.get(k) ?? null,
    removeAttribute: (k) => attrs.delete(k),
    hasAttribute: (k) => attrs.has(k)
  };
};

describe('setTabLabel', () => {
  it('sets the text and the full name as the tooltip', () => {
    const link = makeLink();
    setTabLabel(link, 'Pre-show');
    expect(link.textContent).toBe('Pre-show');
    expect(link.getAttribute('title')).toBe('Pre-show');
  });

  it('shows the number and no tooltip for an unnamed tab', () => {
    const link = makeLink();
    setTabLabel(link, 'Halftime', 2);
    setTabLabel(link, null, 2);
    expect(link.textContent).toBe('2');
    expect(link.hasAttribute('title')).toBe(false);
  });

  it('ignores a missing link', () => {
    expect(() => setTabLabel(null, 'x', 1)).not.toThrow();
  });
});
