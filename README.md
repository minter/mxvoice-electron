# Mx. Voice
*Improv Audio Software — Version 4 (pre-release)*

## About

This is a continuation of the original Mr. Voice Perl/Tk app, circa 2000. While still in use in many CSz clubs, the Perl/Tk app was showing its age, and nearly impossible to build correctly. This caused problems on more modern operating systems.

Thus, 20 years later, this project to rewrite the software in a more modern way.

## Developing

Mx. Voice depends on Node.js and `yarn`. We recommend Node 18+.

Check out the [source code from Github](https://github.com/minter/mxvoice-electron/). Go into the `mxvoice-electron` folder.

The first time that you run the software in development mode, you will need to install the dependencies. Do that by running:

```bash
yarn install
```

This should install any required node modules in the `node_modules` subdirectory. Please report any problems installing dependencies.

Once your node dependencies are installed, you can run the currently-checked-out code in development mode with:

```bash
yarn start
```

That should launch the app onto your desktop!

## Architecture Overview

The app follows a modern Electron architecture with context isolation enabled and a modular codebase:

- `src/main/` (Main process)
  - Entry: `src/main/index-modular.js`
  - Modules: `app-setup`, `ipc-handlers`, `file-operations`, `debug-log`
  - Responsibilities: create window/menu, initialize store/DB, secure IPC, auto-updater
  - See `src/main/README.md`

- `src/preload/` (Preload, context isolated)
  - Entry: `src/preload/preload-modular.js`
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
- Context Isolation: ON
- No direct Node.js access in renderer; all privileged operations go through preload‑exposed secure APIs
- IPC handlers validate inputs on the main side

### Useful paths
- Assets: `src/assets/` (see `src/assets/README.md`)
- Styles: `src/stylesheets/` (see `src/stylesheets/README.md`)

### Debugging tips
- Open DevTools from the app menu (View → Developer Tools)
- Main process logs via structured DebugLog; renderer logs via the DebugLog module
- Bootstrap Bootstrap 5 is bundled via `bootstrap.bundle.min.js` and accessed using the adapter; prefer `data-bs-*` attributes in HTML.


## Building, Signing, and Releasing

### macOS (OS X)

To build packages for release on macOS, use the following commands depending on your architecture:

- For Intel (x64) builds:

```bash
yarn build:mac:x64
```

- For Apple Silicon (arm64) builds:

```bash
yarn build:mac:arm64
```

These commands use the makers defined in `package.json`, along with your current system architecture, and build the available targets.

Build output will be available in the `dist/` subdirectory. Currently, this produces both a `.dmg` and a `.zip` file, with the `.dmg` being directly installable on the system.

The build process includes code signing and notarization for macOS. The signing identity and entitlements are configured in the build scripts located in the `build/` directory (`afterPack.js`, `notarize.js`, and `entitlements.mac.plist`). To successfully sign and notarize the app, you need to set the following environment variables:

- `APPLE_ID`: Your Apple developer Apple ID email.
- `APPLE_ID_PASSWORD`: Your Apple app-specific password or Apple ID password.
- `APPLE_TEAM_ID`: Your Apple developer team ID.
- `GITHUB_TOKEN`: A GitHub token with permissions to upload releases.

To publish the release to the official Mx. Voice GitHub Releases, use:

```bash
yarn release
```

This command requires the above environment variables to be set.

#### Universal macOS Releases (ARM64 + x64)

For creating universal macOS releases that support both Apple Silicon and Intel Macs, follow this workflow:

**Prerequisites:**
- Set up the required environment variables listed above
- Ensure you have access to push tags to the repository

**Release Process:**

1. **Create and push a version tag** (this automatically triggers x64 build on GitHub Actions):
   ```bash
   git tag v3.2.0
   git push origin v3.2.0
   ```

2. **Build ARM64 locally** while the GitHub Actions x64 build runs:
   ```bash
   yarn build:mac:arm64
   ```

3. **Download x64 artifacts** from the completed GitHub Actions run:
   - Go to the Actions tab in your GitHub repository
   - Find the workflow run triggered by your tag
   - Download the `macos-x64-signed-build` artifact
   - Extract the contents to your local `dist/` directory

4. **Create the universal release**:
   ```bash
   export GITHUB_TOKEN=your_github_token_here
   yarn release:universal
   ```

This process creates a draft GitHub release with:
- ARM64 and x64 `.dmg` files
- ARM64 and x64 `.zip` files
- ARM64 and x64 `.blockmap` files (for efficient updates)
- A universal `latest-mac.yml` file that supports both architectures

The release will be created as a **draft** for you to review before publishing. The x64 architecture is set as the default download for backward compatibility with existing Intel Mac users, while Apple Silicon users will automatically receive the ARM64 version.

**Expected files in dist/ before running `yarn release:universal`:**
- `Mx. Voice-3.2.0-arm64.dmg`
- `Mx. Voice-3.2.0-arm64.zip`
- `Mx. Voice-3.2.0-arm64.dmg.blockmap`
- `Mx. Voice-3.2.0-arm64.zip.blockmap`
- `Mx. Voice-3.2.0-x64.dmg`
- `Mx. Voice-3.2.0-x64.zip`
- `Mx. Voice-3.2.0-x64.dmg.blockmap`
- `Mx. Voice-3.2.0-x64.zip.blockmap`
- `latest-mac.yml`

### Windows

#### Building and Signing

To build and sign the Windows installer, use:

```bash
yarn build:win
```
or
```bash
npm run build:win
```

This command will:
- Build the Windows installer (`.exe`) in the `dist/` directory.
- Automatically sign the installer using SSL.com's CodeSignTool.

#### Required Environment Variables

Before building, set the following environment variables (these are required for signing):

- `SSL_USERNAME`: Your SSL.com RA username.
- `SSL_CREDENTIAL_ID`: Your SSL.com credential ID.
- `SSL_PASSWORD`: Your SSL.com RA password.
- `SSL_TOTP_SECRET`: Your SSL.com TOTP secret (base64-encoded, for automated OTP).

Example (PowerShell):

```powershell
$env:SSL_USERNAME="your_username"
$env:SSL_CREDENTIAL_ID="your_credential_id"
$env:SSL_PASSWORD="your_password"
$env:SSL_TOTP_SECRET="your_base64_totp_secret"
```

#### How the Signing Works

- The signing process is fully automated and runs after the installer is built.
- The script locates the most recent `.exe` installer in the `dist/` directory and signs it in-place using SSL.com's CodeSignTool and your credentials.

#### Verifying the Signature

After building, you can verify the signature:

**Using Windows Explorer:**
- Right-click the installer in `dist/`
- Select **Properties** > **Digital Signatures**
- Select the signature and click **Details** to view certificate info

**Using signtool.exe (if available):**
```powershell
signtool verify /pa "C:\Users\wade\mxvoice-electron\dist\Mx. Voice Setup 3.2.0.exe"
```
You should see "Successfully verified" if the signature is valid.

#### Publishing

To publish Windows releases, use your preferred workflow for uploading the signed installer to GitHub or your distribution platform.

**Note:** The old certificate file-based signing is no longer used. All signing is handled via SSL.com credentials and the automated script.

## References and Utilities

Helpful tools and documentation:
* [Electron.js](https://www.electronjs.org)
* [Electron Builder](https://www.electron.build)

## Authors
Mx. Voice 4 is brought to you with love by:
* Wade Minter (<wade@wademinter.com>)
* Andrew Berkowitz (<andrew@andrewberkowitz.com>)
