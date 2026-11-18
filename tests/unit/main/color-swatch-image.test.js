import { describe, expect, it, vi } from 'vitest';

const nativeImage = vi.hoisted(() => ({
  createFromBitmap: vi.fn((buffer, size) => ({ reps: [{ ...size, buffer }], addRepresentation(rep) { this.reps.push(rep); } }))
}));
vi.mock('electron', () => ({ default: { nativeImage } }));

import { circleBitmap, swatchImage, SWATCH_HEX, RING_HEX } from '../../../src/main/modules/color-swatch-image.js';

// BGRA, 4 bytes per pixel, row-major
const pixel = (buf, size, x, y) => {
  const i = (y * size + x) * 4;
  return { b: buf[i], g: buf[i + 1], r: buf[i + 2], a: buf[i + 3] };
};

describe('circleBitmap', () => {
  it('is a BGRA buffer of size × size pixels', () => {
    expect(Buffer.isBuffer(circleBitmap(16, '#0F6E56'))).toBe(true);
    expect(circleBitmap(16, '#0F6E56')).toHaveLength(16 * 16 * 4);
    expect(circleBitmap(32, '#0F6E56')).toHaveLength(32 * 32 * 4);
  });

  it('fills the center with the color at full alpha', () => {
    for (const size of [16, 32]) {
      const c = size / 2;
      expect(pixel(circleBitmap(size, '#0F6E56'), size, c, c)).toEqual({ r: 0x0f, g: 0x6e, b: 0x56, a: 255 });
      expect(pixel(circleBitmap(size, '#993C1D'), size, c - 1, c - 1)).toEqual({ r: 0x99, g: 0x3c, b: 0x1d, a: 255 });
    }
  });

  it('leaves the corners transparent', () => {
    for (const size of [16, 32]) {
      const buf = circleBitmap(size, '#185FA5');
      for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) {
        expect(pixel(buf, size, x, y), `${size}: ${x},${y}`).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      }
    }
  });

  it('anti-aliases the edge with partial, premultiplied alpha', () => {
    const size = 16;
    const buf = circleBitmap(size, '#FFFFFF');
    const alphas = [];
    for (let x = 0; x < size; x += 1) alphas.push(pixel(buf, size, x, size / 2).a);
    const partial = alphas.filter((a) => a > 0 && a < 255);
    expect(partial.length).toBeGreaterThan(0);
    // Premultiplied: a white edge pixel's channels equal its alpha
    const edge = pixel(buf, size, alphas.findIndex((a) => a > 0 && a < 255), size / 2);
    expect(edge.r).toBe(edge.a);
  });

  it('ring mode draws a ring and leaves the center transparent', () => {
    for (const size of [16, 32]) {
      const buf = circleBitmap(size, RING_HEX, { ring: true });
      const c = size / 2;
      expect(pixel(buf, size, c, c).a, `${size} center`).toBe(0);
      expect(pixel(buf, size, 0, 0).a, `${size} corner`).toBe(0);
      // Somewhere across the middle row the ring is drawn in the ring color
      let strongest = { a: 0 };
      for (let x = 0; x < c; x += 1) {
        const p = pixel(buf, size, x, c);
        if (p.a > strongest.a) strongest = p;
      }
      expect(strongest.a).toBeGreaterThan(200);
      expect(Math.abs(strongest.r - Math.round(0x8a * strongest.a / 255))).toBeLessThanOrEqual(1);
    }
  });

  it('knows the light-mode 600 swatch of every palette color', () => {
    expect(SWATCH_HEX).toEqual({
      teal: '#0F6E56', blue: '#185FA5', purple: '#534AB7', pink: '#993556',
      coral: '#993C1D', amber: '#854F0B', green: '#3B6D11'
    });
    expect(RING_HEX).toBe('#8a8f98');
  });
});

describe('swatchImage', () => {
  it('builds a 16px image with a 32px @2x representation, cached per key', () => {
    const teal = swatchImage('teal');
    expect(nativeImage.createFromBitmap).toHaveBeenCalledOnce();
    expect(teal.reps.map(({ width, height, scaleFactor }) => ({ width, height, scaleFactor }))).toEqual([
      { width: 16, height: 16, scaleFactor: 1 },
      { width: 32, height: 32, scaleFactor: 2 }
    ]);
    expect(teal.reps[0].buffer).toEqual(circleBitmap(16, SWATCH_HEX.teal));
    expect(teal.reps[1].buffer).toEqual(circleBitmap(32, SWATCH_HEX.teal));
    expect(swatchImage('teal')).toBe(teal);
    expect(nativeImage.createFromBitmap).toHaveBeenCalledOnce();
  });

  it('draws None (and an unknown key) as the gray ring', () => {
    const none = swatchImage(null);
    expect(none.reps[0].buffer).toEqual(circleBitmap(16, RING_HEX, { ring: true }));
    expect(none.reps[1].buffer).toEqual(circleBitmap(32, RING_HEX, { ring: true }));
    expect(swatchImage(undefined)).toBe(none);
    expect(swatchImage('mauve')).toBe(none);
  });
});
