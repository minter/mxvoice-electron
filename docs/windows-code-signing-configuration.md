# Windows Code Signing Configuration

This document describes the complete Windows code signing setup for the Mx. Voice Electron application using SSL.com's CodeSignTool.

## Overview

The Windows builds use a hybrid approach combining electron-builder's built-in signing capabilities with SSL.com's CodeSignTool for comprehensive code signing coverage. This ensures all Windows artifacts are properly signed for publisher trust and Windows Defender compatibility.

## Architecture

### Signing Provider
- **SSL.com CodeSignTool**: Professional code signing service
- **Tool Version**: 1.3.2 (Java-based)
- **Installation Path**: `C:\tools\CodeSignTool\jar\code_sign_tool-1.3.2.jar`

### Integration Method
- **Custom Signing Script**: `build/sslSign.cjs`
- **electron-builder Integration**: Via `signtoolOptions` configuration
- **Automatic Signing**: Combined with `signAndEditExecutable: true`

## Configuration

### Package.json Configuration

```json
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
  "signAndEditExecutable": true,
  "signtoolOptions": {
    "sign": "build/sslSign.cjs"
  }
}
```

### Key Configuration Options

- **`signAndEditExecutable: true`**: Enables automatic signing of all Windows executables and DLLs
- **`signtoolOptions.sign`**: Points to custom signing script for main app executables
- **`verifyUpdateCodeSignature: false`**: Disables update signature verification (handled separately)
- **`artifactName`**: Uses "Mx. Voice Setup" format for installer naming

## Environment Variables

The signing process requires four environment variables to be set before building:

### Required Variables

| Variable | Description | Example | How to Obtain |
|----------|-------------|---------|---------------|
| `SSL_USERNAME` | SSL.com RA username | `your_username` | SSL.com account login |
| `SSL_CREDENTIAL_ID` | SSL.com credential ID | `your_credential_id` | SSL.com certificate management |
| `SSL_PASSWORD` | SSL.com RA password | `your_password` | SSL.com account password |
| `SSL_TOTP_SECRET` | Base64-encoded TOTP secret for automated OTP | `your_base64_totp_secret` | SSL.com 2FA setup |

### Setting Environment Variables

**PowerShell (Temporary - Session Only):**
```powershell
$env:SSL_USERNAME="your_username"
$env:SSL_CREDENTIAL_ID="your_credential_id"
$env:SSL_PASSWORD="your_password"
$env:SSL_TOTP_SECRET="your_base64_totp_secret"
```

**PowerShell (Permanent - User Level):**
```powershell
[Environment]::SetEnvironmentVariable("SSL_USERNAME", "your_username", "User")
[Environment]::SetEnvironmentVariable("SSL_CREDENTIAL_ID", "your_credential_id", "User")
[Environment]::SetEnvironmentVariable("SSL_PASSWORD", "your_password", "User")
[Environment]::SetEnvironmentVariable("SSL_TOTP_SECRET", "your_base64_totp_secret", "User")
```

**Command Prompt (Temporary - Session Only):**
```cmd
set SSL_USERNAME=your_username
set SSL_CREDENTIAL_ID=your_credential_id
set SSL_PASSWORD=your_password
set SSL_TOTP_SECRET=your_base64_totp_secret
```

**Command Prompt (Permanent - System Level):**
```cmd
setx SSL_USERNAME "your_username"
setx SSL_CREDENTIAL_ID "your_credential_id"
setx SSL_PASSWORD "your_password"
setx SSL_TOTP_SECRET "your_base64_totp_secret"
```

**Environment File (.env) - For CI/CD:**
```bash
SSL_USERNAME=your_username
SSL_CREDENTIAL_ID=your_credential_id
SSL_PASSWORD=your_password
SSL_TOTP_SECRET=your_base64_totp_secret
```

## Signing Process

### Build Command
```bash
yarn build:win
```

### Process Flow

1. **electron-builder** creates Windows artifacts (installer, blockmap, latest.yml)
2. **Custom signing script** (`sslSign.cjs`) signs main app executables via `signtoolOptions`
3. **electron-builder** automatically signs all additional Windows artifacts with `signAndEditExecutable: true`
4. **Final artifacts** have correct checksums automatically calculated by electron-builder

### Signing Script Details

The `build/sslSign.cjs` script:

- **Validates environment variables** before attempting to sign
- **Logs pre-signing file information** (size, SHA512 hash)
- **Executes SSL.com CodeSignTool** with proper authentication
- **Logs post-signing file information** for verification
- **Handles errors gracefully** with detailed error messages
- **Uses 2-minute timeout** for signing operations

### SSL.com CodeSignTool Command

The script generates the following command structure:
```bash
java -jar "C:\tools\CodeSignTool\jar\code_sign_tool-1.3.2.jar" sign \
  -username="SSL_USERNAME" \
  -credential_id="SSL_CREDENTIAL_ID" \
  -password="SSL_PASSWORD" \
  -totp_secret="SSL_TOTP_SECRET" \
  -input_file_path="FILE_TO_SIGN" \
  -override
```

## Build Artifacts

### Generated Files
- **Installer**: `Mx. Voice Setup 4.0.1-pre.1.exe`
- **Blockmap**: `Mx. Voice Setup 4.0.1-pre.1.exe.blockmap`
- **Update Config**: `latest.yml`
- **Unpacked App**: `win-unpacked/` directory

### Signing Coverage
- **Main executable**: `Mx. Voice.exe`
- **Installer**: `Mx. Voice Setup X.X.X.exe`
- **All DLLs**: Chrome, Electron, and native dependencies
- **Resources**: Signed as part of the installer process

## Verification

### Windows Explorer
1. Right-click the installer in `dist/`
2. Select **Properties** > **Digital Signatures**
3. Select the signature and click **Details** to view certificate info

### Command Line (signtool.exe)
```powershell
signtool verify /pa "C:\Users\wade\mxvoice-electron\dist\Mx. Voice Setup 4.0.1-pre.1.exe"
```

Expected output: `Successfully verified`

## Troubleshooting

### Common Issues

**Missing Environment Variables:**
```
[win.sign] Missing SSL.com env: SSL_USERNAME, SSL_CREDENTIAL_ID, SSL_PASSWORD, SSL_TOTP_SECRET
```
**Solution**: Set all required environment variables before building.

**CodeSignTool Not Found:**
```
[win.sign] CodeSignTool not found at C:\tools\CodeSignTool\jar\code_sign_tool-1.3.2.jar
```
**Solution**: Install SSL.com CodeSignTool at the specified path.

**Configuration File Missing:**
```
java.io.FileNotFoundException: .\conf\code_sign_tool.properties
```
**Solution**: This error appears in logs but doesn't affect signing when using command-line parameters.

### Log Files
- **Main Log**: `logs/code_signing_tool.log`
- **Date-specific Log**: `logs/code_signing_tool-YYYY-MM-DD.log`

## Security Considerations

### Credential Management
- **Environment Variables**: Credentials are passed via environment variables (not stored in files)
- **TOTP Integration**: Automated 2FA using base64-encoded TOTP secret
- **No Certificate Files**: No `.p12` or `.pfx` files stored in the repository

### Build Security
- **Automatic Signing**: All Windows artifacts are automatically signed
- **Comprehensive Coverage**: Main executable, installer, and all DLLs are signed
- **Publisher Trust**: Signed artifacts establish publisher identity for Windows Defender

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

✅ **No checksum mismatches** - electron-builder handles this correctly  
✅ **No custom post-processing scripts** - everything is automatic  
✅ **Simpler, more reliable builds** - follows standard practices  
✅ **Easier maintenance** - fewer moving parts to break  
✅ **Standard workflow** - no more workarounds or hacks  
✅ **Comprehensive signing** - all Windows artifacts are properly signed  
✅ **Professional certificates** - SSL.com provides trusted code signing certificates  
✅ **Automated 2FA** - TOTP integration eliminates manual authentication steps  

## Replicating This Configuration in Another App

### Prerequisites

1. **SSL.com Account Setup**
   - Create account at [SSL.com](https://ssl.com)
   - Purchase code signing certificate
   - Enable 2FA and obtain TOTP secret
   - Note your credential ID from the certificate management panel

2. **SSL.com CodeSignTool Installation**
   - Download CodeSignTool from SSL.com
   - Install to: `C:\tools\CodeSignTool\`
   - Verify JAR file exists at: `C:\tools\CodeSignTool\jar\code_sign_tool-1.3.2.jar`

### Step-by-Step Setup

#### 1. Copy Required Files

**Copy these files from this project:**
```
build/sslSign.cjs → your-project/build/sslSign.cjs
```

#### 2. Install Dependencies

```bash
npm install electron-builder
# or
yarn add electron-builder
```

#### 3. Configure package.json

Add the following to your `package.json`:

```json
{
  "build": {
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "verifyUpdateCodeSignature": false,
      "signAndEditExecutable": true,
      "signtoolOptions": {
        "sign": "build/sslSign.cjs"
      }
    }
  },
  "scripts": {
    "build:win": "electron-builder --win",
    "release:win": "electron-builder --win --publish always"
  }
}
```

#### 4. Set Environment Variables

Choose one of the methods from the Environment Variables section above.

#### 5. Test the Configuration

```bash
# Test build (local only)
npm run build:win

# Test release (with publishing)
npm run release:win
```

### File Structure for New Project

```
your-project/
├── build/
│   └── sslSign.cjs          # Custom signing script
├── package.json             # With win.build configuration
├── dist/                    # Build output directory
└── logs/                    # SSL.com signing logs (auto-created)
```

### Customizing for Your App

#### Update sslSign.cjs

**Change the tool path if needed:**
```javascript
// Line 38-39: Update if you installed CodeSignTool elsewhere
const toolDir = "C:\\tools\\CodeSignTool";
const jarPath = path.join(toolDir, "jar", "code_sign_tool-1.3.2.jar");
```

**Update timeout if needed:**
```javascript
// Line 66: Increase timeout for larger files
timeout: 120000 // 2 minutes (increase as needed)
```

#### Update package.json Configuration

**Customize artifact naming:**
```json
"win": {
  "artifactName": "Your App Setup ${version}.${ext}",
  "icon": "assets/your-app-icon.ico"
}
```

**Add additional targets:**
```json
"target": [
  {
    "target": "nsis",
    "arch": ["x64"]
  },
  {
    "target": "portable",
    "arch": ["x64"]
  }
]
```

### SSL.com Specific Configuration

#### Obtaining Your Credentials

1. **SSL_USERNAME**: Your SSL.com account username
2. **SSL_CREDENTIAL_ID**: Found in SSL.com dashboard under "Certificates" → "Code Signing"
3. **SSL_PASSWORD**: Your SSL.com account password
4. **SSL_TOTP_SECRET**: 
   - Enable 2FA in SSL.com account settings
   - Use a TOTP app (Google Authenticator, Authy, etc.)
   - Get the base64-encoded secret from your TOTP app
   - Or use: `openssl rand -base64 32` (for testing)

#### CodeSignTool Paths

**Default Installation Paths:**
- Windows: `C:\tools\CodeSignTool\`
- JAR File: `C:\tools\CodeSignTool\jar\code_sign_tool-1.3.2.jar`
- Config: `C:\tools\CodeSignTool\conf\code_sign_tool.properties` (optional)

**Alternative Paths:**
If you install elsewhere, update line 38-39 in `sslSign.cjs`:
```javascript
const toolDir = "C:\\Your\\Custom\\Path\\CodeSignTool";
```

### CI/CD Integration

#### GitHub Actions Example

```yaml
name: Build and Sign Windows
on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Set SSL.com environment variables
        env:
          SSL_USERNAME: ${{ secrets.SSL_USERNAME }}
          SSL_CREDENTIAL_ID: ${{ secrets.SSL_CREDENTIAL_ID }}
          SSL_PASSWORD: ${{ secrets.SSL_PASSWORD }}
          SSL_TOTP_SECRET: ${{ secrets.SSL_TOTP_SECRET }}
        run: |
          echo "SSL_USERNAME=$env:SSL_USERNAME" >> $env:GITHUB_ENV
          echo "SSL_CREDENTIAL_ID=$env:SSL_CREDENTIAL_ID" >> $env:GITHUB_ENV
          echo "SSL_PASSWORD=$env:SSL_PASSWORD" >> $env:GITHUB_ENV
          echo "SSL_TOTP_SECRET=$env:SSL_TOTP_SECRET" >> $env:GITHUB_ENV
          
      - name: Download SSL.com CodeSignTool
        run: |
          # Download and extract CodeSignTool to C:\tools\CodeSignTool
          # (Implementation depends on SSL.com download method)
          
      - name: Build and sign Windows app
        run: npm run build:win
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: windows-build
          path: dist/
```

#### Required GitHub Secrets

Add these secrets to your GitHub repository:
- `SSL_USERNAME`
- `SSL_CREDENTIAL_ID` 
- `SSL_PASSWORD`
- `SSL_TOTP_SECRET`

### Troubleshooting Setup Issues

#### SSL.com CodeSignTool Not Found
```bash
# Verify installation
dir "C:\tools\CodeSignTool\jar\code_sign_tool-1.3.2.jar"

# If not found, reinstall or update path in sslSign.cjs
```

#### Environment Variables Not Set
```bash
# Check variables are set
echo $env:SSL_USERNAME
echo $env:SSL_CREDENTIAL_ID
echo $env:SSL_PASSWORD
echo $env:SSL_TOTP_SECRET
```

#### Java Not Found
```bash
# Verify Java is installed
java -version

# If not installed, install OpenJDK or Oracle JDK
```

#### Permission Issues
- Run build commands as Administrator if needed
- Ensure SSL.com credentials have proper permissions
- Check Windows Defender exclusions for build directories

### Validation Checklist

Before using in production:

- [ ] SSL.com CodeSignTool installed and accessible
- [ ] All environment variables set correctly
- [ ] `sslSign.cjs` copied and paths updated
- [ ] `package.json` win.build configuration added
- [ ] Test build completes successfully
- [ ] Generated installer has valid digital signature
- [ ] Windows Defender doesn't flag the signed executable
- [ ] CI/CD pipeline (if used) has all required secrets

## Related Documentation

- [Build Directory README](../build/README.md) - Detailed build process documentation
- [Main README](../README.md) - General project documentation
- [Auto-Update Testing Guide](auto-update-testing-guide.md) - Testing signed updates
