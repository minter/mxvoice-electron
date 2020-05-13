# Mx. Voice
*Improv Audio Software, Version 3*

## About

This is a continuation of the original Mr. Voice Perl/Tk app, circa 2000. While still in use in many CSz clubs, the Perl/Tk app was showing its age, and nearly impossible to build correctly. This caused problems on more modern operating systems.

Thus, 20 years later, this project to rewrite the software in a more modern way.

## Developing

Mx. Voice 3 depends on node.js being available on your system, along with `npm` and `yarn`. We recommend node 13+.

Check out the [source code from Github](https://github.com/minter/mxvoice-electron/). Go into the `mxvoice-electron` folder.

The first time that you run the software in development mode, you will need to install the dependencies. Do that by running:

`npm install`

This should install any required node modules in the `node_modules` subdirectory. Please report any problems installing dependencies.

Once your node dependencies are installed, you can run the currently-checked-out code in development mode with:

`npm start`

That should launch the app onto your desktop!


## Building

### OS X

To build packages for release, use the `npm run make` command. This will use the makers defined in `package.json`, along with your current system architecture (e.g., `darwin`) and build any available targets.

Build output of `npm run make` will be available in the `out/` subdirectory. Currently, this produces both a `.dmg` and a `.zip` file, with the `.dmg` being preferred.

To enable debug output of the make command, set this environment variable: `DEBUG=electron-osx-sign*`

To publish the release to the official Mx. Voice GitHub Releases, use `npm run publish`. This requires a `GITHUB_TOKEN` environment variable to be set, with permissions to upload releases, as well as environment variables `APPLE_ID` and `APPLE_ID_PASSWORD`, set to a login and an app password with development rights to code-sign and notarize the app.

### Windows

It is allegedly possible to build Windows binaries on the Mac, though getting that to work has proven challenging. So we're using an Azure-based Windows VM for builds.

To build on a Windows system, run:

* `npm run make -- --arch=ia32`

This will build a 32-bit installer package, which can work on both 32-bit and 64-bit versions of Windows (whereas a 64-bit package would not work on 32-bit Windows). As with OS X, installer files will be the `out/` directory.

Publishing to the official Mx. Voice GitHub Releases is also done with `npm run publish -- --arch=ia32`. It requires the `GITHUB_TOKEN` environment variable with appropriate access, as well as en`WINDOWS_CERTIFICATE_FILE` (the path to the code signing certificate file) and `WINDOWS_CERTIFICATE_PASSWORD` (the password to unlock the cert)

## References and Utilities

Helpful tools and documentation:
* [Electron.js](https://www.electronjs.org)
* [Electron Forge](https://www.electronforge.io)

## Authors
Mx. Voice 3 is brought to you with love by:
* Wade Minter (<wade@wademinter.com>)
* Andrew Berkowitz (<andrew@andrewberkowitz.com>)
