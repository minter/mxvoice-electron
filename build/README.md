# Build Directory

This directory contains build scripts and configuration for the Mx. Voice Electron application.

## Build Hooks

### `afterPack.js`
Runs after the app is packaged but before code signing. Handles macOS code signing for nested binaries.

**Features:**
- Signs nested binaries in macOS app bundles
- Handles hardened runtime and entitlements
- Required for macOS builds to work properly

### `sslSign.cjs`
Custom signing script for Windows artifacts using Windows native signtool.exe with YubiKey smart card certificate. Configured via electron-builder's `signtoolOptions`.

**Features:**
- Signs Windows executables using native signtool.exe
- Uses YubiKey smart card certificate for signing
- Minimizes PIN entries by caching PIN for the session (`/sm` flag)
- Auto-selects certificate or uses specified certificate name
- Logs pre and post-signing file information
- Works seamlessly with electron-builder's built-in signing process

**Requirements:**
- Windows SDK with signtool.exe installed (auto-detected from common locations)
- YubiKey with code signing certificate imported
- Optional environment variables:
  - `SIGNTOOL_PATH` - Custom path to signtool.exe (if not in standard location)
  - `YUBIKEY_CERT_NAME` - Specific certificate name to use (optional, auto-selects if not provided)
  - `YUBIKEY_PIN` - YubiKey PIN (optional, will prompt if not set - cached for session)

## Build Process Flow

1. **electron-builder** creates artifacts (installer, blockmap, latest.yml)
2. **Custom signing script** (`sslSign.cjs`) signs the main app executables via `signtoolOptions`
3. **electron-builder** handles all additional signing automatically with `signAndEditExecutable: true`
4. **Final artifacts** have correct checksums automatically calculated by electron-builder

## Configuration

The Windows signing is configured in `package.json`:

```json
"win": {
  "signtoolOptions": {
    "sign": "build/sslSign.cjs"
  },
  "signAndEditExecutable": true
}
```

This approach ensures that:
- Main app executables are signed during the build process via `signtoolOptions`
- All additional Windows artifacts are automatically signed via `signAndEditExecutable: true`
- Checksums are calculated correctly from the start
- No post-processing or workarounds are needed

## Why This Approach Works

- **Uses standard electron-builder Windows signing** with `signAndEditExecutable: true`
- **Leverages SSL.com integration** without overcomplicating the process
- **Ensures checksums are correct** from the start
- **Follows electron-builder best practices** instead of workarounds
- **Eliminates timing issues** that caused previous checksum mismatches

## Key Benefits

✅ **No more checksum mismatches** - electron-builder handles this correctly  
✅ **No custom post-processing scripts** - everything is automatic  
✅ **Simpler, more reliable builds** - follows standard practices  
✅ **Easier maintenance** - fewer moving parts to break  
✅ **Standard workflow** - no more workarounds or hacks
