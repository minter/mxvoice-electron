import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  isSupportedAudioFile,
  copyFileStreaming
} from '../../../src/main/modules/file-utils.js';

describe('file-utils', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-file-utils-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('recognizes supported audio extensions case-insensitively', () => {
    expect(isSupportedAudioFile('/x/song.MP3')).toBe(true);
    expect(isSupportedAudioFile('/x/song.opus')).toBe(true);
    expect(isSupportedAudioFile('/x/notes.txt')).toBe(false);
    expect(SUPPORTED_AUDIO_EXTENSIONS.has('.mp3')).toBe(true);
  });

  it('copies a file and reports bytes', async () => {
    const src = path.join(tmpDir, 'src.mp3');
    const dest = path.join(tmpDir, 'nested', 'dest.mp3');
    fs.writeFileSync(src, 'audio-bytes');
    const result = await copyFileStreaming(src, dest);
    expect(result.success).toBe(true);
    expect(fs.readFileSync(dest, 'utf8')).toBe('audio-bytes');
  });

  it('invokes the progress callback and finishes at 100', async () => {
    const src = path.join(tmpDir, 'src.mp3');
    const dest = path.join(tmpDir, 'dest.mp3');
    fs.writeFileSync(src, 'x'.repeat(1024));
    const calls = [];
    const result = await copyFileStreaming(src, dest, {
      progressCallback: (pct, copied, total) => calls.push([pct, copied, total])
    });
    expect(result.success).toBe(true);
    expect(calls.at(-1)[0]).toBe(100);
  });

  it('returns failure (not throw) for a missing source', async () => {
    const result = await copyFileStreaming(
      path.join(tmpDir, 'missing.mp3'),
      path.join(tmpDir, 'dest.mp3')
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not exist/);
    expect(fs.existsSync(path.join(tmpDir, 'dest.mp3'))).toBe(false);
  });
});
