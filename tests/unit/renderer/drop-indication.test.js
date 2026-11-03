import { describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
globalThis.document = { querySelectorAll: vi.fn(() => []) };

const dnd = await import('../../../src/renderer/modules/drag-drop/drag-drop-functions.js');

function row(next = null) {
  const classes = new Set();
  return {
    classList: { add: (c) => classes.add(c), remove: (...cs) => cs.forEach((c) => classes.delete(c)), contains: (c) => classes.has(c) },
    getBoundingClientRect: () => ({ top: 0, height: 20 }),
    nextElementSibling: next,
    closest: function () { return this; }
  };
}

const dragOver = (target, clientY) => dnd.holdingTankReorderDragOver({
  preventDefault: vi.fn(),
  dataTransfer: {},
  target,
  clientY
});

describe('holding tank drop indication', () => {
  it('a drop reads the row the indicator was on, even after dragleave cleared it', () => {
    const x = row();
    dragOver(x, 2);
    dnd.clearHoldingTankDropIndicators();
    expect(dnd.getLastDropIndication()).toEqual({ item: x, position: 'before' });
  });

  it('a drag that ends without a drop leaves nothing for a later drop', () => {
    const x = row();
    dragOver(x, 2);
    dnd.endHoldingTankDrag();
    expect(x.classList.contains('holding-tank-drop-above')).toBe(false);
    expect(dnd.getLastDropIndication()).toEqual({ item: null, position: null });
  });
});
