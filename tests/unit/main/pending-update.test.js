import { describe, expect, it } from 'vitest';
import {
  DOWNLOAD_GUARD_MS,
  getPendingUpdateNotice,
  isDownloadGuardActive,
  quietlyAnnouncedVersion,
  recordAvailableUpdate,
  recordDownloadedUpdate,
} from '../../../src/main/modules/pending-update.js';

describe('pending update state', () => {
  it('remembers the newest available update from either notice path', () => {
    const state = {};
    recordAvailableUpdate(state, { version: '4.3.3', name: '4.3.3', notes: '<p>a</p>', quiet: true });
    recordAvailableUpdate(state, { version: '4.3.4', name: '4.3.4', notes: '<p>b</p>', quiet: false });

    expect(getPendingUpdateNotice(state)).toEqual({ name: '4.3.4', notes: '<p>b</p>' });
  });

  it('only reports a version as quietly announced after the quiet path showed it', () => {
    const state = {};
    recordAvailableUpdate(state, { version: '4.3.3', name: '4.3.3', notes: '', quiet: false });
    expect(quietlyAnnouncedVersion(state)).toBeNull();

    recordAvailableUpdate(state, { version: '4.3.3', name: '4.3.3', notes: '', quiet: true });
    expect(quietlyAnnouncedVersion(state)).toBe('4.3.3');

    // Seeing the same version again via the modal keeps it announced
    recordAvailableUpdate(state, { version: '4.3.3', name: '4.3.3', notes: '', quiet: false });
    expect(quietlyAnnouncedVersion(state)).toBe('4.3.3');
  });

  it('stops offering an update once that version has downloaded, even if the downloaded flag is later reset', () => {
    const state = {};
    recordAvailableUpdate(state, { version: '4.3.3', name: '4.3.3', notes: '', quiet: true });
    recordDownloadedUpdate(state, '4.3.3');
    expect(state.downloaded).toBe(true);

    state.downloaded = false; // what a manual Check for Updates does
    expect(getPendingUpdateNotice(state)).toBeNull();
  });

  it('offers a newer version found after a download', () => {
    const state = {};
    recordDownloadedUpdate(state, '4.3.3');
    recordAvailableUpdate(state, { version: '4.3.4', name: '4.3.4', notes: '', quiet: true });
    expect(getPendingUpdateNotice(state)).toEqual({ name: '4.3.4', notes: '' });
  });

  it('has nothing to offer before any update is found', () => {
    expect(getPendingUpdateNotice({})).toBeNull();
  });
});

describe('isDownloadGuardActive', () => {
  it('guards a download in progress', () => {
    expect(isDownloadGuardActive({ downloading: true, downloadStartedAt: 1000 }, 1000 + 60_000)).toBe(true);
  });

  it('stops guarding a download that has not settled after 30 minutes', () => {
    expect(DOWNLOAD_GUARD_MS).toBe(30 * 60 * 1000);
    expect(isDownloadGuardActive({ downloading: true, downloadStartedAt: 1000 }, 1000 + DOWNLOAD_GUARD_MS)).toBe(false);
  });

  it('is inactive when nothing is downloading', () => {
    expect(isDownloadGuardActive({ downloading: false, downloadStartedAt: 1000 }, 2000)).toBe(false);
  });
});
