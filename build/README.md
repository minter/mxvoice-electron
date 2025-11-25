# Build Directory

This directory contains build scripts and configuration for the Mx. Voice Electron application.

## Build Hooks

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

### `sslSign.cjs` (Legacy)
Previous signing script that signed files individually. Replaced by `signAllWindows.cjs` to reduce PIN prompts.

### `afterSign.cjs` (Unused)
Attempted to use electron-builder's `afterSign` hook, but it only runs if electron-builder performs signing. Since we disable `signAndEditExecutable`, this hook is skipped.

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
  "signAndEditExecutable": false
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
