import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the audio file filtering logic used by file-drop-handler.
 *
 * We test the pure filtering function in isolation rather than importing the
 * module directly, since it wires into document events and requires a full
 * DOM environment.
 */

const SUPPORTED_AUDIO_EXTS = new Set(['.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.flac', '.opus']);

/**
 * Mirrors the extractAudioFiles filtering logic from file-drop-handler.js
 */
function filterAudioFiles(fileList) {
  return fileList
    .filter(f => {
      const dot = f.name.lastIndexOf('.');
      if (dot === -1) return false;
      return SUPPORTED_AUDIO_EXTS.has(f.name.substring(dot).toLowerCase());
    })
    .map(f => f.path)
    .filter(Boolean);
}

describe('file-drop-handler — audio file filtering', () => {
  it('accepts all supported audio extensions', () => {
    const files = [
      { name: 'a.mp3', path: '/a.mp3' },
      { name: 'b.mp4', path: '/b.mp4' },
      { name: 'c.m4a', path: '/c.m4a' },
      { name: 'd.wav', path: '/d.wav' },
      { name: 'e.ogg', path: '/e.ogg' },
      { name: 'f.flac', path: '/f.flac' },
      { name: 'g.opus', path: '/g.opus' },
    ];
    expect(filterAudioFiles(files)).toHaveLength(7);
  });

  it('rejects non-audio extensions', () => {
    const files = [
      { name: 'readme.txt', path: '/readme.txt' },
      { name: 'photo.jpg', path: '/photo.jpg' },
      { name: 'doc.pdf', path: '/doc.pdf' },
      { name: 'archive.zip', path: '/archive.zip' },
    ];
    expect(filterAudioFiles(files)).toHaveLength(0);
  });

  it('filters mixed audio and non-audio files', () => {
    const files = [
      { name: 'song.mp3', path: '/song.mp3' },
      { name: 'notes.txt', path: '/notes.txt' },
      { name: 'clip.wav', path: '/clip.wav' },
      { name: 'image.png', path: '/image.png' },
    ];
    expect(filterAudioFiles(files)).toEqual(['/song.mp3', '/clip.wav']);
  });

  it('handles case-insensitive extensions', () => {
    const files = [
      { name: 'LOUD.MP3', path: '/LOUD.MP3' },
      { name: 'Track.Flac', path: '/Track.Flac' },
      { name: 'mix.OGG', path: '/mix.OGG' },
    ];
    expect(filterAudioFiles(files)).toHaveLength(3);
  });

  it('rejects files with no extension', () => {
    const files = [
      { name: 'Makefile', path: '/Makefile' },
      { name: 'LICENSE', path: '/LICENSE' },
    ];
    expect(filterAudioFiles(files)).toHaveLength(0);
  });

  it('handles files with multiple dots in name', () => {
    const files = [
      { name: 'my.cool.song.mp3', path: '/my.cool.song.mp3' },
      { name: 'backup.2024.tar.gz', path: '/backup.2024.tar.gz' },
    ];
    expect(filterAudioFiles(files)).toEqual(['/my.cool.song.mp3']);
  });

  it('filters out files with empty path (sandbox mode)', () => {
    const files = [
      { name: 'song.mp3', path: '' },
      { name: 'clip.wav', path: '/clip.wav' },
    ];
    expect(filterAudioFiles(files)).toEqual(['/clip.wav']);
  });

  it('returns empty array for empty file list', () => {
    expect(filterAudioFiles([])).toEqual([]);
  });

  it('handles dot-only filename edge case', () => {
    const files = [
      { name: '.mp3', path: '/.mp3' },
    ];
    // ".mp3" — the dot is at index 0, extension is ".mp3" — technically valid
    expect(filterAudioFiles(files)).toEqual(['/.mp3']);
  });
});
