import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteProfileWithRecovery } from '../../../src/main/modules/profile-delete.js';

let order;
let deps;

beforeEach(() => {
  order = [];
  deps = {
    profileManager: {
      getDeleteProfileBlocker: vi.fn(() => null),
      deleteProfile: vi.fn(async () => { order.push('delete'); return { success: true }; })
    },
    showSession: { end: vi.fn(async (reason) => { order.push(`end:${reason}`); }) },
    recoveryStore: {
      retire: vi.fn(async () => { order.push('retire'); }),
      retirePlayed: vi.fn(async () => { order.push('retirePlayed'); })
    },
    getCurrentProfile: () => 'Alice',
    debugLog: { warn: vi.fn() }
  };
});

describe('deleteProfileWithRecovery', () => {
  it('ends the current profile\'s session, deletes, then retires its recovery files', async () => {
    await expect(deleteProfileWithRecovery('Alice', deps)).resolves.toEqual({ success: true });
    expect(order).toEqual(['end:profile-deleted', 'delete', 'retire', 'retirePlayed']);
  });

  it('a current-profile delete that fails after end returns sessionEnded', async () => {
    deps.profileManager.deleteProfile.mockResolvedValue({ success: false, error: 'EBUSY: resource busy or locked' });
    await expect(deleteProfileWithRecovery('Alice', deps)).resolves.toEqual({
      success: false, error: 'EBUSY: resource busy or locked', sessionEnded: true
    });
    expect(deps.showSession.end).toHaveBeenCalledWith('profile-deleted');
    // The profile is still there, so are its recovery files
    expect(deps.recoveryStore.retire).not.toHaveBeenCalled();
    expect(deps.recoveryStore.retirePlayed).not.toHaveBeenCalled();

    // A throw after end is the same
    deps.profileManager.deleteProfile.mockRejectedValue(new Error('EPERM'));
    await expect(deleteProfileWithRecovery('Alice', deps)).resolves.toEqual({
      success: false, error: 'EPERM', sessionEnded: true
    });
  });

  it('a failed delete of another profile, or a refused one, leaves the session alone', async () => {
    deps.profileManager.deleteProfile.mockResolvedValue({ success: false, error: 'EBUSY' });
    await expect(deleteProfileWithRecovery('Bob', deps)).resolves.toEqual({ success: false, error: 'EBUSY' });

    deps.profileManager.getDeleteProfileBlocker.mockReturnValue('Cannot delete the default profile');
    deps.profileManager.deleteProfile.mockResolvedValue({ success: false, error: 'Cannot delete the default profile' });
    await expect(deleteProfileWithRecovery('Alice', deps)).resolves.toEqual({
      success: false, error: 'Cannot delete the default profile'
    });
    expect(deps.showSession.end).not.toHaveBeenCalled();
  });

  it('a throw deleting another profile still rejects as before', async () => {
    deps.profileManager.deleteProfile.mockRejectedValue(new Error('EPERM'));
    await expect(deleteProfileWithRecovery('Bob', deps)).rejects.toThrow('EPERM');
  });
});
