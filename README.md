# Mx. Voice
*Improv Audio Software, Version 3.2.0*

## About

This is a continuation of the original Mr. Voice Perl/Tk app, circa 2000. While still in use in many CSz clubs, the Perl/Tk app was showing its age, and nearly impossible to build correctly. This caused problems on more modern operating systems.

Thus, 20 years later, this project to rewrite the software in a more modern way.

## Developing

Mx. Voice 3 depends on node.js being available on your system, along with `yarn`. We recommend node 18+.

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

To build Windows installers, use the following commands with electron-builder:

- For 32-bit (ia32) Windows builds:

```bash
yarn dist --win --ia32
```

- For 64-bit (x64) Windows builds (recommended for Windows 11 and modern systems):

```bash
yarn dist --win --x64
```

These commands build the respective Windows installer architectures.

Signing Windows installers requires the following environment variables:

- `WINDOWS_CERTIFICATE_FILE`: Path to the code signing certificate file.
- `WINDOWS_CERTIFICATE_PASSWORD`: Password to unlock the certificate.
- `GITHUB_TOKEN`: A GitHub token with permissions to upload releases.

To publish Windows releases, use:

```bash
yarn release --win --ia32
```

or for 64-bit builds:

```bash
yarn release --win --x64
```

Ensure the appropriate environment variables are set for signing and publishing.

## References and Utilities

Helpful tools and documentation:
* [Electron.js](https://www.electronjs.org)
* [Electron Builder](https://www.electron.build)

## Authors
Mx. Voice 3 is brought to you with love by:
* Wade Minter (<wade@wademinter.com>)
* Andrew Berkowitz (<andrew@andrewberkowitz.com>)
