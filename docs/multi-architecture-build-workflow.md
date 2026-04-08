# Build and Release Workflow

This document explains how to build and release Mx. Voice for macOS (Universal) and Windows.

## macOS Universal Builds

Mx. Voice creates "Universal" builds that run natively on both Intel (x64) and Apple Silicon (ARM64) Macs. This is handled in a single build pass using `electron-builder`.

### Local build (macOS)

Universal builds are currently performed manually on a macOS development machine.

```bash
# Build the universal DMG and Zip locally
npm run build:mac:universal
```

### Release to GitHub (macOS)

To build and publish a release directly to GitHub:

```bash
# Stable release
npm run release:mac

# Prerelease (beta/alpha)
npm run release:mac:prerelease

# Draft release
npm run release:mac:draft
```

The release scripts automatically:

1. Build for both architectures.
2. Create a universal binary.
3. Package as DMG and Zip.
4. Sign and notarize (requires valid Apple Developer certificates).
5. Upload artifacts to the specified GitHub release.

---

## Windows Builds

Windows builds include a two-phase signing process to ensure all components (executables and DLLs) are properly signed using a YubiKey.

### Local build (Windows)

```bash
# Build and sign the Windows installer
npm run build:win
```

### Release to GitHub (Windows)

```bash
# Stable release
npm run release:win

# Prerelease
npm run release:win:prerelease

# Draft release
npm run release:win:draft
```

The Windows release process:

1. Packages the app into `win-unpacked`.
2. Signs all unpacked files (batch process via `afterPack.js`).
3. Creates the NSIS installer.
4. Signs the installer and uninstaller via `signAllWindows.cjs`.
5. Uploads to GitHub via `publishWindows.cjs`.

---

## Prerequisites

### macOS

- Xcode Command Line Tools.
- Valid Apple Developer ID Application & Installer certificates in your Keychain.
- `APPLE_ID` and `APPLE_PASSWORD` (app-specific password) environment variables for notarization.

### Windows

- Windows SDK (specifically `signtool.exe`).
- YubiKey with a valid Code Signing certificate.
- See `docs/windows-code-signing-configuration.md` for detailed setup and environment variable configuration.
