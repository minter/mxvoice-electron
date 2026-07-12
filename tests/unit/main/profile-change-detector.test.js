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
});
