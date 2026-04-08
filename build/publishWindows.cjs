// build/publishWindows.cjs
// Publish already-built Windows artifacts to GitHub without rebuilding
const { Octokit } = require("@octokit/rest");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

if (process.platform !== "win32") {
  console.log("[publishWindows] Skipping - not Windows platform");
  process.exit(0);
}

const distDir = path.join(process.cwd(), "dist");
if (!fs.existsSync(distDir)) {
  console.error("[publishWindows] dist/ directory not found");
  process.exit(1);
}

// Read package.json to get version and repo info
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const version = packageJson.version;
const publishConfig = packageJson.build?.publish?.[0];

if (!publishConfig || publishConfig.provider !== "github") {
  console.error("[publishWindows] GitHub publish configuration not found");
  process.exit(1);
}

const owner = publishConfig.owner;
const repo = publishConfig.repo;
const tag = `v${version}`;

// Find artifacts matching the current version
const entries = fs.readdirSync(distDir);
const installerFile = entries.find(entry => {
  const lower = entry.toLowerCase();
  // Must be a setup exe AND match the current version
  return lower.endsWith(".exe") && lower.includes("setup") && entry.includes(version);
});

if (!installerFile) {
  console.error(`[publishWindows] Installer file for version ${version} not found in dist/`);
  console.error(`[publishWindows] Available files: ${entries.filter(e => e.endsWith(".exe")).join(", ")}`);
  process.exit(1);
}

const installerPath = path.join(distDir, installerFile);
const blockMapFile = installerFile + ".blockmap";
const blockMapPath = path.join(distDir, blockMapFile);

const artifacts = [{ name: installerFile, path: installerPath }];

// Regenerate the blockmap from the signed installer.
// electron-builder generates the blockmap before code signing, so its block
// hashes describe the unsigned binary.  electron-updater would then use the
// stale blockmap for a differential download, reassemble a file whose sha512
// doesn't match the signed installer, and report a checksum mismatch.
// Re-running app-builder blockmap against the signed exe fixes this.
try {
  const { appBuilderPath: appBuilderBin } = require("app-builder-bin");
  if (fs.existsSync(appBuilderBin)) {
    console.log(`[publishWindows] Regenerating blockmap from signed installer...`);
    execFileSync(appBuilderBin, [
      "blockmap",
      "--input", installerPath,
      "--output", blockMapPath,
      "--compression", "gzip"
    ]);
    console.log(`[publishWindows] ✅ Blockmap regenerated for signed installer`);
    artifacts.push({ name: blockMapFile, path: blockMapPath });
  } else {
    console.warn(`[publishWindows] ⚠️  app-builder not found at ${appBuilderBin} — skipping blockmap`);
  }
} catch (err) {
  console.warn(`[publishWindows] ⚠️  Failed to regenerate blockmap: ${err.message} — skipping blockmap`);
}

// Recalculate latest.yml checksums to match the signed installer
// electron-builder generates latest.yml before signing, so the sha512 is stale
const latestYmlPath = path.join(distDir, "latest.yml");
if (fs.existsSync(latestYmlPath)) {
  const installerData = fs.readFileSync(installerPath);
  const newSha512 = crypto.createHash("sha512").update(installerData).digest("base64");
  const newSize = installerData.length;

  let latestYml = fs.readFileSync(latestYmlPath, "utf8");
  const oldSha512Match = latestYml.match(/sha512: (.+)/);
  if (oldSha512Match) {
    const oldSha512 = oldSha512Match[1];
    if (oldSha512 !== newSha512) {
      console.log(`[publishWindows] Updating latest.yml sha512 to match signed installer`);
      console.log(`[publishWindows]   Old: ${oldSha512}`);
      console.log(`[publishWindows]   New: ${newSha512}`);
      latestYml = latestYml.replaceAll(oldSha512, newSha512);
    }
  }
  const oldSizeMatch = latestYml.match(/size: (\d+)/);
  if (oldSizeMatch && parseInt(oldSizeMatch[1]) !== newSize) {
    console.log(`[publishWindows] Updating latest.yml size: ${oldSizeMatch[1]} → ${newSize}`);
    latestYml = latestYml.replace(/size: \d+/, `size: ${newSize}`);
  }
  fs.writeFileSync(latestYmlPath, latestYml, "utf8");

  artifacts.push({ name: "latest.yml", path: latestYmlPath });
} else {
  console.warn("[publishWindows] ⚠️  latest.yml not found in dist/ — auto-update discovery will not work");
}

console.log(`[publishWindows] Publishing to GitHub:`);
console.log(`[publishWindows]   Owner: ${owner}`);
console.log(`[publishWindows]   Repo: ${repo}`);
console.log(`[publishWindows]   Tag: ${tag}`);
console.log(`[publishWindows]   Artifacts: ${artifacts.map(a => a.name).join(", ")}`);

// Check for GitHub token
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.error("[publishWindows] GitHub token not found. Set GH_TOKEN or GITHUB_TOKEN environment variable.");
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

(async () => {
  try {
    // Determine release type from environment OR CLI arguments
    // CLI args take precedence (needed because cross-env doesn't persist across && on Windows)
    const args = process.argv.slice(2);
    const isDraft = args.includes("--draft") || process.env.EP_DRAFT === "true";
    const isPrerelease = args.includes("--prerelease") || process.env.EP_PRE_RELEASE === "true";
    const releaseType = isPrerelease ? "prerelease" : (publishConfig.releaseType || "release");
    
    console.log(`[publishWindows] Release flags: draft=${isDraft}, prerelease=${isPrerelease}, releaseType=${releaseType}`);
    
    // Check if release exists
    let release;
    try {
      const response = await octokit.repos.getReleaseByTag({
        owner,
        repo,
        tag
      });
      release = response.data;
      console.log(`[publishWindows] Release ${tag} already exists, uploading artifacts...`);
      
      // Update release flags if needed (e.g., if prerelease flag should be set)
      if (isPrerelease && !release.prerelease) {
        console.log(`[publishWindows] Updating release to mark as prerelease...`);
        const updateResponse = await octokit.repos.updateRelease({
          owner,
          repo,
          release_id: release.id,
          prerelease: true
        });
        release = updateResponse.data;
        console.log(`[publishWindows] ✅ Release marked as prerelease`);
      }
      if (isDraft && !release.draft) {
        console.log(`[publishWindows] Updating release to mark as draft...`);
        const updateResponse = await octokit.repos.updateRelease({
          owner,
          repo,
          release_id: release.id,
          draft: true
        });
        release = updateResponse.data;
        console.log(`[publishWindows] ✅ Release marked as draft`);
      }
    } catch (error) {
      if (error.status === 404) {
        // Create new release
        console.log(`[publishWindows] Creating new ${releaseType} release ${tag}...`);
        const response = await octokit.repos.createRelease({
          owner,
          repo,
          tag_name: tag,
          name: tag,
          draft: isDraft,
          prerelease: isPrerelease || releaseType === "prerelease",
          generate_release_notes: true
        });
        release = response.data;
        console.log(`[publishWindows] ✅ Created release ${tag}`);
      } else {
        throw error;
      }
    }

    // Upload artifacts
    for (const artifact of artifacts) {
      const fileSize = fs.statSync(artifact.path).size;
      console.log(`[publishWindows] Uploading ${artifact.name} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);
      
      const fileContent = fs.readFileSync(artifact.path);
      
      await octokit.repos.uploadReleaseAsset({
        owner,
        repo,
        release_id: release.id,
        name: artifact.name.replace(/\s+/g, "-"),
        data: fileContent,
        headers: {
          "content-type": artifact.path.endsWith(".exe") ? "application/octet-stream"
          : artifact.path.endsWith(".yml") ? "application/x-yaml"
          : "application/octet-stream",
          "content-length": fileSize
        }
      });
      
      console.log(`[publishWindows] ✅ Uploaded ${artifact.name}`);
    }

    console.log(`[publishWindows] ✅ Successfully published all artifacts to GitHub!`);
  } catch (error) {
    console.error("[publishWindows] ❌ Failed to publish:", error.message);
    if (error.response) {
      console.error("[publishWindows] Response:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
})();
