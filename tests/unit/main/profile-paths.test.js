import { beforeAll, describe, expect, it, vi } from 'vitest';
import path from 'node:path';

const userDataDirectory = '/tmp/mxvoice-profile-paths';

vi.mock('electron', () => ({
  default: { app: { getPath: () => userDataDirectory } }
}));

let profilePaths;

beforeAll(async () => {
  profilePaths = await import('../../../src/main/modules/profile-paths.js');
});

describe('profile paths', () => {
  it('uses one sanitized directory name for profile files and backups', () => {
    const profileName = ' Saturday: Show! ';
    const sanitizedName = 'Saturday Show';

    expect(profilePaths.sanitizeProfileName(profileName)).toBe(sanitizedName);
    expect(profilePaths.getProfileDirectory(profileName)).toBe(
      path.join(userDataDirectory, 'profiles', sanitizedName)
    );
    expect(profilePaths.getProfileStatePath(profileName)).toBe(
      path.join(userDataDirectory, 'profiles', sanitizedName, 'state.json')
    );
    expect(profilePaths.getBackupDirectory(profileName)).toBe(
      path.join(userDataDirectory, 'profile-backups', sanitizedName)
    );
  });

  it('normalizes profile directory keys for collision checks', () => {
    expect(profilePaths.getProfileDirectoryKey('MY: SHOW')).toBe('my show');
  });
});
