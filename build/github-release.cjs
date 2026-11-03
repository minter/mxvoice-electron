// build/github-release.cjs
// One GitHub release per tag, whichever platform publishes first and in
// whichever mode (draft, prerelease, release). Used by publishWindows.cjs and
// by ensureRelease.cjs, which runs before electron-builder publishes.

const fs = require("fs");
const path = require("path");
const { buildReleaseCreationOptions } = require("./release-target.cjs");

/**
 * The release for a tag, or null when there is none. Lists releases rather
 * than using GitHub's get-release-by-tag, which never returns drafts: a draft
 * the macOS publish made would look missing and get a second release. Matches
 * the tag or the bare version, as electron-builder's publisher does.
 *
 * Throws when the tag has more than one release: assets would land on an
 * arbitrary one, and GitHub refuses edits to either until one is deleted.
 *
 * @param {Object} octokit - an @octokit/rest client
 * @param {{ owner: string, repo: string, tag: string, version: string }} target
 * @returns {Promise<Object|null>}
 */
async function findReleaseForTag(octokit, { owner, repo, tag, version }) {
  const releases = await octokit.paginate(octokit.repos.listReleases, { owner, repo, per_page: 100 });
  const matches = releases.filter((release) => release.tag_name === tag || release.tag_name === version);
  if (matches.length > 1) {
    const ids = matches.map((release) => `${release.id}${release.draft ? " (draft)" : ""}`).join(", ");
    throw new Error(
      `${matches.length} GitHub releases exist for ${tag} (ids ${ids}). ` +
      "Delete the extra one on GitHub, keeping the one with the other platform's files, then publish again."
    );
  }
  return matches[0] ?? null;
}

/**
 * Delete an asset of the same name from the release, so a re-run replaces it
 * instead of failing on GitHub's "already_exists".
 *
 * @param {Object} octokit
 * @param {{ owner: string, repo: string, release: Object, name: string }} target
 * @returns {Promise<boolean>} whether an asset was deleted
 */
async function deleteExistingAsset(octokit, { owner, repo, release, name }) {
  const existing = (release.assets ?? []).find((asset) => asset.name === name);
  if (!existing) return false;
  await octokit.repos.deleteReleaseAsset({ owner, repo, asset_id: existing.id });
  return true;
}

/**
 * The tag's release, created if it doesn't exist yet, with the flags this
 * publish asks for. Never publishes a draft: a draft stays a draft until it is
 * published on GitHub. Asking for a draft unpublishes a published release, as
 * the draft scripts always have, so a draft publish can't add to a live release.
 *
 * @param {Object} octokit - an @octokit/rest client
 * @param {Object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} options.tag - e.g. "v4.4.0-beta.2"
 * @param {string} options.version - e.g. "4.4.0-beta.2"
 * @param {string} options.releaseTarget - commit SHA a new tag points at
 * @param {boolean} options.isDraft
 * @param {boolean} options.isPrerelease
 * @param {string} options.releaseType - "release" | "prerelease" | "draft"
 * @param {string|null} [options.body] - release notes for a new release
 * @param {(message: string) => void} [options.log]
 * @returns {Promise<{ release: Object, created: boolean }>}
 */
async function ensureRelease(octokit, {
  owner, repo, tag, version, releaseTarget, isDraft, isPrerelease, releaseType, body = null, log = () => {}
}) {
  let release = await findReleaseForTag(octokit, { owner, repo, tag, version });
  if (!release) {
    log(`Creating new ${isDraft ? "draft " : ""}${releaseType} release ${tag}...`);
    const response = await octokit.repos.createRelease(buildReleaseCreationOptions({
      owner, repo, tag, releaseTarget, isDraft, isPrerelease, releaseType, body
    }));
    log(`✅ Created release ${tag}`);
    return { release: response.data, created: true };
  }

  log(`Release ${tag} already exists${release.draft ? " (draft)" : ""}`);
  const wantsPrerelease = isPrerelease || releaseType === "prerelease";
  if (wantsPrerelease && !release.prerelease) {
    log("Marking the release as a prerelease...");
    release = (await octokit.repos.updateRelease({ owner, repo, release_id: release.id, prerelease: true })).data;
  }
  if (isDraft && !release.draft) {
    log("Marking the release as a draft...");
    release = (await octokit.repos.updateRelease({ owner, repo, release_id: release.id, draft: true })).data;
  }
  return { release, created: false };
}

/**
 * The written notes for a version, docs/release-notes/v<version>.md, or null
 * when there are none (GitHub then generates a list of changes).
 * @param {string} projectDir
 * @param {string} version
 * @returns {string|null}
 */
function releaseNotesBody(projectDir, version, readFile = fs.readFileSync) {
  try {
    const body = readFile(path.join(projectDir, "docs", "release-notes", `v${version}.md`), "utf8").trim();
    return body || null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

module.exports = { findReleaseForTag, deleteExistingAsset, ensureRelease, releaseNotesBody };
