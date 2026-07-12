import { describe, expect, it, vi } from 'vitest';
import {
  showActivePlayback,
  updateWaveform
} from '../../../src/renderer/modules/audio/playback-ui-presenter.js';

describe('playback UI presenter', () => {
  it('loads the waveform and adds trim markers when ready', () => {
    let readyHandler;
    const wavesurfer = {
      load: vi.fn(),
      once: vi.fn((event, handler) => { readyHandler = handler; }),
      getDuration: () => 120
    };
    const regions = { clearRegions: vi.fn(), addRegion: vi.fn() };
    const values = new Map([['wavesurfer', wavesurfer], ['wavesurferRegions', regions]]);
    expect(updateWaveform({
      source: ['/music/song.mp3'], row: { start_time: 5, end_time: 90 },
      sharedState: { get: (key) => values.get(key) }
    })).toBe(true);
    expect(wavesurfer.load).toHaveBeenCalledWith(['/music/song.mp3']);
    readyHandler();
    expect(regions.addRegion).toHaveBeenCalledWith(expect.objectContaining({ start: 5, end: 90 }));
  });

  it('updates now-playing text and transport controls', () => {
    const elements = Object.fromEntries(['song_now_playing', 'play_button', 'pause_button', 'stop_button'].map((id) => [id, {
      appendChild: vi.fn(), setAttribute: vi.fn(), removeAttribute: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() }, style: {}
    }]));
    const documentTarget = {
      getElementById: (id) => elements[id],
      createElement: () => ({}),
      createTextNode: (text) => ({ text })
    };
    showActivePlayback({ songId: 42, row: { title: 'Theme', artist: 'Band' }, documentTarget });
    expect(elements.song_now_playing.setAttribute).toHaveBeenCalledWith('songid', '42');
    expect(elements.song_now_playing.appendChild).toHaveBeenLastCalledWith({ text: ' Theme by Band' });
    expect(elements.pause_button.classList.remove).toHaveBeenCalledWith('d-none');
    expect(elements.stop_button.removeAttribute).toHaveBeenCalledWith('disabled');
  });
});
