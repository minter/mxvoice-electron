# Windows Code Signing Configuration

This document describes the complete Windows code signing setup for the Mx. Voice Electron application using YubiKey with Windows native signtool.exe.

## Overview

The Windows builds use a two-phase signing approach that ensures all files are properly signed:
1. **Pre-installer signing**: Files in `win-unpacked/` are signed before the installer is created
2. **Post-installer signing**: The installer and uninstaller are signed after creation

This approach ensures that signed files are included in the installer, and all artifacts are properly signed for publisher trust and Windows Defender compatibility.

## Architecture

### Signing Method
- **Tool**: Windows native `signtool.exe` (from Windows SDK)
- **Certificate**: YubiKey smart card certificate stored in Windows certificate store
- **Integration**: `afterPack` hook for unpacked files, post-build script for installer

### Build Hooks
- **`afterPack.js`**: Signs all files in `win-unpacked/` before installer creation
- **`signAllWindows.cjs`**: Signs installer and uninstaller after creation

## Configuration

### Package.json Configuration

```json
"build": {
  "afterPack": "build/afterPack.js",
  "win": {
    "icon": "src/assets/icons/mxvoice.ico",
    "artifactName": "Mx. Voice Setup ${version}.${ext}",
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "verifyUpdateCodeSignature": false,
    "signAndEditExecutable": false
  }
},
"scripts": {
  "build:win": "electron-builder --win && node build/signAllWindows.cjs"
}
```

### Key Configuration Options

- **`signAndEditExecutable: false`**: Disabled to prevent electron-builder from signing (we handle it ourselves)
- **`afterPack`**: Hook that signs unpacked files before installer creation
- **Post-build script**: Signs installer/uninstaller after creation

## Environment Variables

### Optional Variables

| Variable | Description | Example | When to Use |
|----------|-------------|---------|-------------|
| `SIGNTOOL_PATH` | Custom path to signtool.exe | `C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe` | If signtool not in standard location |
| `YUBIKEY_CERT_THUMBPRINT` | Certificate thumbprint (SHA1) | `EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9` | **Recommended** - most reliable |
| `YUBIKEY_CERT_NAME` | Certificate subject name | `CN=Your Name, O=Your Org` | Alternative to thumbprint |

### Setting Environment Variables

**PowerShell (Temporary - Session Only):**
```powershell
# Recommended: Use thumbprint for precise certificate selection
$env:YUBIKEY_CERT_THUMBPRINT="EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9"

# Alternative: Use certificate name
$env:YUBIKEY_CERT_NAME="Your Certificate Name"

# Optional: Custom signtool path
$env:SIGNTOOL_PATH="C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
```

**PowerShell (Permanent - User Level):**
```powershell
[Environment]::SetEnvironmentVariable("YUBIKEY_CERT_THUMBPRINT", "EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9", "User")
```

**Command Prompt (Temporary - Session Only):**
```cmd
set YUBIKEY_CERT_THUMBPRINT=EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9
```

**Command Prompt (Permanent - System Level):**
```cmd
setx YUBIKEY_CERT_THUMBPRINT "EDE7C77FF916B935C83E7EF7A6BC125A3BDB79D9"
```

### Finding Your Certificate Thumbprint

```powershell
Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -like "*Your Name*" } | Select Thumbprint, Subject
```

## Signing Process

### Build Command
```bash
yarn build:win
```

### Process Flow

1. **electron-builder** packages the app into `win-unpacked/`
2. **`afterPack` hook** signs all files in `win-unpacked/` in ONE signtool command
   - Main executable (`Mx. Voice.exe`)
   - All DLLs (Chrome, Electron, native dependencies)
   - Helper executables (e.g., `elevate.exe`)
   - **PIN prompt #1** (for all unpacked files)
3. **electron-builder** creates installer from the signed files in `win-unpacked/`
4. **Post-build script** (`signAllWindows.cjs`) signs installer and uninstaller
   - Installer (`Mx. Voice Setup X.X.X.exe`)
   - Uninstaller (`__uninstaller-nsis-mxvoice.exe`)
   - **PIN prompt #2** (for installer/uninstaller)
5. **Final artifacts** are properly signed and ready for distribution

### Why Two-Phase Signing?

- **Files in installer must be signed BEFORE installer creation**: If we sign after, the installer contains unsigned files
- **Batch signing reduces PIN prompts**: Instead of 10-12 individual prompts, we get just 2 (one per batch)
- **YubiKey PIN caching**: PIN is cached per signtool process, so all files in one command = one prompt

## Build Artifacts

### Generated Files
- **Installer**: `Mx. Voice Setup 4.1.1-pre.3.exe`
- **Blockmap**: `Mx. Voice Setup 4.1.1-pre.3.exe.blockmap`
- **Update Config**: `latest.yml`
- **Unpacked App**: `win-unpacked/` directory

### Signing Coverage
- ✅ **Main executable**: `Mx. Voice.exe` (signed before installer creation)
- ✅ **All DLLs**: Chrome, Electron, and native dependencies (signed before installer creation)
- ✅ **Installer**: `Mx. Voice Setup X.X.X.exe` (signed after creation)
- ✅ **Uninstaller**: `__uninstaller-nsis-mxvoice.exe` (signed after creation)
- ✅ **Helper executables**: `elevate.exe` and others (signed before installer creation)

## Verification

### Verify Installer Signature

**Using Windows Explorer:**
1. Right-click the installer in `dist/`
2. Select **Properties** > **Digital Signatures**
3. Select the signature and click **Details** to view certificate info

**Using signtool.exe:**
```powershell
signtool verify /pa "dist\Mx. Voice Setup 4.1.1-pre.3.exe"
```

Expected output: `Successfully verified`

### Verify Files Inside Installer

**Extract and verify:**
```powershell
# Extract installer
$tempDir = "$env:TEMP\mxvoice-verify"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Start-Process -FilePath "dist\Mx. Voice Setup 4.1.1-pre.3.exe" -ArgumentList "/S", "/D=$tempDir" -Wait

# Verify main executable
signtool verify /pa "$tempDir\Mx. Voice.exe"

# Verify DLLs
Get-ChildItem -Path $tempDir -Recurse -Filter "*.dll" | ForEach-Object {
    Write-Host "Checking: $($_.Name)"
    signtool verify /pa $_.FullName
}

# Cleanup
Remove-Item -Path $tempDir -Recurse -Force
```

### Verify Unpacked Files

```powershell
# Main executable
signtool verify /pa "dist\win-unpacked\Mx. Voice.exe"

# Sample DLL
signtool verify /pa "dist\win-unpacked\d3dcompiler_47.dll"
```

## Troubleshooting

### Common Issues

**signtool.exe not found:**
```
[afterPack] signtool.exe not found, skipping Windows signing
```
**Solution**: Install Windows SDK or set `SIGNTOOL_PATH` environment variable.

**Certificate not found:**
```
SignTool Error: No certificates were found that met all the given criteria.
```
**Solution**: 
- Ensure YubiKey is inserted
- Verify certificate is in Windows certificate store: `Get-ChildItem Cert:\CurrentUser\My`
- Set `YUBIKEY_CERT_THUMBPRINT` with correct thumbprint
- Or set `YUBIKEY_CERT_NAME` with exact certificate subject name

**PIN prompt for every file:**
**Solution**: This shouldn't happen with batch signing. If it does, check that:
- All files are being signed in one signtool command (check build output)
- YubiKey PIN policy allows caching (check with `ykman piv keys info 9a`)

**Files in installer are unsigned:**
**Solution**: This means `afterPack` hook didn't run or failed. Check:
- Build output for `[afterPack]` messages
- That `afterPack.js` includes Windows signing code
- That `signAndEditExecutable: false` is set

### Debugging

**Enable verbose output:**
The signing scripts output detailed information about:
- Files found to sign
- signtool path used
- Certificate selection method
- Signing results
- Verification results

**Check build output for:**
- `[afterPack] Found X Windows files to sign before installer creation`
- `[afterPack] ✅ Successfully signed X Windows files!`
- `[signAllWindows] Found X files to sign`
- `[signAllWindows] ✅ Successfully signed X files!`

## Security Considerations

### Certificate Storage
- **YubiKey**: Certificate private key never leaves the YubiKey hardware
- **Windows Certificate Store**: Only the public certificate is stored in Windows
- **No Certificate Files**: No `.p12`, `.pfx`, or other certificate files in repository

### PIN Management
- **PIN Prompting**: YubiKey PIN is prompted during signing (not stored)
- **PIN Caching**: PIN is cached per signtool process (one prompt per batch)
- **Security**: PIN is never stored or logged

### Build Security
- **Automatic Signing**: All Windows artifacts are automatically signed
- **Comprehensive Coverage**: Main executable, installer, uninstaller, and all DLLs are signed
- **Publisher Trust**: Signed artifacts establish publisher identity for Windows Defender and SmartScreen

## Release Process

### Prerelease Builds
```bash
yarn release:win:prerelease
```

### Stable Releases
```bash
yarn release:win
```

### Draft Releases
```bash
yarn release:win:draft
```

All release commands automatically handle signing and publishing to GitHub.

## Benefits of This Configuration

✅ **Minimal PIN prompts** - Only 2 prompts total (down from 10-12)  
✅ **Signed files in installer** - Files inside installer are properly signed  
✅ **Batch signing** - All files signed in single commands for efficiency  
✅ **No file locking issues** - Signing happens at the right time in the build process  
✅ **Comprehensive coverage** - All Windows artifacts are properly signed  
✅ **Hardware security** - Private key never leaves YubiKey hardware  
✅ **Automatic checksums** - electron-builder calculates correct checksums automatically  
✅ **Standard workflow** - Uses standard electron-builder hooks and processes  

## Replicating This Configuration in Another App

### Prerequisites

1. **YubiKey Setup**
   - YubiKey with code signing certificate installed
   - Certificate imported into Windows certificate store
   - Certificate thumbprint noted

2. **Windows SDK**
   - Windows SDK installed (includes signtool.exe)
   - signtool.exe accessible (in PATH or set `SIGNTOOL_PATH`)

### Step-by-Step Setup

#### 1. Copy Required Files

**Copy these files from this project:**
```
build/afterPack.js → your-project/build/afterPack.js (add Windows signing code)
build/signAllWindows.cjs → your-project/build/signAllWindows.cjs
```

#### 2. Configure package.json

Add the following to your `package.json`:

```json
{
  "build": {
    "afterPack": "build/afterPack.js",
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "signAndEditExecutable": false
    }
  },
  "scripts": {
    "build:win": "electron-builder --win && node build/signAllWindows.cjs"
  }
}
```

#### 3. Update afterPack.js

Add Windows signing code to your `afterPack.js` (see this project's `build/afterPack.js` for the implementation).

#### 4. Set Environment Variables

```powershell
$env:YUBIKEY_CERT_THUMBPRINT="YOUR_CERTIFICATE_THUMBPRINT"
```

#### 5. Test the Configuration

```bash
# Test build (local only)
yarn build:win

# Verify signatures
signtool verify /pa "dist\YourApp Setup X.X.X.exe"
```

### File Structure for New Project

```
your-project/
├── build/
│   ├── afterPack.js          # With Windows signing code
│   └── signAllWindows.cjs    # Post-build signing script
├── package.json              # With win.build configuration
└── ...
```

## Additional Resources

- [YubiKey PIV Documentation](https://developers.yubico.com/PIV/)
- [Windows signtool.exe Documentation](https://learn.microsoft.com/windows/win32/seccrypto/signtool)
- [Electron Builder Windows Configuration](https://www.electron.build/configuration/win)
