import { describe, expect, it, vi } from 'vitest';
import { showMissingAudioFile } from '../../../src/renderer/modules/audio/playback-error-presenter.js';

describe('playback error presenter', () => {
  it('renders a missing-file message and clears the active song', () => {
    const nowPlaying = {
      appendChild: vi.fn(), removeAttribute: vi.fn(), style: {}, textContent: 'old'
    };
    const documentTarget = {
      getElementById: () => nowPlaying,
      createElement: () => ({}),
      createTextNode: (text) => ({ text })
    };
    expect(showMissingAudioFile({ title: 'Theme', filename: 'theme.mp3', documentTarget })).toBe(true);
    expect(nowPlaying.removeAttribute).toHaveBeenCalledWith('songid');
    expect(nowPlaying.appendChild).toHaveBeenLastCalledWith({ text: ' File not found: Theme' });
  });
});
