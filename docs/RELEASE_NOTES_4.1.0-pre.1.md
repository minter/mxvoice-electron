# What's New in Mx. Voice 4.1.0-pre.1

**Mx. Voice 4.1.0-pre.1** is a prerelease that introduces a completely redesigned profiles system, significant performance improvements, and important bug fixes.

## 🎭 New Profiles System (Profiles V2)

### Complete Profile Overhaul
- **Profile Launcher Window**: New dedicated launcher window for managing and switching between profiles
- **True Profile Isolation**: Each profile now has completely separate settings, databases, and configurations
- **Profile Duplication**: Easily duplicate existing profiles to create new variations
- **Profile Search**: Filter through profiles with a built-in search feature
- **Automatic Migration**: Seamlessly migrates from version 3.x profiles to the new system

### Enhanced Profile Management
- **Profile Menu**: Dedicated menu for all profile-related actions
- **Alphabetical Sorting**: Profiles automatically sorted for easier navigation
- **Profile Indicator**: Clear visual indicator showing which profile is currently active
- **Profile Protection**: Default profile cannot be deleted to prevent data loss
- **Profile Switching**: Switch between profiles without restarting the app

### Profile Actions
- **Create New Profiles**: Easy profile creation from the launcher window
- **Rename Profiles**: Change profile names at any time
- **Delete Profiles**: Remove unwanted profiles (except the default profile)
- **Duplicate Profiles**: Copy an existing profile's configuration and data
- **Profile Settings**: Each profile maintains its own preferences and settings

## 🚀 Performance Improvements

### Audio Playback
- **HTML5 Audio Streaming**: Switched to HTML5 Audio for significantly faster playback of large audio files
- **Reduced Latency**: Audio files start playing more quickly
- **Better Memory Usage**: More efficient handling of large audio libraries

### General Performance
- **Faster Startup**: Optimized initialization for quicker app launch
- **Improved Responsiveness**: Better UI performance during heavy operations
- **Linux Optimizations**: Several performance tweaks specifically for Linux users

## 🔧 Bug Fixes

### File Handling
- **Directory Picker**: Fixed issue with directory picker not working correctly
- **Ogg Vorbis Support**: Fixed bug in reading duration of Ogg Vorbis files
- **Bulk Add**: Fixed category display bug when bulk adding songs

### Application Stability
- **Single-Instance Lock**: Enforces single-instance locks to prevent multiple instances from interfering
- **Dropbox Lock Files**: Automatically cleans up stale Dropbox lock files on start
- **Modal Closing**: Fixed issue with modal dialogs not closing properly
- **Profile Persistence**: Fixed issue with saving preference data between profile switches

### User Interface
- **Window Title**: Removed redundant title from window header on macOS
- **Profile Switcher**: Fixed profile name clickability and switching behavior
- **Profile Window**: Proper handling when closing the profile management window

## 🔄 Updates & Maintenance

### Core Dependencies
- **Electron**: Updated to 38.3.0
- **Electron Updater**: Updated to 6.7.0
- **Playwright**: Updated to 1.56.1 (testing framework)
- **node-sqlite3-wasm**: Updated to 0.8.50

### UI Dependencies
- **Font Awesome**: Updated to 7.1.0
- **WaveSurfer.js**: Updated to 7.11.0
- **Electron Store**: Updated to 11.0.2
- **Cross-env**: Updated to 10.1.0

### Testing & Development
- **Ubuntu 22.04**: Added to the test matrix
- **Profile Tests**: Added comprehensive test suite for profile functionality
- **OGG Tests**: Added specific tests for OGG file handling
- **Test Stability**: Multiple improvements to test reliability

## 🌐 Platform Updates

### Linux Support
- **Domain Change**: Updated references from mrvoice.net to mxvoice.app
- **Linux Tweaks**: Various improvements for better Linux compatibility
- **Package Building**: Improved build process for Linux packages

### Windows Support
- **Building Documentation**: Added comprehensive Windows building instructions
- **Preload Fixes**: Resolved several Windows-specific preload issues

## 📝 Documentation

### New Documentation
- **Profiles V2 Architecture**: Comprehensive documentation of the new profiles system
- **Build Workflows**: Updated multi-architecture build workflow documentation
- **Windows Code Signing**: Added documentation for Windows code signing configuration

### Updated Documentation
- **Release Notes**: Fixed and updated release notes system
- **README Updates**: Various updates to module and directory documentation

## 🔍 Developer Improvements

### Code Quality
- **Debug Logging**: Cleaned up debug logging throughout the codebase
- **Code Organization**: Removed old electron-squirrel references and other cleanup
- **ESM Migration**: Continued improvements to ES Module usage

### Testing Infrastructure
- **Test Reliability**: Addressed numerous flaky test issues
- **Test Coverage**: Expanded test coverage for new features
- **Test Environment**: Improved test isolation and environment management

---

**Important Notes for This Prerelease**:

1. **Profile Migration**: Your existing profiles will be automatically migrated to the new system on first launch. This process is irreversible, so consider backing up your data before upgrading.

2. **Breaking Change**: The profiles system has been completely redesigned. If you rely on any specific profile-related workflows, please test thoroughly before deploying to production environments.

3. **Performance Benefits**: The switch to HTML5 Audio streaming provides significant performance improvements, especially for large audio files. However, this represents a major change to the audio playback system.

4. **Linux Users**: Several Linux-specific improvements have been made. If you're running on Linux, this release should provide a noticeably better experience.

**What This Means for You**: This prerelease brings a much more powerful and flexible profiles system, making it easier to maintain separate configurations for different use cases (e.g., different shows, venues, or performers). Combined with performance improvements and bug fixes, this version provides a solid foundation for the 4.1.0 release.

**Feedback Welcome**: As a prerelease, we encourage testing and feedback. Please report any issues you encounter, especially with the new profiles system.

