# Auto-Update Testing Guide

This guide covers testing the auto-update functionality for both 3.x (custom server) and 4.x (GitHub provider) scenarios.

## Overview

The auto-updater now supports two providers:
- **3.x users**: Custom download server (`download.mxvoice.app`)
- **4.x users**: GitHub provider for multi-architecture support

## Test Scenarios

### 1. Test 3.x Behavior (Custom Server)

**Objective**: Verify that 3.1.5 users still use the custom download server.

**Steps**:
1. Set environment variable: `export TEST_AUTO_UPDATE=true`
2. Start the app: `yarn start`
3. Check the logs for these messages:
   ```
   Using custom server for version 3.1.5
   provider: custom
   server: download.mxvoice.app
   ```
4. Verify the auto-updater hits: `https://download.mxvoice.app/update/darwin/{arch}/3.1.5`

**Expected Behavior**:
- Provider: `custom`
- Server: `download.mxvoice.app`
- URL construction: `https://download.mxvoice.app/update/darwin/x64/3.1.5` (or arm64)

### 2. Test 4.x Behavior (GitHub Provider)

**Objective**: Verify that 4.0.0+ users use the GitHub provider.

**Steps**:
1. Set environment variable: `export TEST_AUTO_UPDATE=true`
2. Start the app: `yarn start`
3. Check the logs for these messages:
   ```
   Using GitHub provider for version 4.0.0
   provider: github
   ```
4. Verify the auto-updater uses GitHub API

**Expected Behavior**:
- Provider: `github`
- Owner: `minter`
- Repo: `mxvoice-electron`
- Automatic architecture detection

### 3. Test Multi-Architecture Support

**Objective**: Verify GitHub provider handles both x86 and arm64 correctly.

**Steps**:
1. Test on x86_64 Mac:
   - Verify it detects x64 architecture
   - Check that it looks for x64 assets
2. Test on arm64 Mac:
   - Verify it detects arm64 architecture
   - Check that it looks for arm64 assets

**Expected Behavior**:
- Correct architecture detection
- Appropriate asset selection
- No manual URL construction needed

### 4. Test Release Notes Display

**Objective**: Verify release notes are displayed correctly via IPC.

**Steps**:
1. Monitor the `display_release_notes` IPC messages
2. Check that release notes are formatted correctly
3. Verify markdown rendering works

**Expected Behavior**:
- IPC message sent to renderer
- Release notes properly formatted
- Markdown rendered correctly

### 5. Test Pre-release Update Logic

**Objective**: Verify pre-release update logic works correctly.

**Steps**:
1. Test with user preference enabled (should allow pre-releases)
2. Test with user preference disabled but running pre-release (should allow pre-releases)
3. Test with user preference disabled and running stable (should not allow pre-releases)
4. Verify logs show correct logic breakdown

**Expected Behavior**:
- Users get pre-releases if they opt-in OR if currently running pre-release
- Logs show `prereleaseEnabled`, `userPreference`, `isCurrentlyPrerelease`, and `currentVersion`
- Auto-updater `allowPrerelease` is set correctly

## Testing Commands

### Basic Testing
```bash
# Test auto-update scenarios
export TEST_AUTO_UPDATE=true
yarn start
```

### Comprehensive Testing
```bash
# Test both scenarios
export TEST_AUTO_UPDATE=true
export TEST_V3_1_5=true
export TEST_V4_0_0=true
yarn start
```

## Monitoring and Validation

### Log Locations
- **Main process**: `~/Library/Logs/mxvoice-electron/main.log`
- **Renderer**: DevTools Console
- **Network**: DevTools Network tab

### Key Log Messages to Look For

#### 3.x (Custom Server)
```
Using custom server for version 3.1.5
provider: custom
server: download.mxvoice.app
```

#### 4.x (GitHub Provider)
```
Using GitHub provider for version 4.0.0
provider: github
```

#### Pre-release Update Logic
```
Prerelease updates enabled
prereleaseEnabled: true
userPreference: false
isCurrentlyPrerelease: true
currentVersion: 4.0.0-pre.4
```

**Pre-release Logic**: Users receive pre-release updates if:
- They explicitly opt-in via Preferences → Update Options, OR
- They are currently running a pre-release version (e.g., 4.0.0-pre.4)

#### Auto-Updater Events
```
Checking for updates...
Update available: [version]
No updates available
```

### Network Requests to Monitor

#### 3.x Users
- `https://download.mxvoice.app/update/darwin/{arch}/{version}`

#### 4.x Users
- GitHub API calls for releases
- Asset download URLs

## Troubleshooting

### Common Issues

1. **Provider not switching correctly**
   - Check version string format
   - Verify environment variables
   - Check debug logs

2. **Update check failing**
   - Verify network connectivity
   - Check GitHub API rate limits
   - Verify custom server accessibility

3. **Release notes not displaying**
   - Check IPC message flow
   - Verify renderer event listeners
   - Check markdown formatting

### Debug Steps

1. Enable debug logging: `export TEST_AUTO_UPDATE=true`
2. Check main process logs
3. Monitor DevTools console
4. Verify network requests
5. Test with different versions

## Cleanup

After testing, remember to:
1. Remove or comment out test environment variables
2. Clean up any temporary test configurations
3. Verify production behavior is correct

## Future Testing

As you add more features:
1. Test new architecture support
2. Verify GitHub release workflow
3. Test update installation process
4. Validate rollback scenarios
