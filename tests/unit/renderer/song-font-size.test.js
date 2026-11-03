import { beforeEach, describe, expect, it, vi } from 'vitest';

// View > Increase / Decrease Font Size: one CSS variable on <html> that every
// song row reads (index.css), saved as the profile's font_size

const rootVars = {};
globalThis.window = { debugLog: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } };
globalThis.document = { documentElement: { style: { setProperty: (k, v) => { rootVars[k] = v; } } } };

const sharedState = (await import('../../../src/renderer/modules/shared-state.js')).default;
const fontSize = await import('../../../src/renderer/modules/ui/song-font-size.js');

const api = (stored) => ({
  profile: {
    getPreference: vi.fn(async () => stored),
    setPreference: vi.fn(async () => ({ success: true }))
  }
});

describe('song font size', () => {
  beforeEach(() => {
    fontSize.applySongFontSize(fontSize.DEFAULT_SONG_FONT_SIZE);
    window.debugLog.warn.mockClear();
  });

  it('applies a size to every song row through the CSS variable and shared state', () => {
    expect(fontSize.applySongFontSize(14)).toBe(14);
    expect(rootVars['--song-font-size']).toBe('14px');
    expect(fontSize.getSongFontSize()).toBe(14);
    expect(sharedState.get('fontSize')).toBe(14);
  });

  it('keeps sizes between 8 and 25 and treats junk as the default', () => {
    expect(fontSize.applySongFontSize(3)).toBe(8);
    expect(fontSize.applySongFontSize(99)).toBe(25);
    expect(fontSize.applySongFontSize('12')).toBe(12);
    expect(fontSize.applySongFontSize('big')).toBe(11);
  });

  it('steps one pixel at a time and saves each step to the profile', async () => {
    const electronAPI = api();
    expect(await fontSize.stepSongFontSize(1, electronAPI)).toBe(12);
    expect(await fontSize.stepSongFontSize(1, electronAPI)).toBe(13);
    expect(await fontSize.stepSongFontSize(-1, electronAPI)).toBe(12);
    expect(electronAPI.profile.setPreference).toHaveBeenLastCalledWith('font_size', 12);
    expect(rootVars['--song-font-size']).toBe('12px');
  });

  it('stops at the limits', async () => {
    fontSize.applySongFontSize(25);
    expect(await fontSize.stepSongFontSize(1, api())).toBe(25);
    fontSize.applySongFontSize(8);
    expect(await fontSize.stepSongFontSize(-1, api())).toBe(8);
  });

  it('still shows the new size when saving fails', async () => {
    const electronAPI = { profile: { setPreference: vi.fn(async () => { throw new Error('disk'); }) } };
    expect(await fontSize.setSongFontSize(15, electronAPI)).toBe(15);
    expect(rootVars['--song-font-size']).toBe('15px');
    expect(window.debugLog.warn).toHaveBeenCalled();
  });

  it('applies the saved size at startup, or the default when there is none', async () => {
    expect(await fontSize.loadSongFontSize(api({ success: true, value: 16 }))).toBe(16);
    expect(rootVars['--song-font-size']).toBe('16px');
    expect(await fontSize.loadSongFontSize(api({ success: true, value: null }))).toBe(11);
    expect(await fontSize.loadSongFontSize(api({ success: false }))).toBe(11);
    const broken = { profile: { getPreference: vi.fn(async () => { throw new Error('ipc'); }) } };
    expect(await fontSize.loadSongFontSize(broken)).toBe(11);
    expect(window.debugLog.warn).toHaveBeenCalled();
  });
});
