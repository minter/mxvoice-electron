# Build Directory

This directory contains build scripts and configuration for the Mx. Voice Electron application.

## Build Hooks

### `afterPack.js`
Runs after the app is packaged but before code signing. Handles any post-packaging tasks.

### `sslSign.js`
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
2. **Custom signing script** (`sslSign.js`) signs the Windows artifacts via `signtoolOptions`
3. **electron-builder** creates `latest.yml` with the correct post-signing checksums
4. **electron-builder** publishes the artifacts with matching checksums

## Configuration

The Windows signing is configured in `package.json`:

```json
"win": {
  "signtoolOptions": {
    "sign": "build/sslSign.js"
  }
}
```

This tells electron-builder to use our custom signing script instead of the default Windows signing tools.

## Why This Approach Is Better

- **No timing issues** - electron-builder handles the sequence correctly
- **No checksum mismatches** - it creates `latest.yml` with the signed file checksums
- **Simpler configuration** - just set the right options in `package.json`
- **More reliable** - we're using the tool as designed, not fighting it
- **Cleaner code** - no complex hooks or workarounds needed

## Troubleshooting

### Checksum Mismatch
If you see checksum mismatches between the uploaded file and `latest.yml`:

1. Check that the SSL.com environment variables are set correctly
2. Verify the signing process completed without errors
3. Check the build logs for any signing failures
4. Ensure the SSL.com CodeSignTool is properly installed

### Environment Variables

For Windows signing to work, set these environment variables:

```bash
SSL_USERNAME=your_ssl_username
SSL_CREDENTIAL_ID=your_credential_id
SSL_PASSWORD=your_ssl_password
SSL_TOTP_SECRET=your_totp_secret_base64
```

## Code Signing Tools

The Windows signing process requires:
- Java Runtime Environment (JRE)
- SSL.com CodeSignTool installed at `C:\tools\CodeSignTool`
- Valid SSL.com code signing credentials
