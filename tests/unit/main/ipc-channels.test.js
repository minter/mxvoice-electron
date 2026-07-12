import { describe, expect, it } from 'vitest';
import ipcChannels from '../../../src/shared/ipc-channels.cjs';

const { IPC } = ipcChannels;

const allValues = () =>
  Object.values(IPC).flatMap(domain => Object.values(domain));

describe('IPC channel manifest', () => {
  it('exports a two-level object of non-empty channel strings', () => {
    expect(Object.keys(IPC).length).toBeGreaterThanOrEqual(14);
    for (const value of allValues()) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate channel names', () => {
    const values = allValues();
    expect(new Set(values).size).toBe(values.length);
  });

  it('is frozen against accidental mutation', () => {
    expect(Object.isFrozen(IPC)).toBe(true);
    expect(Object.isFrozen(IPC.STORE)).toBe(true);
  });

  it('covers the known surface size', () => {
    // 107 channels registered by ipc-handlers.js (post get-app-path removal)
    expect(allValues().length).toBe(107);
  });
});
