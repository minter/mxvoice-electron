import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import ipcChannels from '../../../src/shared/ipc-channels.cjs';

const { IPC } = ipcChannels;

const preloadSources = ['src/preload/modules/secure-api-exposer.cjs'];

const forbiddenChannels = ['file-read', 'file-write', 'file-mkdir', 'fs-readdir', 'fs-stat', 'file-get-user-data-path'];

describe('preload filesystem capability surface', () => {
  it.each(preloadSources)('does not expose generic filesystem methods in %s', source => {
    const contents = fs.readFileSync(source, 'utf8');
    for (const channel of forbiddenChannels) {
      expect(contents).not.toContain(`'${channel}'`);
    }
  });

  it('forbidden filesystem channels are absent from the IPC manifest', () => {
    const manifestValues = new Set(Object.values(IPC).flatMap(domain => Object.values(domain)));
    for (const channel of forbiddenChannels) {
      expect(manifestValues.has(channel), `manifest must not expose forbidden channel '${channel}'`).toBe(false);
    }
  });

  it.each(preloadSources)('exposes bounded library operations in %s', source => {
    const contents = fs.readFileSync(source, 'utf8');
    expect(contents).toContain('ipcRenderer.invoke(IPC.FILESYSTEM.FILE_COPY');
    expect(contents).toContain('ipcRenderer.invoke(IPC.FILESYSTEM.FILE_DELETE');
    expect(contents).toContain('ipcRenderer.invoke(IPC.FILESYSTEM.SCAN_AUDIO_DIRECTORY');
  });
});
