# Build Directory

This directory contains build scripts and configuration for the Mx. Voice Electron application.

## Build Hooks

### `afterPack.js`
Runs after the app is packaged but before code signing. Handles any post-packaging tasks.

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

### `winSignInstaller.cjs`
Post-installer signing script that runs after the NSIS installer is created. This script:
1. Signs the final installer using SSL.com CodeSignTool
2. Regenerates the `latest.yml` file with correct checksums to fix SHA512 mismatches

## Build Process Flow

1. **electron-builder** creates artifacts (installer, blockmap, latest.yml) with unsigned installer
2. **Custom signing script** (`sslSign.cjs`) signs the main app executables via `signtoolOptions`
3. **`artifactBuildCompleted`** hook runs and signs the installer
4. **Checksum regeneration** updates `latest.yml` with correct post-signing checksums
5. **Final artifacts** have matching checksums for auto-updates

## Configuration

The Windows signing is configured in `package.json`:

```json
"win": {
  "signtoolOptions": {
    "sign": "build/sslSign.cjs"
  }
},
"artifactBuildCompleted": "build/winSignInstaller.cjs"
```

This approach ensures that:
- Main app executables are signed during the build process
- The installer is signed after creation
- `latest.yml` is updated with correct checksums
- No checksum mismatches occur

## Why This Approach Works

- **Fixes timing issues** - We sign the installer after it's created
- **Corrects checksum mismatches** - We regenerate `latest.yml` with the right hashes
- **Maintains compatibility** - Uses standard electron-builder hooks
- **Reliable auto-updates** - Users get correct checksums for verification

## Troubleshooting

### Checksum Mismatch
If you see checksum mismatches between the uploaded file and `latest.yml`:

1. Check that the SSL.com environment variables are set correctly
2. Verify that the CodeSignTool is installed at `C:\tools\CodeSignTool`
3. Ensure the signing script is working by checking the build logs
4. The `artifactBuildCompleted` hook should run and regenerate `latest.yml`

### Build Hook Order
The correct build hook order for Windows is:
1. `afterPack` - Post-packaging tasks
2. `afterSign` - Post-signing tasks for app files
3. `artifactBuildCompleted` - Signs installer and fixes checksums
4. `latest.yml` is updated with correct post-signing checksums
