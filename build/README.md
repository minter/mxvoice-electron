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
Custom signing script for Windows artifacts using SSL.com CodeSignTool. Configured via electron-builder's `signtoolOptions`.

**Features:**
- Signs Windows executables using SSL.com CodeSignTool
- Generates TOTP codes for authentication
- Logs pre and post-signing file information
- Works seamlessly with electron-builder's built-in signing process

**Requirements:**
- SSL.com CodeSignTool installed at `C:\tools\CodeSignTool`
- Environment variables:
  - `SSL_USERNAME`
  - `SSL_CREDENTIAL_ID`
  - `SSL_PASSWORD`
  - `SSL_TOTP_SECRET`

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
