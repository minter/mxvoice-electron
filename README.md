# Mr. Voice
*Improv Audio Software, Version 3*

## About

This is a continuation of the original Mr. Voice Perl/Tk app, circa 2000. While still in use in many CSz clubs, the Perl/Tk app was showing its age, and nearly impossible to build correctly. This caused problems on more modern operating systems.

Thus, 20 years later, this project to rewrite the software in a more modern way.

## Developing

Mr. Voice 3 depends on node.js being available on your system, along with `npm` and `yarn`. We recommend node 13+.

Check out the source code from Github. Go into the `mrvoice-electron` folder.

The first time that you run the software in development mode, you will need to install the dependencies. Do that by running:

`npm install`

This should install any required node modules in the `node_modules` subdirectory. Please report any problems installing dependencies.

Once your node dependencies are installed, you can run the currently-checked-out code with:

`npm start`

That should launch the app onto your desktop!


## Building

To build packages for release, use the `npm run make` command. This will use the makers defined in `package.json`, along with your current system architecture (e.g., `darwin`) and build any available targets.

Build output of `npm run make` will be available in the `out/` subdirectory.

To build for a different platform (for example, if you are on a Mac and want to build Windows binaries), you can pass a platform flag:

`npm run make --platform=win32`

Note that building Windows binaries on a Mac requires `mono` and `wine`, available via Homebrew.

## References and Utilities

Helpful tools and documentation:
* [Electron.js](https://www.electronjs.org)
* [Electron Forge](https://www.electronforge.io)
* [Free Windows developer VM](https://developer.microsoft.com/en-us/windows/downloads/virtual-machines/) from Microsoft

## Authors
Mr. Voice 3 is brought to you with love by:
* Wade Minter (<wade@wademinter.com>)
* Andrew Berkowitz (<andrew@andrewberkowitz.com>)
