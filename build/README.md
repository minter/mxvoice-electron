# Build Directory

This directory contains build scripts and configuration for the Mx. Voice Electron application.

## Build Hooks

### `build-preload.js`

Canonical esbuild configuration for `src/preload/preload-bundle.cjs`. It is
used by both `npm run build:preload` and electron-builder's `beforePack` hook,
so every packaging command rebuilds the ignored generated preload bundle from
the source being packaged. Packaging stops if the preload build fails.

### `afterPack.js`
Runs after the app is packaged but before code signing. Handles macOS code signing for nested binaries.

**Features:**
- Signs nested binaries in macOS app bundles
- Handles hardened runtime and entitlements
- Required for macOS builds to work properly

### `afterPack.js` (Windows Signing)
Signs all Windows executables and DLLs in `win-unpacked` BEFORE the installer is created, ensuring signed files are included in the installer. Uses Windows native signtool.exe with YubiKey smart card certificate.

**Features:**
- Signs ALL Windows executables and DLLs in a single signtool command
- Runs during `afterPack` hook (before installer creation)
- Uses YubiKey smart card certificate for signing
- **Reduces PIN prompts to ONE** by signing all files in one command (YubiKey caches PIN per process)
- Auto-selects certificate or uses specified certificate name/thumbprint
- Ensures signed files are included in the installer

### `signAllWindows.cjs`
Post-build script that signs the installer and uninstaller after they're created. The unpacked files are already signed by `afterPack.js` before the installer is built.

**Features:**
- Signs installer and uninstaller executables
- Runs after electron-builder completes
- Uses YubiKey smart card certificate for signing
- Verifies signatures after signing

**Requirements:**
- Windows SDK with signtool.exe installed (auto-detected from common locations)
- YubiKey with code signing certificate imported into Windows certificate store
- Optional environment variables:
  - `SIGNTOOL_PATH` - Custom path to signtool.exe (if not in standard location)
  - `YUBIKEY_CERT_THUMBPRINT` - Certificate thumbprint (recommended, most reliable)
  - `YUBIKEY_CERT_NAME` - Certificate subject name (alternative to thumbprint)
  - YubiKey PIN will be prompted once for all files

### `publishWindows.cjs`
Publishes signed Windows builds to GitHub releases. Handles uploading the signed installer and associated files after the signing process is complete. Finds or creates the release through `github-release.cjs`, so it adds to a release (draft or published) another platform already made. Re-uploading a file replaces it. Supports `--draft` and `--prerelease` flags.

### `ensureRelease.cjs`
Runs first in the macOS and Linux `release:*` scripts: finds or creates the version's release, with the requested `--draft` / `--prerelease` flags, before electron-builder uploads to it. electron-builder would otherwise create the release itself, and two artifacts finishing together can each create one (4.4.0-beta.1 got two). The scripts also set `EP_GH_IGNORE_TIME=true`, so electron-builder still uploads to a published release more than 2 hours old.

### `github-release.cjs`
One release per tag, whichever platform publishes first and in whichever mode. Lists releases (drafts included; GitHub's get-release-by-tag misses drafts), stops if the tag already has more than one release, and creates a missing release at the exact checked-out commit with `docs/release-notes/v<version>.md` as its notes when that file exists. A draft stays a draft until published on GitHub; a draft publish turns a published release back into a draft.

### `release-target.cjs`
Resolves and validates the full commit SHA at `HEAD` for release creation. Publishing stops if the release commit cannot be determined.

### `win-sign-utils.cjs`
Shared utilities for Windows code signing. Provides `findSigntool()` (signtool.exe path discovery), `buildSignCommand()` (certificate selection and command assembly), and `logCertInfo()` (log which cert method is active). Used by both `afterPack.js` and `signAllWindows.cjs`.

## Release Steps

1. Set the version in `package.json` and write `docs/release-notes/v<version>.md`; it becomes the release body (users see it in Update Available).
2. Publish each platform with the same mode, in any order: `release:mac:draft` / `release:win:draft` (recommended: nobody sees the release until you publish it on GitHub), or the `:prerelease` / plain scripts. Each run adds its files to the one release for the tag; a second run of the same platform replaces its files.
3. For a draft, check the files on GitHub, then publish it (marked as a pre-release for a beta).

## Build Process Flow

1. **electron-builder** packages the app into `win-unpacked/`
2. **`afterPack` hook** signs all files in `win-unpacked/` (main exe, DLLs, etc.) in ONE signtool command
3. **electron-builder** creates installer from the signed files in `win-unpacked/`
4. **Post-build script** (`signAllWindows.cjs`) signs the installer and uninstaller
5. **Final artifacts** are properly signed and ready for distribution

## Configuration

The Windows signing is configured in `package.json`:

```json
"win": {
  "signAndEditExecutable": true
},
"scripts": {
  "build:win": "electron-builder --win && node build/signAllWindows.cjs"
}
```

This approach ensures that:
- Files in `win-unpacked/` are signed BEFORE installer creation (so signed files are included)
- Installer and uninstaller are signed AFTER creation
- Only TWO PIN prompts total (one for unpacked files, one for installer/uninstaller)
- All files are properly signed and verified
- Signed files are included in the installer (not unsigned copies)

## Why This Approach Works

- **Batch signing**: All files signed in one signtool command reduces PIN prompts from 10-12 to 1
- **No file locks**: Post-build script runs after electron-builder finishes creating all artifacts
- **Comprehensive**: Signs main executable, all DLLs, installer, and uninstaller
- **Reliable**: Uses certificate thumbprint for precise certificate selection
- **Simple**: Post-build script approach avoids electron-builder hook limitations
- **Automatic**: Integrated into build scripts so signing happens automatically

## Key Benefits

✅ **No more checksum mismatches** - electron-builder handles this correctly  
✅ **No custom post-processing scripts** - everything is automatic  
✅ **Simpler, more reliable builds** - follows standard practices  
✅ **Easier maintenance** - fewer moving parts to break  
✅ **Standard workflow** - no more workarounds or hacks
