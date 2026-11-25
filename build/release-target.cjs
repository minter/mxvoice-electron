const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const VERSION_TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;

function gitOutput(projectDir, args, runGit, description) {
  try {
    return runGit("git", args, {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    throw new Error(`${description}: ${error.message}`);
  }
}

function resolveReleaseTarget(projectDir = process.cwd(), tag, runGit = execFileSync) {
  if (typeof tag !== "string" || !VERSION_TAG_PATTERN.test(tag)) {
    throw new Error("A version tag such as v4.4.0 is required for a release");
  }

  const commitSha = gitOutput(
    projectDir,
    ["rev-parse", "--verify", "HEAD^{commit}"],
    runGit,
    "Unable to determine the release commit from git HEAD"
  );

  if (!COMMIT_SHA_PATTERN.test(commitSha)) {
    throw new Error(`Git returned an invalid release commit: ${commitSha || "(empty)"}`);
  }

  const checkedOutRef = gitOutput(
    projectDir,
    ["rev-parse", "--abbrev-ref", "HEAD"],
    runGit,
    "Unable to determine whether the release checkout is detached"
  );
  if (checkedOutRef !== "HEAD") {
    throw new Error(`Release checkout must be detached at ${tag}; currently on ${checkedOutRef || "an unknown branch"}`);
  }

  const tagTarget = gitOutput(
    projectDir,
    ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`],
    runGit,
    `Unable to resolve local release tag ${tag}`
  );
  if (!COMMIT_SHA_PATTERN.test(tagTarget)) {
    throw new Error(`Git returned an invalid target for release tag ${tag}: ${tagTarget || "(empty)"}`);
  }
  if (tagTarget.toLowerCase() !== commitSha.toLowerCase()) {
    throw new Error(`Release tag ${tag} targets ${tagTarget}, not checked-out commit ${commitSha}`);
  }

  const worktreeStatus = gitOutput(
    projectDir,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    runGit,
    "Unable to verify that the release checkout is clean"
  );
  if (worktreeStatus) {
    throw new Error(`Release checkout must be clean, including untracked files:\n${worktreeStatus}`);
  }

  return commitSha;
}

function assertEmptyReleaseOutput(projectDir = process.cwd(), fileSystem = fs) {
  const distDir = path.join(projectDir, "dist");
  if (!fileSystem.existsSync(distDir)) return;

  const stat = fileSystem.lstatSync(distDir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Release output dist/ must be a real directory, not a file or symbolic link");
  }

  const entries = fileSystem.readdirSync(distDir);
  if (entries.length > 0) {
    const sample = entries.slice(0, 5).join(", ");
    const more = entries.length > 5 ? ` (and ${entries.length - 5} more)` : "";
    throw new Error(`Release output dist/ must be empty before packaging; found ${sample}${more}`);
  }
}

function buildReleaseCreationOptions({
  owner,
  repo,
  tag,
  releaseTarget,
  isDraft,
  isPrerelease,
  releaseType,
  body = null
}) {
  return {
    owner,
    repo,
    tag_name: tag,
    target_commitish: releaseTarget,
    name: tag,
    draft: isDraft,
    prerelease: isPrerelease || releaseType === "prerelease",
    // Written notes when there are some; otherwise GitHub's generated list
    ...(body ? { body, generate_release_notes: false } : { generate_release_notes: true })
  };
}

module.exports = { assertEmptyReleaseOutput, buildReleaseCreationOptions, resolveReleaseTarget };
