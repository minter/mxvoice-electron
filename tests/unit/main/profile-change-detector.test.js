import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import crypto from 'node:crypto';
import { createProfileChangeDetector } from '../../../src/main/modules/profile-change-detector.js';

describe('profile change detector', () => {
  it('reports unchanged content when its hash matches metadata', async () => {
    const fs = { promises: {
      readdir: vi.fn().mockResolvedValue([{ name: 'state.json', isDirectory: () => false }]),
      stat: vi.fn().mockResolvedValue({ size: 2, mtimeMs: 10 }),
      readFile: vi.fn().mockResolvedValue(Buffer.from('{}'))
    } };
    const dependencies = {
      fs, path, crypto,
      getProfileDirectory: () => '/profiles/Show',
      pathExists: async () => true,
      readMetadata: vi.fn(),
      getDebugLog: () => null
    };
    const detector = createProfileChangeDetector(dependencies);
    const hash = await detector.calculateHash('Show');
    dependencies.readMetadata.mockResolvedValue({ lastBackupHash: hash });
    await expect(detector.hasChanged('Show')).resolves.toEqual({
      changed: false, currentHash: hash, lastHash: hash
    });
  });

  it('assumes changed when the profile cannot be hashed', async () => {
    const detector = createProfileChangeDetector({
      fs: {}, path, crypto,
      getProfileDirectory: () => '/missing',
      pathExists: async () => false,
      readMetadata: vi.fn(),
      getDebugLog: () => null
    });
    await expect(detector.hasChanged('Show')).resolves.toEqual({ changed: true });
  });

  it('auto-backup hash ignores recovery writes', async () => {
    const os = await import('node:os');
    const realFs = (await import('node:fs')).default;
    const root = realFs.mkdtempSync(path.join(os.tmpdir(), 'mxv-hash-'));
    try {
      const profileDir = path.join(root, 'profiles', 'Show');
      realFs.mkdirSync(profileDir, { recursive: true });
      realFs.writeFileSync(path.join(profileDir, 'shows.json'), '{}');
      const detector = createProfileChangeDetector({
        fs: realFs, path, crypto,
        getProfileDirectory: () => profileDir,
        pathExists: async () => true,
        readMetadata: vi.fn(),
        getDebugLog: () => null
      });
      const before = await detector.calculateHash('Show');
      // The recovery record lives in userData/recovery, outside the profile dir.
      realFs.mkdirSync(path.join(root, 'recovery'), { recursive: true });
      realFs.writeFileSync(path.join(root, 'recovery', 'show.json'), '{"x":1}');
      expect(await detector.calculateHash('Show')).toBe(before);
    } finally {
      realFs.rmSync(root, { recursive: true, force: true });
    }
  });
});
