import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import tours from '../../../src/renderer/modules/whats-new/tours.js';

const majorMinor = (version) => version.split('-')[0].split('.').slice(0, 2).join('.');
const compare = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

describe("What's New tours", () => {
  // A release whose major.minor has no tour would show the previous one again
  it("the newest tour key matches the package version's major.minor", () => {
    const { version } = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
    const newest = Object.keys(tours.tours).sort(compare).at(-1);
    expect(majorMinor(newest)).toBe(majorMinor(version));
  });
});
