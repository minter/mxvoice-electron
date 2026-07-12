import { describe, expect, it, vi } from 'vitest';
import { resolveAudioSource } from '../../../src/renderer/modules/audio/audio-source-resolver.js';

describe('audio source resolver', () => {
  it('joins and validates an audio source', async () => {
    const pathAPI = { join: vi.fn().mockResolvedValue({ success: true, data: '/music/song.mp3' }) };
    const fileSystemAPI = { exists: vi.fn().mockResolvedValue({ success: true, exists: true }) };
    await expect(resolveAudioSource({ musicDirectory: '/music', filename: 'song.mp3', pathAPI, fileSystemAPI }))
      .resolves.toEqual({ success: true, filePath: '/music/song.mp3', source: ['/music/song.mp3'] });
  });

  it('distinguishes path failures from missing files', async () => {
    const failedPath = await resolveAudioSource({
      musicDirectory: '/music', filename: 'song.mp3',
      pathAPI: { join: async () => ({ success: false, error: 'bad path' }) },
      fileSystemAPI: { exists: vi.fn() }
    });
    expect(failedPath).toMatchObject({ success: false, reason: 'path' });

    const missing = await resolveAudioSource({
      musicDirectory: '/music', filename: 'song.mp3',
      pathAPI: { join: async () => ({ success: true, data: '/music/song.mp3' }) },
      fileSystemAPI: { exists: async () => ({ success: true, exists: false }) }
    });
    expect(missing).toMatchObject({ success: false, reason: 'missing', filePath: '/music/song.mp3' });
  });
});
