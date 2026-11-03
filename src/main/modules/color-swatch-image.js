/**
 * Swatch icons for Shows → Color: a filled circle in each palette color, and a
 * hollow gray ring for None. Drawn in code as BGRA bitmaps (no image files),
 * 16px with a 32px @2x representation.
 */

import electron from 'electron';

// The light-mode 600 stop of each palette color, as the swatch uses in show-colors.css
const SWATCH_HEX = Object.freeze({
  teal: '#0F6E56', blue: '#185FA5', purple: '#534AB7', pink: '#993556',
  coral: '#993C1D', amber: '#854F0B', green: '#3B6D11'
});
const RING_HEX = '#8a8f98';

const BASE_SIZE = 16;
const RING_WIDTH = 1.5; // at 1x

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function parseHex(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * A circle centered in a size × size image, as premultiplied BGRA (Electron's
 * bitmap format). The edge is anti-aliased by distance from the rim.
 * @param {number} size - width and height in pixels
 * @param {string} hex - '#RRGGBB'
 * @param {Object} [options]
 * @param {boolean} [options.ring] - draw only a ring, leaving the center transparent
 * @returns {Buffer}
 */
function circleBitmap(size, hex, { ring = false } = {}) {
  const { r, g, b } = parseHex(hex);
  const scale = size / BASE_SIZE;
  const center = size / 2;
  const outer = center - scale; // a 1px margin at 1x
  const inner = outer - RING_WIDTH * scale;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x + 0.5 - center, y + 0.5 - center);
      let coverage = clamp01(outer - d + 0.5);
      if (ring) coverage = Math.min(coverage, clamp01(d - inner + 0.5));
      const a = Math.round(coverage * 255);
      const i = (y * size + x) * 4;
      buf[i] = Math.round((b * a) / 255);
      buf[i + 1] = Math.round((g * a) / 255);
      buf[i + 2] = Math.round((r * a) / 255);
      buf[i + 3] = a;
    }
  }
  return buf;
}

const cache = new Map();

/**
 * The NativeImage for a Color menu item; null (or an unknown key) is None's ring.
 * @param {string|null} key - a palette key
 */
function swatchImage(key) {
  const id = Object.hasOwn(SWATCH_HEX, key ?? '') ? key : null;
  if (cache.has(id)) return cache.get(id);
  const bitmap = (size) => (id ? circleBitmap(size, SWATCH_HEX[id]) : circleBitmap(size, RING_HEX, { ring: true }));
  const image = electron.nativeImage.createFromBitmap(bitmap(BASE_SIZE), {
    width: BASE_SIZE, height: BASE_SIZE, scaleFactor: 1
  });
  image.addRepresentation({
    width: BASE_SIZE * 2, height: BASE_SIZE * 2, scaleFactor: 2, buffer: bitmap(BASE_SIZE * 2)
  });
  cache.set(id, image);
  return image;
}

export { circleBitmap, swatchImage, SWATCH_HEX, RING_HEX };
export default swatchImage;
