import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';

const registry = {
  profiles: {
    'Show!': { name: 'Show!' },
    'Default User': { name: 'Default User' }
  }
};

vi.mock('electron', () => ({
  default: { app: { getPath: () => '/tmp/mxvoice-profile-tests' } }
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(path => path.endsWith('profiles.json')),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => JSON.stringify(registry)),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(),
    rmSync: vi.fn()
  }
}));

const profileManager = await import('../../../src/main/modules/profile-manager.js');

describe('profile directory collision validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects distinct display names that sanitize to the same directory', () => {
    const result = profileManager.validateProfileName('Show?');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/conflicts with existing profile "Show!"/);
  });

  it('rejects names that sanitize to an empty directory', () => {
    const result = profileManager.validateProfileName('!!!');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/must contain/i);
  });

  it('does not delete a pre-existing directory during creation', () => {
    fs.existsSync.mockImplementation(path =>
      path.endsWith('profiles.json') || path.endsWith('Fresh Profile')
    );
    const result = profileManager.createProfile('Fresh Profile');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
    expect(fs.rmSync).not.toHaveBeenCalled();
  });
});
