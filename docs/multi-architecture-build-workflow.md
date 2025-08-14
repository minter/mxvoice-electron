# Multi-Architecture Build Workflow

This document explains how to build and release Mx. Voice for both ARM64 and x64 architectures using separate build processes.

## Overview

Since universal builds can have compatibility issues with certain native modules, we use a multi-architecture approach:

1. **x64 builds** are built on GitHub Actions (macos-13 runner)
2. **ARM64 builds** are built locally on your ARM Mac
3. **Update files are merged** to create a single `latest-mac.yml` that includes both architectures

## Workflow Steps

### 1. Build ARM64 Locally

```bash
# Build ARM64 version locally with release metadata
# Version is automatically read from package.json
yarn build:mac:arm64:release
```

This will:
- Build the ARM64 version using `yarn build:mac:arm64`
- Create or update the `dist/latest-mac.yml` file for ARM64
- Prepare for merging with x64 builds

### 2. Build x64 on GitHub Actions

1. Go to your GitHub repository
2. Navigate to Actions → Build and Release macOS x64 App
3. Click "Run workflow"
4. Enter your version (e.g., `4.0.0-pre.2`)
5. Set `is_prerelease` to `true`
6. Click "Run workflow"

The workflow will:
- Build x64 version on GitHub Actions
- Publish the release to GitHub
- Upload artifacts including `dist/latest-mac.yml`

### 3. Download x64 latest-mac.yml

1. After the GitHub Actions build completes
2. Go to the workflow run
3. Download the `macos-x64-signed-build` artifact
4. Extract and locate the `dist/latest-mac.yml` file

### 4. Merge the Update Files

```bash
# Place the x64 latest-mac.yml in your dist/ directory
# Then run the merge script
yarn merge:latest-mac
```

This creates `dist/latest-mac-merged.yml` with both architectures.

### 5. Upload Merged File

Upload the merged `latest-mac-merged.yml` to your GitHub release to replace the x64-only version.

## Benefits

✅ **Reliable builds** - Each architecture builds in its native environment
✅ **No update conflicts** - Single `latest-mac.yml` file includes both architectures
✅ **Better compatibility** - Each architecture builds in its optimal environment
✅ **Simpler debugging** - Each build process is independent

## Troubleshooting

### ARM64 Build Fails
- Check that you have the correct signing certificates
- Ensure all dependencies are installed
- Check the build logs for specific errors

### x64 Build Fails on GitHub Actions
- Check the workflow logs
- Verify secrets are configured correctly
- Ensure the runner has sufficient resources

### Merge Fails
- Verify both `latest-mac.yml` files exist
- Check that the version numbers match
- Ensure `js-yaml` dependency is installed

## File Structure

```
dist/
├── Mx. Voice-4.0.0-pre.2-arm64.dmg      # ARM64 DMG (local build)
├── Mx. Voice-4.0.0-pre.2-arm64.zip      # ARM64 ZIP (local build)
├── latest-mac.yml                        # ARM64 update info (local build)
├── latest-mac-merged.yml                 # Combined update info (after merge)
└── [x64 files will be here after GitHub Actions build]
```

## Environment Variables

- `VERSION` - The version being built (defaults to `4.0.0-pre.1`)
- `BUILD_DIR` - Build output directory (defaults to `dist`)

## Next Steps

After implementing this workflow, you can:
1. **Automate the merge process** with additional scripts
2. **Add validation** to ensure both architectures are properly included
3. **Create a GitHub Action** that automatically merges the files after both builds complete
