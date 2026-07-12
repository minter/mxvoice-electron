import { describe, expect, it } from 'vitest';
import { loadSongForPlayback } from '../../../src/renderer/modules/audio/playback-song-loader.js';

describe('playback song loader', () => {
  it('returns the first playable database row', async () => {
    const row = { id: 4, filename: 'theme.mp3' };
    await expect(loadSongForPlayback(4, {
      getSongById: async () => ({ success: true, data: [row] })
    })).resolves.toEqual({ success: true, filename: 'theme.mp3', row });
  });

  it('normalizes missing rows, filenames, and query errors', async () => {
    await expect(loadSongForPlayback(4, {
      getSongById: async () => ({ success: true, data: [] })
    })).resolves.toMatchObject({ success: false, error: 'Song not found' });
    await expect(loadSongForPlayback(4, {
      getSongById: async () => ({ success: true, data: [{ id: 4 }] })
    })).resolves.toMatchObject({ success: false, error: 'Song has no filename' });
    await expect(loadSongForPlayback(4, {
      getSongById: async () => { throw new Error('database offline'); }
    })).resolves.toMatchObject({ success: false, error: 'database offline' });
  });
});
