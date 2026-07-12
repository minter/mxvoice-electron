import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { createBackupDirectoryScanner } from '../../../src/main/modules/backup-directory-scanner.js';

describe('backup directory scanner', () => {
  it('parses backup IDs as UTC timestamps', () => {
    const scanner = createBackupDirectoryScanner({});
    expect(scanner.timestampFromBackupId('backup-2026-07-12T14-30-15-250Z', 0)).toBe(
      Date.UTC(2026, 6, 12, 14, 30, 15, 250)
    );
    expect(scanner.timestampFromBackupId('other', 42)).toBe(42);
  });

  it('recursively calculates size and file count', async () => {
    const fs = { promises: {
      readdir: vi.fn(async (directory) => directory === '/backup'
        ? [{ name: 'nested', isDirectory: () => true }, { name: 'a', isDirectory: () => false }]
        : [{ name: 'b', isDirectory: () => false }]),
      stat: vi.fn(async (file) => ({ size: file.endsWith('a') ? 10 : 20 }))
    } };
    const scanner = createBackupDirectoryScanner({ fs, path });
    await expect(scanner.calculateSize('/backup')).resolves.toEqual({ size: 30, fileCount: 2 });
  });
});
