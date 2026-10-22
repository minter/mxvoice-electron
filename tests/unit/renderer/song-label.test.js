import { describe, expect, it } from 'vitest';
import { formatDuration, setSongLabel, swapSongLabels } from '../../../src/renderer/modules/ui/song-label.js';
import { fakeCreateElement, makeTextNode } from '../../utils/fake-text-node.js';

const doc = { createElement: fakeCreateElement() };
const classesOf = (el) => el.childNodes.map((child) => child.className);

describe('formatDuration', () => {
  it('writes minutes:seconds without a leading zero, and hours past an hour', () => {
    expect(formatDuration('00:21')).toBe('0:21');
    expect(formatDuration('4:20')).toBe('4:20');
    expect(formatDuration('1:7')).toBe('1:07');
    expect(formatDuration('60:00')).toBe('1:00:00');
    expect(formatDuration('66:45')).toBe('1:06:45');
    expect(formatDuration('125:05')).toBe('2:05:05');
  });

  it('leaves anything else as it is', () => {
    expect(formatDuration('')).toBe('');
    expect(formatDuration(undefined)).toBe('');
    expect(formatDuration('1:02:03')).toBe('1:02:03');
    expect(formatDuration('[??:??]')).toBe('[??:??]');
  });
});

describe('setSongLabel', () => {
  it('builds title, artist and time pieces that still read "Title by Artist (time)"', () => {
    const el = makeTextNode();
    setSongLabel(el, { title: 'We Are Family', artist: 'Sister Sledge', time: '00:07' }, doc);

    expect(el.textContent).toBe('We Are Family by Sister Sledge (0:07)');
    expect(el.title).toBe('We Are Family by Sister Sledge (0:07)');
    expect(classesOf(el)).toEqual(['song-label-text', 'song-label-sep', 'song-label-time', 'song-label-sep']);
    expect(classesOf(el.childNodes[0])).toEqual(['song-label-title', 'song-label-sep', 'song-label-artist']);
  });

  it('fills in unknown title, artist and time', () => {
    const el = makeTextNode();
    setSongLabel(el, {}, doc);
    expect(el.textContent).toBe('[Unknown Title] by [Unknown Artist] ([??:??])');
  });

  it('replaces whatever the element held, so names stay text', () => {
    const el = makeTextNode();
    el.textContent = 'old label';
    setSongLabel(el, { title: '<b>Bold</b>', artist: 'A', time: '1:00' }, doc);
    expect(el.textContent).toBe('<b>Bold</b> by A (1:00)');
    expect(el.childNodes[0].childNodes[0].textContent).toBe('<b>Bold</b>');
  });
});

describe('swapSongLabels', () => {
  it('swaps the two labels and their tooltips', () => {
    const a = makeTextNode();
    const b = makeTextNode();
    setSongLabel(a, { title: 'One', artist: 'X', time: '1:00' }, doc);
    setSongLabel(b, { title: 'Two', artist: 'Y', time: '2:00' }, doc);

    swapSongLabels(a, b);

    expect(a.textContent).toBe('Two by Y (2:00)');
    expect(b.textContent).toBe('One by X (1:00)');
    expect(a.title).toBe('Two by Y (2:00)');
    expect(b.title).toBe('One by X (1:00)');
  });

  it('swaps a label with an empty slot', () => {
    const a = makeTextNode();
    const empty = makeTextNode();
    setSongLabel(a, { title: 'One', artist: 'X', time: '1:00' }, doc);

    swapSongLabels(a, empty);

    expect(a.textContent).toBe('');
    expect(a.title).toBe('');
    expect(empty.textContent).toBe('One by X (1:00)');
  });
});
