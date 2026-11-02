import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { findReleaseForTag, deleteExistingAsset } = require('../../../build/github-release.cjs');

const target = { owner: 'minter', repo: 'mxvoice-electron', tag: 'v4.4.0-beta.2', version: '4.4.0-beta.2' };

function octokitWith(releases) {
  const listReleases = vi.fn();
  return {
    listReleases,
    octokit: {
      repos: { listReleases, deleteReleaseAsset: vi.fn().mockResolvedValue({}) },
      paginate: vi.fn().mockResolvedValue(releases)
    }
  };
}

describe('findReleaseForTag', () => {
  it('finds a draft release, which get-release-by-tag would miss', async () => {
    const draft = { id: 1, tag_name: 'v4.4.0-beta.2', draft: true };
    const { octokit, listReleases } = octokitWith([{ id: 9, tag_name: 'v4.3.2' }, draft]);

    await expect(findReleaseForTag(octokit, target)).resolves.toBe(draft);
    // Every page, not just the first
    expect(octokit.paginate).toHaveBeenCalledWith(listReleases, { owner: 'minter', repo: 'mxvoice-electron', per_page: 100 });
  });

  it('matches a release tagged with the bare version too, as electron-builder does', async () => {
    const bare = { id: 2, tag_name: '4.4.0-beta.2' };
    const { octokit } = octokitWith([bare]);
    await expect(findReleaseForTag(octokit, target)).resolves.toBe(bare);
  });

  it('returns null when the tag has no release', async () => {
    const { octokit } = octokitWith([{ id: 9, tag_name: 'v4.3.2' }]);
    await expect(findReleaseForTag(octokit, target)).resolves.toBeNull();
  });

  it('stops when the tag has more than one release, naming them', async () => {
    const { octokit } = octokitWith([
      { id: 432071170, tag_name: 'v4.4.0-beta.2', draft: false },
      { id: 432071169, tag_name: 'v4.4.0-beta.2', draft: true }
    ]);
    await expect(findReleaseForTag(octokit, target)).rejects.toThrow(/2 GitHub releases exist for v4\.4\.0-beta\.2 \(ids 432071170, 432071169 \(draft\)\)/);
  });
});

describe('deleteExistingAsset', () => {
  it('deletes an asset of the same name so the upload replaces it', async () => {
    const { octokit } = octokitWith([]);
    const release = { id: 1, assets: [{ id: 77, name: 'latest.yml' }, { id: 78, name: 'Setup.exe' }] };

    await expect(deleteExistingAsset(octokit, { ...target, release, name: 'latest.yml' })).resolves.toBe(true);
    expect(octokit.repos.deleteReleaseAsset).toHaveBeenCalledWith({ owner: 'minter', repo: 'mxvoice-electron', asset_id: 77 });
  });

  it('leaves the release alone when there is no such asset', async () => {
    const { octokit } = octokitWith([]);
    await expect(deleteExistingAsset(octokit, { ...target, release: { id: 1, assets: [] }, name: 'latest.yml' })).resolves.toBe(false);
    await expect(deleteExistingAsset(octokit, { ...target, release: { id: 1 }, name: 'latest.yml' })).resolves.toBe(false);
    expect(octokit.repos.deleteReleaseAsset).not.toHaveBeenCalled();
  });
});
