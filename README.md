# Mx. Voice
*Improv Audio Software*

## About

This is a continuation of the original Mr. Voice Perl/Tk app, circa 2000. While still in use in many CSz clubs, the Perl/Tk app was showing its age, and nearly impossible to build correctly. This caused problems on more modern operating systems.

Thus, 20 years later, this project to rewrite the software in a more modern way.

## Developing

Mx. Voice depends on Node.js. Requires Node.js 22.12.0 or higher (22.18.0 recommended). The project uses `mise` for version management - see `.mise.toml`.

Check out the [source code from Github](https://github.com/minter/mxvoice-electron/). Go into the `mxvoice-electron` folder.

The first time that you run the software in development mode, you will need to install the dependencies. Do that by running:

```bash
npm install
```

This should install any required node modules in the `node_modules` subdirectory. Please report any problems installing dependencies.

Once your node dependencies are installed, you can run the currently-checked-out code in development mode with:

```bash
npm start
```

That should launch the app onto your desktop!

## Testing

This project uses Playwright with first-class Electron support. Each test suite (file) launches the real app in a fully isolated environment.

**🎉 Comprehensive Test Coverage**: The test suite covers 100% of major application functionality including search, song management, bulk operations, categories, audio playback, holding tank, hotkeys, UI controls, preferences, and system integration.

### Run tests

**Important**: On macOS/Linux, unset `ELECTRON_RUN_AS_NODE` before running tests:

```bash
# Run all tests (comprehensive E2E coverage)
unset ELECTRON_RUN_AS_NODE && npm test

# Interactive test runner UI
unset ELECTRON_RUN_AS_NODE && npm run test:ui

# Headed mode (see windows during tests)
unset ELECTRON_RUN_AS_NODE && npm run test:headed

# Debug mode
unset ELECTRON_RUN_AS_NODE && npm run test:debug

# View the HTML report from the last run
npm run test:report

# Optional: manual smoke test (excluded from default runs)
unset ELECTRON_RUN_AS_NODE && npx playwright test tests/e2e/smoke.spec.js
```

**Why?** IDEs like VS Code and Cursor often set `ELECTRON_RUN_AS_NODE=1`, which prevents Electron from launching its GUI. Tests require the full GUI application.

For details on test isolation, per‑suite environments, CI behavior, and complete coverage breakdown, see `tests/README.md` and `tests/ELECTRON_TESTING_GUIDE.md`.

## Configuration

### Import Thresholds
The application uses an intelligent routing system when importing multiple audio files. You can tune the "Middle Path" threshold in:
- `src/renderer/modules/bulk-operations/multi-song-import.js` -> `MULTI_SONG_THRESHOLD` (Default: `20`)

**Routing Logic:**
- **1 Song**: Individual Add Modal (manual metadata entry).
- **2 to N Songs**: Multi-Song Import Modal (scrollable list with per-song metadata fine-tuning).
- **> N Songs**: Traditional Bulk Add Modal (assigns one category to all files).

## Architecture Overview

The app follows a modern Electron architecture with context isolation enabled and a modular codebase:

- `src/main/` (Main process)
  - Entry: `src/main/index-modular.js`
  - Modules: `app-setup`, `ipc-handlers`, `file-operations`, `debug-log`
  - Responsibilities: create window/menu, initialize store/DB, secure IPC, auto-updater
  - See `src/main/README.md`

- `src/preload/` (Preload, sandboxed + context isolated)
  - Source: `src/preload/preload-modular.cjs` (bundled to `preload-bundle.cjs` by esbuild)
  - Exposes vetted APIs via `contextBridge` as `window.secureElectronAPI` (and a compatibility `window.electronAPI`)
  - Bridges events from main to renderer
  - See `src/preload/README.md`

- `src/renderer/` (Renderer process)
  - Feature modules under `src/renderer/modules/` (each with its own README)
  - Core infrastructure: `function-registry`, `event-manager`, `function-monitor`, `module-loader`
  - Services facades over secure APIs: `src/renderer/services/`
- Bootstrap 5 integration via `modules/ui/bootstrap-adapter.js` (no jQuery plugins). jQuery is not required; DOM helpers live in `modules/dom-utils/`.
  - See `src/renderer/README.md`

### Security model
- Sandbox: ON (preload bundled via esbuild, can only `require('electron')`)
- Context Isolation: ON
- No direct Node.js access in renderer; all privileged operations go through preload‑exposed secure APIs
- Named IPC operations only — no raw SQL or arbitrary queries from renderer
- IPC handlers validate inputs on the main side
- DOMPurify sanitization on dynamic HTML rendering

### Database
- Uses the `node-sqlite3-wasm` WebAssembly module for cross-platform compatibility
- No native binary dependencies - works consistently across all architectures (x64, ARM64)
- Database files are stored in the user's application data directory
- Automatic migration support from legacy database formats
- Fallback to in-memory database if file operations fail

### Module system
- All code uses ES Modules (`import`/`export`)
- All imports must include `.js` extensions
- See module READMEs for detailed patterns and requirements

### Useful paths
- Assets: `src/assets/` (see `src/assets/README.md`)
- Styles: `src/stylesheets/` (see `src/stylesheets/README.md`)
- Tests: `tests/` (see `tests/README.md`)
- Docs: `docs/` (see individual documentation files)

### Debugging tips
- Open DevTools from the app menu (View → Developer Tools)
- Main process logs via structured DebugLog; renderer logs via the DebugLog module
- Bootstrap 5 is bundled via `bootstrap.bundle.min.js` and accessed using the adapter; prefer `data-bs-*` attributes in HTML
- Auto-updater logs show markdown processing status for release notes
- Use `npm test:headed` to see the app during test execution


## Building, Signing, and Releasing

### Available Build Scripts

The following build scripts are available:

```bash
# Development
npm start                    # Start the app in development mode

# macOS Builds
npm run build:mac:universal     # Build universal macOS app (x64 + ARM64)
npm run build:mac:arm64         # Build ARM64-only macOS app

# Windows Builds  
npm run build:win               # Build Windows installer

# Linux Builds
npm run build:linux             # Build all Linux formats
npm run build:linux:deb         # Build Debian package
npm run build:linux:appimage    # Build AppImage

# Publishing (GitHub Actions)
npm run release:mac             # Publish macOS stable build to GitHub
npm run release:mac:prerelease  # Publish macOS prerelease to GitHub
npm run release:mac:draft       # Publish macOS draft to GitHub
npm run release:win             # Publish Windows stable build to GitHub
npm run release:win:prerelease  # Publish Windows prerelease to GitHub
npm run release:win:draft       # Publish Windows draft to GitHub
npm run release:linux           # Publish Linux stable build to GitHub
npm run release:linux:prerelease # Publish Linux prerelease to GitHub
npm run release:linux:draft     # Publish Linux draft to GitHub

# Local builds (no publishing)
npm pack                    # Build without publishing
npm run dist                    # Build all platforms locally

# Utility scripts
npm run lint                   # Run ESLint
npm run lint:fix               # Run ESLint with auto-fix
```

### macOS

#### Building and Signing

**Universal Mac builds (x64 + ARM64) are built locally:**

```bash
npm run build:mac:universal
```

This creates universal builds (x64 + ARM64) in your `dist/` directory. For ARM64-only builds:
```bash
npm run build:mac:arm64
```

**To release to GitHub:**
1. **Push a tag** to trigger the release:
   ```bash
   git tag v{version}
   git push origin v{version}
   ```

2. **Or use the release scripts directly:**
   ```bash
   npm run release:mac:prerelease  # For prerelease builds
   npm run release:mac             # For stable releases
   npm run release:mac:draft       # For draft releases
   ```

#### Auto-Update Support

The app now supports two auto-update providers:
- **4.x users**: GitHub provider for multi-architecture support with automatic release notes processing
- **3.x users**: Custom download server (legacy support)

**Release Notes Processing:**
- GitHub release notes are automatically processed from markdown to HTML
- Users see properly formatted update information with bullet points, paragraphs, and links
- Fallback to raw text if markdown processing fails

**Update Channel Control:**
- Users can choose whether to receive prerelease updates (beta/alpha versions)
- Default behavior: Only stable releases are shown
- Prerelease updates are offered if:
  - User explicitly opts-in via Preferences → Update Options, OR
  - User is currently running a pre-release version (e.g., 4.0.0-pre.4)
- Setting can be changed at any time and takes effect immediately

This ensures backward compatibility while providing modern auto-update functionality for new releases.

### Linux

#### Building

To build Linux packages:

```bash
# Build all Linux formats (AppImage and deb)
npm run build:linux

# Build specific formats
npm run build:linux:deb         # Debian package
npm run build:linux:appimage    # AppImage
```

**To release to GitHub:**
```bash
npm run release:linux:prerelease  # For prerelease builds
npm run release:linux             # For stable releases
npm run release:linux:draft       # For draft releases
```

#### Linux Package Details

- **AppImage**: Universal Linux format, runs on most distributions
- **Debian (.deb)**: Package for Debian, Ubuntu, and derivatives
- **Category**: AudioVideo
- **Dependencies**: Listed in `package.json` under `deb.depends`

### Windows

#### Building and Signing

To build and sign the Windows installer, use:

```bash
npm run build:win
```
or
```bash
npm run build:win
```

This command will:
- Build the Windows installer (`.exe`) in the `dist/` directory.
- Automatically sign all executables and DLLs using Windows native signtool.exe with YubiKey certificate.
- **Automatically calculate correct checksums** in `latest.yml` - no post-processing needed.

#### Required Setup

Before building, ensure you have:

- **Windows SDK** installed (includes signtool.exe) - auto-detected from common locations
- **YubiKey** with code signing certificate imported and accessible
- **Optional environment variables** (for customization):
  - `SIGNTOOL_PATH`: Custom path to signtool.exe (if not in standard location)
  - `YUBIKEY_CERT_NAME`: Specific certificate name to use (optional, auto-selects if not provided)
  - `YUBIKEY_PIN`: YubiKey PIN (optional, will prompt if not set - cached for session)

Example (PowerShell):

```powershell
# Optional: specify custom signtool path
$env:SIGNTOOL_PATH="C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"

# Optional: specify certificate name (if multiple certificates available)
$env:YUBIKEY_CERT_NAME="Your Certificate Name"

# Optional: provide PIN (otherwise will prompt once per session)
$env:YUBIKEY_PIN="your_pin"
```

#### How the Signing Works

The signing process uses a two-phase approach to ensure all files are properly signed:

1. **Pre-Installer Signing** (`afterPack` hook):
   - All files in `win-unpacked/` (main executable, DLLs, etc.) are signed in ONE batch command
   - This happens BEFORE the installer is created, ensuring signed files are included in the installer
   - **One PIN prompt** for all unpacked files

2. **Post-Installer Signing** (`signAllWindows.cjs`):
   - The installer and uninstaller are signed after creation
   - **One PIN prompt** for installer/uninstaller

**Key Benefits:**
- **Batch signing**: All files signed in single signtool commands reduces PIN prompts from 10-12 to just 2
- **Signed files in installer**: Files inside the installer are properly signed (not unsigned copies)
- **YubiKey smart card**: Uses Windows native signtool.exe with YubiKey certificate from Windows certificate store
- **Automatic checksums**: electron-builder calculates correct checksums automatically - no post-processing needed
- **Comprehensive coverage**: All Windows artifacts are properly signed for consistent publisher trust

#### Verifying the Signature

After building, you can verify the signature:

**Using Windows Explorer:**
- Right-click the installer in `dist/`
- Select **Properties** > **Digital Signatures**
- Select the signature and click **Details** to view certificate info

**Using signtool.exe (if available):**
```powershell
signtool verify /pa "C:\path\to\mxvoice-electron\dist\Mx. Voice Setup {version}.exe"
```
You should see "Successfully verified" if the signature is valid.

#### Publishing

To publish Windows releases, use your preferred workflow for uploading the signed installer to GitHub or your distribution platform.

**Note:** Signing uses Windows native signtool.exe with YubiKey smart card certificate. You'll be prompted for your YubiKey PIN twice during the build: once for unpacked files, and once for the installer/uninstaller.

## Dependencies and Architecture

### Core Dependencies
- **Database**: `node-sqlite3-wasm` - SQLite WebAssembly module for cross-platform database support
- **UI Framework**: Bootstrap 5 with custom adapter (no jQuery required)
- **Audio**: Howler.js for audio playback, WaveSurfer.js for waveform visualization
- **Hotkeys**: Mousetrap for keyboard shortcut binding
- **Guided Tours**: Driver.js for "What's New" feature tours
- **Auto-updates**: `electron-updater` with GitHub provider support
- **Audio Metadata**: `music-metadata` for extracting audio file metadata
- **Logging**: Structured DebugLog system with file rotation and export via `electron-log`
- **Sanitization**: DOMPurify for safe HTML rendering of release notes
- **Analytics**: `posthog-node` for anonymous, opt-out product analytics (main-process only; disabled in dev/test unless `ANALYTICS_ENABLED=1`)

### Optimized Package List
The package.json has been cleaned up to remove orphaned dependencies. All remaining packages are actively used:
- FontAwesome for UI icons
- Bootstrap for responsive UI components
- node-sqlite3-wasm for cross-platform database
- DOMPurify for HTML sanitization of release notes
- Audio libraries for playback and visualization
- Electron utilities for development and production builds

## References and Utilities

Helpful tools and documentation:
* [Electron.js](https://www.electronjs.org)
* [Electron Builder](https://www.electron.build)
* [node-sqlite3-wasm](https://github.com/sqlite3/node-sqlite3-wasm)

## Authors
Mx. Voice 4 is brought to you with love by:
* Wade Minter (<wade@wademinter.com>)
* Andrew Berkowitz (<andrew@andrewberkowitz.com>)
