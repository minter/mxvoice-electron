import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-save-state-'));

vi.mock('electron', () => ({
  default: { app: { getPath: () => userDataDir } }
}));

const profileManager = await import('../../../src/main/modules/profile-manager.js');

const stateWithData = {
  hotkeys: [{ tabNumber: 1, hotkeys: { f1: '42' } }],
  holdingTank: [{ tabNumber: 1, songIds: ['7'] }]
};
const emptyState = { hotkeys: [], holdingTank: [] };

const stateFile = (name) =>
  path.join(userDataDir, 'profiles', name, 'state.json');

describe('saveProfileState', () => {
  beforeEach(() => {
    fs.rmSync(path.join(userDataDir, 'profiles'), { recursive: true, force: true });
  });
  afterAll(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  it('writes state.json under the sanitized profile directory', async () => {
    const result = await profileManager.saveProfileState('My Show', stateWithData);
    expect(result.success).toBe(true);
    const written = JSON.parse(fs.readFileSync(stateFile('My Show'), 'utf8'));
    expect(written.hotkeys[0].hotkeys.f1).toBe('42');
  });

  it('backs up the previous state before overwriting', async () => {
    await profileManager.saveProfileState('My Show', stateWithData);
    await profileManager.saveProfileState('My Show', emptyState);
    const backup = JSON.parse(
      fs.readFileSync(stateFile('My Show') + '.backup', 'utf8')
    );
    expect(backup.hotkeys[0].hotkeys.f1).toBe('42');
  });

  it('rejects a missing profile name', async () => {
    await expect(profileManager.saveProfileState(null, stateWithData)).rejects.toThrow(
      /No profile name/
    );
  });
});
